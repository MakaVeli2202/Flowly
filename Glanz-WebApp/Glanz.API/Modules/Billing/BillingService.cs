using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Modules.Billing
{
    public class BillingService : IBillingService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<BillingService> _logger;

        public BillingService(AppDbContext context, IConfiguration configuration, ILogger<BillingService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
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

            // Stripe integration: add Stripe.NET package and implement here.
            // The secret key is read from configuration["Stripe:SecretKey"] (server-side only).
            var stripeKey = _configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(stripeKey))
                return (null, "Billing is not configured.", 503);

            // TODO: implement Stripe Checkout Session creation
            // var options = new SessionCreateOptions { ... };
            // var service = new SessionService(); var session = await service.CreateAsync(options);
            // return (new CheckoutSessionResultDto { SessionId = session.Id, Url = session.Url }, null, 200);

            return (null, "Stripe checkout not yet implemented.", 501);
        }

        public async Task<(BillingPortalSessionDto? Result, string? Error, int StatusCode)> CreateBillingPortalSessionAsync(int orgId, string returnUrl)
        {
            var sub = await _context.OrganizationSubscriptions.FirstOrDefaultAsync(s => s.OrgId == orgId);
            if (sub?.StripeCustomerId == null) return (null, "No Stripe customer found.", 404);

            var stripeKey = _configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(stripeKey))
                return (null, "Billing is not configured.", 503);

            // TODO: implement Stripe Billing Portal session creation
            return (null, "Stripe billing portal not yet implemented.", 501);
        }

        public async Task<(string? Error, int StatusCode)> HandleStripeWebhookAsync(string payload, string signature)
        {
            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(webhookSecret))
                return ("Webhook not configured.", 503);

            // TODO: implement Stripe.ConstructEvent, handle subscription.updated, invoice.paid, etc.
            _logger.LogInformation("Stripe webhook received (not yet processed).");
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
