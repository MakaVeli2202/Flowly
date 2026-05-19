using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;

namespace Flowly.API.Modules.Billing
{
    public class BillingService : IBillingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<BillingService> _logger;

        private const string StripeApiBase = "https://api.stripe.com/v1";

        public BillingService(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<BillingService> logger)
        {
            _context = context;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private HttpClient CreateStripeClient()
        {
            var http = _httpClientFactory.CreateClient("Stripe");
            http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _configuration["Stripe:SecretKey"] ?? "");
            return http;
        }

        // ---- Platform plan management -----------------------------------------------

        public async Task<IEnumerable<PlatformPlanDto>> GetPlansAsync()
        {
            var plans = await _context.PlatformPlans.AsNoTracking()
                .OrderBy(p => p.SortOrder)
                .ToListAsync();
            return plans.Select(ToDto);
        }

        public async Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> GetPlanAsync(int id)
        {
            var plan = await _context.PlatformPlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (plan == null) return (null, "Plan not found.", 404);
            return (ToDto(plan), null, 200);
        }

        public async Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> CreatePlanAsync(CreatePlatformPlanDto dto)
        {
            var plan = new PlatformPlan
            {
                Name = dto.Name.Trim(),
                MonthlyPrice = dto.MonthlyPrice,
                AnnualPrice = dto.AnnualPrice,
                MaxLocations = dto.MaxLocations,
                MaxStaff = dto.MaxStaff,
                MaxBookingsPerMonth = dto.MaxBookingsPerMonth,
                AITokenMonthlyLimit = dto.AITokenMonthlyLimit,
                FeaturesJson = dto.Features != null ? JsonSerializer.Serialize(dto.Features) : null,
                SortOrder = dto.SortOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            _context.PlatformPlans.Add(plan);
            await _context.SaveChangesAsync();
            return (ToDto(plan), null, 201);
        }

        public async Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> UpdatePlanAsync(int id, UpdatePlatformPlanDto dto)
        {
            var plan = await _context.PlatformPlans.FirstOrDefaultAsync(p => p.Id == id);
            if (plan == null) return (null, "Plan not found.", 404);

            if (dto.Name != null) plan.Name = dto.Name.Trim();
            if (dto.MonthlyPrice.HasValue) plan.MonthlyPrice = dto.MonthlyPrice.Value;
            if (dto.AnnualPrice.HasValue) plan.AnnualPrice = dto.AnnualPrice.Value;
            if (dto.MaxLocations.HasValue) plan.MaxLocations = dto.MaxLocations.Value;
            if (dto.MaxStaff.HasValue) plan.MaxStaff = dto.MaxStaff.Value;
            if (dto.MaxBookingsPerMonth.HasValue) plan.MaxBookingsPerMonth = dto.MaxBookingsPerMonth.Value;
            if (dto.AITokenMonthlyLimit.HasValue) plan.AITokenMonthlyLimit = dto.AITokenMonthlyLimit.Value;
            if (dto.Features != null) plan.FeaturesJson = JsonSerializer.Serialize(dto.Features);
            if (dto.SortOrder.HasValue) plan.SortOrder = dto.SortOrder.Value;
            if (dto.IsActive.HasValue) plan.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();
            return (ToDto(plan), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeactivatePlanAsync(int id)
        {
            var plan = await _context.PlatformPlans.FirstOrDefaultAsync(p => p.Id == id);
            if (plan == null) return ("Plan not found.", 404);
            plan.IsActive = false;
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        // ---- Org subscription management -------------------------------------------

        public async Task<(OrganizationSubscriptionDto? Result, string? Error, int StatusCode)> GetSubscriptionAsync(int orgId)
        {
            var sub = await _context.OrganizationSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.OrgId == orgId);
            if (sub == null) return (null, "No subscription found.", 404);
            return (ToSubDto(sub), null, 200);
        }

        public async Task<(CheckoutSessionResultDto? Result, string? Error, int StatusCode)> CreateCheckoutSessionAsync(int orgId, CreateCheckoutSessionDto dto)
        {
            var plan = await _context.PlatformPlans.FirstOrDefaultAsync(p => p.Id == dto.PlanId && p.IsActive);
            if (plan == null) return (null, "Plan not found or inactive.", 404);

            var stripeKey = _configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(stripeKey))
                return (null, "Billing is not configured.", 503);

            try
            {
                var isAnnual = dto.BillingCycle == "annual";
                var unitAmount = (long)Math.Round((isAnnual ? plan.AnnualPrice : plan.MonthlyPrice) * 100);
                var interval = isAnnual ? "year" : "month";

                var http = CreateStripeClient();
                var body = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["mode"] = "subscription",
                    ["payment_method_types[]"] = "card",
                    ["line_items[0][price_data][currency]"] = "usd",
                    ["line_items[0][price_data][product_data][name]"] = $"Flowly {plan.Name}",
                    ["line_items[0][price_data][unit_amount]"] = unitAmount.ToString(),
                    ["line_items[0][price_data][recurring][interval]"] = interval,
                    ["line_items[0][quantity]"] = "1",
                    ["success_url"] = dto.SuccessUrl,
                    ["cancel_url"] = dto.CancelUrl,
                    ["metadata[org_id]"] = orgId.ToString(),
                    ["metadata[plan_id]"] = plan.Id.ToString(),
                    ["metadata[billing_cycle]"] = dto.BillingCycle,
                });

                var resp = await http.PostAsync($"{StripeApiBase}/checkout/sessions", body);
                var json = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogError("Stripe checkout failed: {Json}", json);
                    return (null, "Stripe checkout failed.", 502);
                }

                using var doc = JsonDocument.Parse(json);
                var sessionId = doc.RootElement.GetProperty("id").GetString() ?? "";
                var url = doc.RootElement.GetProperty("url").GetString() ?? "";
                return (new CheckoutSessionResultDto { SessionId = sessionId, Url = url }, null, 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateCheckoutSessionAsync error for org {OrgId}", orgId);
                return (null, "Checkout error.", 500);
            }
        }

