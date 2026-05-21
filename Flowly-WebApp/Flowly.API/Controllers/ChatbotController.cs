using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.DTOs;
using System.Text;
using System.Text.Json;

namespace Flowly.API.Controllers
{
    /// <summary>
    /// AI chatbot endpoint.
    /// [MOCK] Replace with real Claude API key in appsettings.json under "Anthropic:ApiKey".
    /// When no key is configured, falls back to canned FAQ answers.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ChatbotController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        // Canned FAQ answers used when no Anthropic API key is set.
        private static readonly Dictionary<string, string> FaqAnswers = new(StringComparer.OrdinalIgnoreCase)
        {
            ["hello"]         = "Hi! I'm the Flowly assistant. I can help with bookings, services, pricing, and cancellations. What can I help you with?",
            ["hi"]            = "Hi! I'm the Flowly assistant. How can I help you today?",
            ["price"]         = "Our prices vary by vehicle type and package. Sedans start at the base price, SUVs at 1.25x, Pickups at 1.5x, and Motorcycles at 0.8x. Check the Packages screen for full pricing.",
            ["pricing"]       = "Pricing depends on your vehicle type and chosen package. You can view all packages and prices in the app.",
            ["cancel"]        = "To cancel a booking, go to My Bookings and tap 'Request Cancellation'. Note: a cancellation fee may apply depending on how close the appointment is.",
            ["cancellation"]  = "To cancel, go to My Bookings → Request Cancellation. A fee may apply if you cancel within the free cancellation window.",
            ["reschedule"]    = "To reschedule, go to My Bookings and tap 'Request Reschedule'. Our team will confirm the new time with you.",
            ["book"]          = "You can book a service from the Booking tab. Select a package, pick a date and time, and confirm.",
            ["address"]       = "You can save multiple addresses (Home, Work, Other) in your Profile. When booking, select which address to use.",
            ["payment"]       = "We accept credit/debit cards. Payment is pre-authorised at booking and captured on completion.",
            ["subscription"]  = "Monthly subscriptions give you 10% off. Select 'Monthly' in the booking flow and choose how many months.",
            ["hours"]         = "We operate from 9 AM to 6 PM daily. Slots are available in 1-hour windows.",
            ["contact"]       = "For urgent inquiries, please contact us at support@flowly.app.",
            ["refund"]        = "Refunds are processed after cancellation is approved by our team. This may take 3-5 business days.",
        };

        public ChatbotController(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        // POST api/Chatbot/chat
        [HttpPost("chat")]
        public async Task<ActionResult<ChatReplyDto>> Chat([FromBody] ChatMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "Message cannot be empty." });

            var apiKey = _configuration["Anthropic:ApiKey"];

            // [MOCK] If no API key configured, use canned answers
            if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR_ANTHROPIC_API_KEY_HERE")
            {
                var cannedReply = GetCannedAnswer(dto.Message);
                return Ok(new ChatReplyDto { Reply = cannedReply, IsAI = false });
            }

            // Build context from live data
            var systemPrompt = await BuildSystemPromptAsync();

            try
            {
                var reply = await CallClaudeAsync(apiKey, systemPrompt, dto.Message);
                return Ok(new ChatReplyDto { Reply = reply, IsAI = true });
            }
            catch
            {
                // Fallback to canned answers if API call fails
                return Ok(new ChatReplyDto { Reply = GetCannedAnswer(dto.Message), IsAI = false });
            }
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private async Task<string> BuildSystemPromptAsync()
        {
            var sb = new StringBuilder();

            // Pull business config for dynamic identity
            string businessName = "Flowly";
            string businessDesc = "a professional service booking platform";
            string supportEmail = "support@flowly.app";
            try
            {
                var bizSetting = await _context.SystemSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Key == "business.config");
                if (bizSetting != null && !string.IsNullOrWhiteSpace(bizSetting.Value))
                {
                    using var doc = JsonDocument.Parse(bizSetting.Value);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
                        businessName = nameEl.GetString() ?? businessName;
                    if (root.TryGetProperty("businessDescription", out var descEl) && descEl.ValueKind == JsonValueKind.String)
                        businessDesc = descEl.GetString() ?? businessDesc;
                    if (root.TryGetProperty("email", out var emailEl) && emailEl.ValueKind == JsonValueKind.String)
                        supportEmail = emailEl.GetString() ?? supportEmail;
                }
            }
            catch { /* non-critical */ }

