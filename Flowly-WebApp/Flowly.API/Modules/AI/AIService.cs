using System.Text;
using System.Text.Json;
using Flowly.API.Data;
using Flowly.API.Modules.AI.Models;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Modules.AI
{
    public class AIService : IAIService
    {
        private const int MonthlyTokenBudgetPerOrg = 500_000;
        private const string ModelHaiku = "claude-haiku-4-5";
        private const string ModelSonnet = "claude-sonnet-4-6";
        private const string ModelOpus = "claude-opus-4-7";

        private readonly AppDbContext _db;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _apiKey;
        private readonly ILogger<AIService> _logger;

        public AIService(AppDbContext db, IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<AIService> logger)
        {
            _db = db;
            _httpClientFactory = httpClientFactory;
            _apiKey = config["Anthropic:ApiKey"] ?? string.Empty;
            _logger = logger;
        }

        public async Task<string> CrmNextActionsAsync(int orgId, int customerId, CancellationToken ct = default)
        {
            if (!await HasBudgetAsync(orgId)) return "AI budget exceeded for this month.";

            var customer = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customerId, ct);
            if (customer == null) return "Customer not found.";

            var bookings = await _db.Bookings.AsNoTracking()
                .Where(b => b.UserId == customerId)
                .OrderByDescending(b => b.ScheduledDate)
                .Take(10)
                .Select(b => new { b.Status, b.ScheduledDate, b.TotalAmount })
                .ToListAsync(ct);

            var feedback = await _db.CustomerFeedbacks.AsNoTracking()
                .Where(f => f.UserId == customerId)
                .OrderByDescending(f => f.CreatedAt)
                .Take(5)
                .Select(f => new { f.Rating, f.Comment })
                .ToListAsync(ct);

            var systemPrompt = BuildCachedSystemPrompt("crm");
            var userMessage = $"""
                Customer: {customer.FirstName} {customer.LastName} (joined {customer.CreatedAt:yyyy-MM-dd})
                Recent bookings ({bookings.Count}): {JsonSerializer.Serialize(bookings)}
                Recent feedback: {JsonSerializer.Serialize(feedback)}

                Suggest 3 specific next actions for this customer (re-engage, upsell, retention offer, etc.).
                Format as a numbered list. Be concise and actionable.
                """;

            var (reply, tokens) = await CallClaudeAsync(ModelHaiku, systemPrompt, userMessage, ct);
            await RecordUsageAsync(orgId, null, "crm", tokens);
            return reply;
        }

        public async Task<string> BusinessInsightsAsync(int orgId, CancellationToken ct = default)
        {
            if (!await HasBudgetAsync(orgId)) return "AI budget exceeded for this month.";

            var since = DateTime.UtcNow.AddDays(-30);
            var bookingStats = await _db.Bookings.AsNoTracking()
                .Where(b => b.CreatedAt >= since)
                .GroupBy(b => b.Status)
                .Select(g => new { Status = g.Key.ToString(), Count = g.Count(), Revenue = g.Sum(b => b.TotalAmount) })
                .ToListAsync(ct);

            var topPackages = await (
                from bi in _db.BookingItems.AsNoTracking()
                where bi.Booking!.CreatedAt >= since
                join p in _db.Packages on bi.PackageId equals p.Id
                group bi by p.Name into g
                orderby g.Count() descending
                select new { Package = g.Key, Count = g.Count() }
            ).Take(5).ToListAsync(ct);

            var newCustomers = await _db.Users.AsNoTracking()
                .CountAsync(u => u.CreatedAt >= since, ct);

            var systemPrompt = BuildCachedSystemPrompt("insights");
            var userMessage = $"""
                Last 30 days for org {orgId}:
                Booking stats by status: {JsonSerializer.Serialize(bookingStats)}
                Top packages: {JsonSerializer.Serialize(topPackages)}
                New customers: {newCustomers}

                Provide a brief business insights digest:
                1. Key performance summary (2-3 sentences)
                2. Top 2 anomalies or trends to watch
                3. 2 recommended actions for next week
                Keep it under 300 words.
                """;

            var (reply, tokens) = await CallClaudeAsync(ModelSonnet, systemPrompt, userMessage, ct);
            await RecordUsageAsync(orgId, null, "insights", tokens);
            return reply;
        }

        public async Task<string> MarketingCopyAsync(int orgId, string objective, string language, CancellationToken ct = default)
        {
            if (!await HasBudgetAsync(orgId)) return "AI budget exceeded for this month.";

            var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orgId, ct);
            var orgName = org?.Name ?? "the business";

            var systemPrompt = BuildCachedSystemPrompt("marketing");
            var userMessage = $"""
                Business: {orgName}
                Campaign objective: {objective}
                Language: {language}

                Generate marketing copy with:
                1. A catchy headline (max 10 words)
                2. Body copy (50-80 words)
                3. Call to action (max 8 words)
                4. 3 social media caption variants (each under 280 characters)

                Tone: professional yet friendly. Industry: service business.
                """;

            var (reply, tokens) = await CallClaudeAsync(ModelHaiku, systemPrompt, userMessage, ct);
            await RecordUsageAsync(orgId, null, "marketing", tokens);
            return reply;
        }

        public async Task<string> UpsellSuggestionsAsync(int orgId, int bookingId, CancellationToken ct = default)
        {
            if (!await HasBudgetAsync(orgId)) return "AI budget exceeded for this month.";

            var booking = await _db.Bookings.AsNoTracking()
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking == null) return "Booking not found.";

            var availablePackages = await _db.Packages.AsNoTracking()
                .Where(p => p.IsActive)
                .Select(p => new { p.Name, p.Tier, p.Price })
                .ToListAsync(ct);

            var bookedItems = booking.BookingItems.Select(i => i.Package?.Name ?? "Unknown").ToList();

            var systemPrompt = BuildCachedSystemPrompt("upsell");
            var userMessage = $"""
                Current booking items: {string.Join(", ", bookedItems)}
                Booking total: {booking.TotalAmount:F2} QAR
                Available packages: {JsonSerializer.Serialize(availablePackages)}

                Suggest 2-3 relevant add-ons or upgrades the customer might want.
                For each suggestion: name, reason (one sentence), and estimated value to customer.
                Format as a short bulleted list.
                """;

            var (reply, tokens) = await CallClaudeAsync(ModelHaiku, systemPrompt, userMessage, ct);
            await RecordUsageAsync(orgId, null, "upsell", tokens);
            return reply;
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        private static string BuildCachedSystemPrompt(string contextType)
        {
            return contextType switch
            {
                "crm" => "You are an expert CRM assistant for a service business. Analyze customer data and provide specific, actionable recommendations. Be concise and business-focused.",
                "insights" => "You are a business analytics expert. Analyze service business metrics and surface the most important insights, anomalies, and recommendations. Be data-driven and concise.",
                "marketing" => "You are an expert marketing copywriter for service businesses. Create compelling, conversion-focused copy tailored to the business's brand and target market.",
                "upsell" => "You are a sales optimization expert for service businesses. Suggest relevant upsells and add-ons based on the customer's current booking. Be specific and value-focused.",
                _ => "You are a helpful business assistant."
            };
        }

        private async Task<(string reply, int tokens)> CallClaudeAsync(
            string model, string systemPrompt, string userMessage, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_ANTHROPIC_API_KEY_HERE")
                return ("[AI not configured - set Anthropic:ApiKey in appsettings]", 0);

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("x-api-key", _apiKey);
            client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
            client.DefaultRequestHeaders.Add("anthropic-beta", "prompt-caching-2024-07-31");

            var body = new
            {
                model,
                max_tokens = 1024,
                system = new[]
                {
                    new
                    {
                        type = "text",
                        text = systemPrompt,
                        cache_control = new { type = "ephemeral" }
                    }
                },
                messages = new[] { new { role = "user", content = userMessage } }
            };

            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("https://api.anthropic.com/v1/messages", content, ct);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseBody);

            var text = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString() ?? string.Empty;

            var inputTokens = doc.RootElement.TryGetProperty("usage", out var usage)
                ? usage.GetProperty("input_tokens").GetInt32() + usage.GetProperty("output_tokens").GetInt32()
                : 0;

            return (text, inputTokens);
        }

        private async Task<bool> HasBudgetAsync(int orgId)
        {
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var used = await _db.AIConversations.AsNoTracking()
                .Where(c => c.OrgId == orgId && c.CreatedAt >= monthStart)
                .SumAsync(c => c.TotalTokensUsed);

            if (used >= MonthlyTokenBudgetPerOrg)
            {
                _logger.LogWarning("Org {OrgId} has exceeded monthly AI token budget ({Used}/{Budget})", orgId, used, MonthlyTokenBudgetPerOrg);
                return false;
            }
            return true;
        }

        private async Task RecordUsageAsync(int orgId, int? userId, string contextType, int tokens)
        {
            if (tokens <= 0) return;
            _db.AIConversations.Add(new AIConversation
            {
                OrgId = orgId,
                UserId = userId,
                ContextType = contextType,
                TotalTokensUsed = tokens,
                ExpiresAt = DateTime.UtcNow.AddDays(90)
            });
            await _db.SaveChangesAsync();
        }
    }
}