        public async Task<(BillingPortalSessionDto? Result, string? Error, int StatusCode)> CreateBillingPortalSessionAsync(int orgId, string returnUrl)
        {
            var sub = await _context.OrganizationSubscriptions.FirstOrDefaultAsync(s => s.OrgId == orgId);
            if (sub?.StripeCustomerId == null) return (null, "No Stripe customer found.", 404);

            var stripeKey = _configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(stripeKey))
                return (null, "Billing is not configured.", 503);

            try
            {
                var http = CreateStripeClient();
                var body = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["customer"] = sub.StripeCustomerId,
                    ["return_url"] = returnUrl,
                });

                var resp = await http.PostAsync($"{StripeApiBase}/billing_portal/sessions", body);
                var json = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogError("Stripe portal failed: {Json}", json);
                    return (null, "Stripe portal failed.", 502);
                }

                using var doc = JsonDocument.Parse(json);
                var url = doc.RootElement.GetProperty("url").GetString() ?? "";
                return (new BillingPortalSessionDto { Url = url }, null, 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateBillingPortalSessionAsync error for org {OrgId}", orgId);
                return (null, "Portal error.", 500);
            }
        }

        public async Task<(string? Error, int StatusCode)> HandleStripeWebhookAsync(string payload, string signature)
        {
            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                _logger.LogWarning("Stripe webhook received but Stripe:WebhookSecret not configured - accepting unverified.");
            }
            else
            {
                // Verify Stripe-Signature header (t=timestamp,v1=hash)
                var parts = signature.Split(',')
                    .Select(p => p.Split('=', 2))
                    .Where(p => p.Length == 2)
                    .ToDictionary(p => p[0], p => p[1]);

                if (!parts.TryGetValue("t", out var timestamp) || !parts.TryGetValue("v1", out var v1Hash))
                    return ("Invalid signature format.", 400);

                var signedPayload = $"{timestamp}.{payload}";
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
                var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload))).ToLowerInvariant();

                if (computed != v1Hash)
                    return ("Signature verification failed.", 400);

                // Reject events older than 5 minutes (replay attack prevention)
                if (long.TryParse(timestamp, out var ts) && DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts > 300)
                    return ("Event timestamp too old.", 400);
            }

            try
            {
                using var doc = JsonDocument.Parse(payload);
                var root = doc.RootElement;
                var eventType = root.GetProperty("type").GetString();
                var dataObj = root.GetProperty("data").GetProperty("object");

                switch (eventType)
                {
                    case "customer.subscription.updated":
                    case "customer.subscription.deleted":
                    {
                        var stripeSubId = dataObj.GetProperty("id").GetString();
                        var status = dataObj.GetProperty("status").GetString();
                        var sub = await _context.OrganizationSubscriptions
                            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSubId);
                        if (sub != null)
                        {
                            sub.Status = status == "active" ? "Active" : status == "canceled" ? "Cancelled" : "PastDue";
                            sub.UpdatedAt = DateTime.UtcNow;
                            await _context.SaveChangesAsync();
                            _logger.LogInformation("Stripe subscription {Id} updated to {Status}", stripeSubId, sub.Status);
                        }
                        break;
                    }
                    case "invoice.paid":
                    {
                        var stripeSubId = dataObj.TryGetProperty("subscription", out var subEl) ? subEl.GetString() : null;
                        if (stripeSubId != null)
                        {
                            var sub = await _context.OrganizationSubscriptions
                                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSubId);
                            if (sub != null)
                            {
                                sub.Status = "Active";
                                sub.CurrentPeriodEnd = DateTime.UtcNow.AddMonths(1);
                                sub.UpdatedAt = DateTime.UtcNow;
                                await _context.SaveChangesAsync();
                            }
                        }
                        break;
                    }
                    case "invoice.payment_failed":
                    {
                        var stripeSubId = dataObj.TryGetProperty("subscription", out var subEl) ? subEl.GetString() : null;
                        if (stripeSubId != null)
                        {
                            var sub = await _context.OrganizationSubscriptions
                                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSubId);
                            if (sub != null)
                            {
                                sub.Status = "PastDue";
                                sub.UpdatedAt = DateTime.UtcNow;
                                await _context.SaveChangesAsync();
                                _logger.LogWarning("Stripe payment failed for subscription {Id}", stripeSubId);
                            }
                        }
                        break;
                    }
                    default:
                        _logger.LogInformation("Stripe webhook event {Type} received (not handled)", eventType);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Stripe webhook");
                return ("Webhook processing error.", 500);
            }

            return (null, 200);
        }

        // ---- Usage tracking -------------------------------------------------------

        public async Task<UsageRecordDto?> GetCurrentUsageAsync(int orgId)
        {
            var now = DateTime.UtcNow;
            var record = await _context.UsageRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.OrgId == orgId && u.Year == now.Year && u.Month == now.Month);
            if (record == null) return null;
            return new UsageRecordDto
            {
                Year = record.Year,
                Month = record.Month,
                BookingCount = record.BookingCount,
                StaffCount = record.StaffCount,
                AITokensUsed = record.AITokensUsed,
            };
        }

        public async Task IncrementBookingCountAsync(int orgId)
        {
            var now = DateTime.UtcNow;
            var record = await _context.UsageRecords
                .FirstOrDefaultAsync(u => u.OrgId == orgId && u.Year == now.Year && u.Month == now.Month);
            if (record == null)
            {
                record = new UsageRecord { OrgId = orgId, Year = now.Year, Month = now.Month };
                _context.UsageRecords.Add(record);
            }
            record.BookingCount++;
            record.UpdatedAt = now;
            await _context.SaveChangesAsync();
        }

        // ---- Helpers -------------------------------------------------------------

        private static PlatformPlanDto ToDto(PlatformPlan p)
        {
            var features = new Dictionary<string, bool>();
            if (!string.IsNullOrWhiteSpace(p.FeaturesJson))
            {
                try { features = JsonSerializer.Deserialize<Dictionary<string, bool>>(p.FeaturesJson) ?? features; }
                catch { /* invalid JSON - skip */ }
            }
            return new PlatformPlanDto
            {
                Id = p.Id,
                Name = p.Name,
                MonthlyPrice = p.MonthlyPrice,
                AnnualPrice = p.AnnualPrice,
                MaxLocations = p.MaxLocations,
                MaxStaff = p.MaxStaff,
                MaxBookingsPerMonth = p.MaxBookingsPerMonth,
                AITokenMonthlyLimit = p.AITokenMonthlyLimit,
                Features = features,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder,
            };
        }

        private static OrganizationSubscriptionDto ToSubDto(OrganizationSubscription s) => new()
        {
            Id = s.Id,
            OrgId = s.OrgId,
            PlanId = s.PlanId,
            PlanName = s.Plan?.Name ?? string.Empty,
            Status = s.Status,
            BillingCycle = s.BillingCycle,
            CurrentPeriodStart = s.CurrentPeriodStart,
            CurrentPeriodEnd = s.CurrentPeriodEnd,
            TrialEndsAt = s.TrialEndsAt,
            CancelledAt = s.CancelledAt,
        };
    }
}