            sb.AppendLine($"You are a helpful assistant for {businessName}, {businessDesc}.");
            sb.AppendLine("You answer customer questions about services, pricing, bookings, cancellations, and schedules.");
            sb.AppendLine("Be friendly, concise, and professional. Answer only questions about this business.");
            sb.AppendLine($"If you don't know something, say so and suggest they contact support at {supportEmail}.");
            sb.AppendLine();

            // Fetch live package data
            try
            {
                var packages = await _context.Packages
                    .Where(p => p.IsActive)
                    .Select(p => new { p.Name, p.Tier, p.Price, p.EstimatedDurationMinutes })
                    .AsNoTracking()
                    .ToListAsync();

                if (packages.Any())
                {
                    sb.AppendLine("=== CURRENT PACKAGES ===");
                    foreach (var pkg in packages)
                        sb.AppendLine($"- {pkg.Name} ({pkg.Tier}): {pkg.Price:F2} base, ~{pkg.EstimatedDurationMinutes} min");
                    sb.AppendLine();
                }
            }
            catch { /* non-critical */ }

            // Fetch resource types / pricing multipliers from vertical config
            try
            {
                var verticalSetting = await _context.SystemSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Key == "vertical.config");
                if (verticalSetting != null && !string.IsNullOrWhiteSpace(verticalSetting.Value))
                {
                    using var doc = JsonDocument.Parse(verticalSetting.Value);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("resourceLabelEn", out var labelEl))
                        sb.AppendLine($"=== {labelEl.GetString()?.ToUpperInvariant() ?? "RESOURCE"} PRICE MULTIPLIERS ===");
                    else
                        sb.AppendLine("=== RESOURCE PRICE MULTIPLIERS ===");

                    if (root.TryGetProperty("resources", out var resArr) && resArr.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var r in resArr.EnumerateArray())
                        {
                            var key  = r.TryGetProperty("key",       out var k) ? k.GetString() : "";
                            var mul  = r.TryGetProperty("multiplier", out var m) ? m.GetDecimal() : 1.0m;
                            sb.AppendLine($"- {key}: {mul}x");
                        }
                    }
                    sb.AppendLine();
                }
                else
                {
                    sb.AppendLine("=== VEHICLE PRICE MULTIPLIERS ===");
                    sb.AppendLine("Motorcycle: 0.8x | Sedan: 1.0x | SUV: 1.25x | Pickup: 1.5x");
                    sb.AppendLine();
                }
            }
            catch
            {
                sb.AppendLine("=== VEHICLE PRICE MULTIPLIERS ===");
                sb.AppendLine("Motorcycle: 0.8x | Sedan: 1.0x | SUV: 1.25x | Pickup: 1.5x");
                sb.AppendLine();
            }

            // Operating hours
            sb.AppendLine("=== OPERATING HOURS ===");
            sb.AppendLine("Daily 9:00 AM – 6:00 PM. Appointment slots are in 1-hour windows.");
            sb.AppendLine();

            sb.AppendLine("=== CANCELLATION POLICY ===");
            sb.AppendLine("Customers can request cancellation via the My Bookings screen. A cancellation fee may apply. The admin team reviews all cancellations.");
            sb.AppendLine();

            sb.AppendLine("Keep answers short (2-4 sentences). Do not discuss competitors or unrelated topics.");

            return sb.ToString();
        }

        private async Task<string> CallClaudeAsync(string apiKey, string systemPrompt, string userMessage)
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("x-api-key", apiKey);
            client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

            var body = new
            {
                model   = "claude-haiku-4-5-20251001",
                max_tokens = 512,
                system  = systemPrompt,
                messages = new[] { new { role = "user", content = userMessage } },
            };

            var json     = JsonSerializer.Serialize(body);
            var content  = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("https://api.anthropic.com/v1/messages", content);

            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            using var doc    = JsonDocument.Parse(responseBody);

            var text = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString();

            return text ?? "I couldn't generate a response. Please try again.";
        }

        private static string GetCannedAnswer(string message)
        {
            var lower = message.ToLowerInvariant();
            foreach (var kvp in FaqAnswers)
            {
                if (lower.Contains(kvp.Key))
                    return kvp.Value;
            }
            return "I'm not sure about that. For more help, contact us at support@flowly.app or check the Packages and My Bookings screens in the app.";
        }
    }
}
