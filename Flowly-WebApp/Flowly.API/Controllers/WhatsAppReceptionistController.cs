using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Platform.Messaging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Flowly.API.Controllers
{
    /// <summary>
    /// WhatsApp AI Receptionist via Infobip Business API.
    ///
    /// Flow:
    ///   1. Customer messages the WhatsApp Business number.
    ///   2. Infobip calls POST /api/WhatsAppReceptionist/webhook (configure in Infobip portal).
    ///   3. This handler classifies intent and replies via Infobip send API.
    ///
    /// Intent classification order:
    ///   - cancel / storno            → guide to app My Bookings
    ///   - status / where / when      → look up latest booking by phone
    ///   - price / cost / how much    → return package list
    ///   - book / appointment / slot  → return booking URL
    ///   - default                    → call Claude Haiku (Anthropic:ApiKey) or canned answer
    ///
    /// Config: Infobip:ApiKey, Infobip:BaseUrl, Infobip:WhatsAppSender
    /// Graceful: returns 200 (empty body) when Infobip not configured so Infobip won't retry.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppReceptionistController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<WhatsAppReceptionistController> _logger;

        private const string InfobipWaEndpoint = "/whatsapp/1/message/text";

        public WhatsAppReceptionistController(
            AppDbContext context,
            IConfiguration config,
            IHttpClientFactory httpFactory,
            ILogger<WhatsAppReceptionistController> logger)
        {
            _context = context;
            _config = config;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        private bool IsConfigured =>
            !string.IsNullOrWhiteSpace(_config["Infobip:ApiKey"]) &&
            !string.IsNullOrWhiteSpace(_config["Infobip:WhatsAppSender"]);

        /// <summary>Infobip calls this when a customer sends a WhatsApp message.</summary>
        [HttpPost("webhook")]
        public async Task<IActionResult> Webhook()
        {
            if (!IsConfigured)
            {
                _logger.LogWarning("WhatsApp webhook received but Infobip is not configured. Skipping.");
                return Ok();
            }

            string body;
            try
            {
                using var reader = new StreamReader(Request.Body, Encoding.UTF8);
                body = await reader.ReadToEndAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WhatsApp webhook: failed to read body");
                return Ok();
            }

            _logger.LogDebug("WhatsApp webhook payload: {Body}", body);

            InfobipWebhookPayload? payload;
            try
            {
                payload = JsonSerializer.Deserialize<InfobipWebhookPayload>(body,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WhatsApp webhook: JSON parse error");
                return Ok();
            }

            if (payload?.Results == null || payload.Results.Length == 0)
                return Ok();

            foreach (var result in payload.Results)
            {
                var from = result.From;
                var text = result.Message?.Text?.Trim() ?? string.Empty;

                if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(text))
                    continue;

                _logger.LogInformation("WhatsApp message from {From}: {Text}", from, text);

                try
                {
                    var reply = await BuildReplyAsync(from, text);
                    await SendWhatsAppAsync(from, reply);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "WhatsApp receptionist: error handling message from {From}", from);
                }
            }

            return Ok();
        }

        // ── Intent classification + reply generation ───────────────────────────

        private async Task<string> BuildReplyAsync(string from, string text)
        {
            var lower = text.ToLowerInvariant();

            // Cancel intent
            if (ContainsAny(lower, "cancel", "storno", "annul", "ألغ", "إلغاء", "Stornierung"))
                return "To cancel a booking, open the Flowly app, go to My Bookings, and tap 'Request Cancellation'. Our team will review it. A cancellation fee may apply if it is within the notice window.";

            // Status / tracking intent
            if (ContainsAny(lower, "status", "where", "when", "my booking", "appointment", "حجز", "متى", "أين", "wann", "wo ist"))
            {
                var statusReply = await GetBookingStatusReply(from);
                if (statusReply != null) return statusReply;
            }

            // Price inquiry
            if (ContainsAny(lower, "price", "cost", "how much", "rate", "cheap", "expensive",
                "pricing", "سعر", "تكلفة", "Preis", "kosten", "Angebot"))
                return await GetPricingReply();

            // Booking / appointment intent
            if (ContainsAny(lower, "book", "appointment", "schedule", "reserve", "slot",
                "احجز", "حجز", "موعد", "termin", "buchen", "reservier"))
                return GetBookingLinkReply();

            // Hours / availability
            if (ContainsAny(lower, "hour", "open", "available", "time", "ساعة", "متاح", "Öffnungszeit"))
                return "We operate daily from 9:00 AM to 6:00 PM. You can pick any available 1-hour slot when booking through the Flowly app.";

            // Greeting
            if (ContainsAny(lower, "hello", "hi", "hey", "مرحبا", "السلام", "Hallo", "Guten Tag"))
                return "Hello! I'm the Flowly AI receptionist. I can help with bookings, pricing, booking status, and cancellations. How can I help you today?";

            // Fall back to Claude if API key is set, otherwise canned default
            return await CallClaudeOrDefaultAsync(text);
        }

        private async Task<string?> GetBookingStatusReply(string phone)
        {
            // Normalize phone: strip non-digits, use last 8 digits for fuzzy match
            var digits = new string(phone.Where(char.IsDigit).ToArray());
            var suffix = digits.Length > 8 ? digits.Substring(digits.Length - 8) : digits;

            // Load all bookings with a phone, then match in memory (EF can't translate range indexers)
            var candidates = await _context.Bookings
                .Where(b => b.CustomerPhone != null && b.CustomerPhone != "")
                .OrderByDescending(b => b.ScheduledDate)
                .Select(b => new { b.BookingNumber, b.ScheduledDate, b.TimeSlot, b.Status, b.CustomerName, b.CustomerPhone })
                .Take(500)
                .ToListAsync();

            var booking = candidates
                .FirstOrDefault(b => (b.CustomerPhone ?? "").Replace("+", "").Replace(" ", "").EndsWith(suffix));

            if (booking == null)
                return null;

            var firstName = booking.CustomerName?.Split(' ').FirstOrDefault() ?? "there";
            return $"Hi {firstName}! Your latest booking is #{booking.BookingNumber} on {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}. Status: {booking.Status}. For full details, check the Flowly app under My Bookings.";
        }

        private async Task<string> GetPricingReply()
        {
            try
            {
                var packages = await _context.Packages
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.Price)
                    .Select(p => new { p.Name, p.Price })
                    .AsNoTracking()
                    .ToListAsync();

                if (packages.Count == 0)
                    return "Our packages vary by vehicle type and service level. Visit the Flowly app to see current pricing.";

                var lines = packages.Take(6).Select(p => $"- {p.Name}: {p.Price:F2} QAR (Sedan base)");
                return "Here are our current packages:\n" + string.Join("\n", lines) +
                       "\n\nPrices vary by vehicle type: SUV +25%, Pickup +50%, Motorcycle -20%. Book via the Flowly app.";
            }
            catch
            {
                return "Our packages vary by vehicle type and service level. Visit the Flowly app to see current pricing.";
            }
        }

        private static string GetBookingLinkReply()
        {
            return "To book a service, open the Flowly app and go to the Booking section. Select your package, date, time, and confirm. If you don't have the app, visit our website to book online.";
        }

        private async Task<string> CallClaudeOrDefaultAsync(string userMessage)
        {
            var apiKey = _config["Anthropic:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR_ANTHROPIC_API_KEY_HERE")
                return "I'm not sure about that. For more help, contact us via the Flowly app or reply with 'book', 'price', 'status', or 'cancel'.";

            try
            {
                var http = _httpFactory.CreateClient();
                http.DefaultRequestHeaders.Add("x-api-key", apiKey);
                http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                var systemPrompt = "You are a WhatsApp AI receptionist for Flowly, a professional mobile car detailing service. " +
                    "Reply in the same language the customer used. Keep replies under 4 sentences. " +
                    "Only answer questions about car detailing services, pricing, bookings, cancellations, and schedules. " +
                    "If asked about anything else, politely redirect to car detailing topics.";

                var body = JsonSerializer.Serialize(new
                {
                    model = "claude-haiku-4-5-20251001",
                    max_tokens = 300,
                    system = systemPrompt,
                    messages = new[] { new { role = "user", content = userMessage } },
                });

                var resp = await http.PostAsync("https://api.anthropic.com/v1/messages",
                    new StringContent(body, Encoding.UTF8, "application/json"));

                if (!resp.IsSuccessStatusCode) throw new Exception($"Claude API returned {(int)resp.StatusCode}");

                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString()
                    ?? "I couldn't generate a response. Try 'book', 'price', 'status', or 'cancel'.";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WhatsApp receptionist: Claude API call failed, using default reply");
                return "I'm not sure about that. For more help, contact us via the Flowly app or reply with 'book', 'price', 'status', or 'cancel'.";
            }
        }

        // ── Infobip send ───────────────────────────────────────────────────────

        private async Task SendWhatsAppAsync(string to, string message)
        {
            var apiKey = _config["Infobip:ApiKey"]!;
            var sender = _config["Infobip:WhatsAppSender"]!;
            var baseUrl = _config["Infobip:BaseUrl"] ?? "https://api.infobip.com";

            var payload = JsonSerializer.Serialize(new
            {
                from = sender,
                to,
                content = new { text = message },
            });

            var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}{InfobipWaEndpoint}")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("App", apiKey);

            var http = _httpFactory.CreateClient("Infobip");
            var resp = await http.SendAsync(req);

            if (!resp.IsSuccessStatusCode)
                _logger.LogWarning("WhatsApp send failed: {Status}", (int)resp.StatusCode);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static bool ContainsAny(string text, params string[] keywords)
            => keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    // ── Infobip webhook DTOs ───────────────────────────────────────────────────

    public class InfobipWebhookPayload
    {
        public InfobipWebhookResult[]? Results { get; set; }
    }

    public class InfobipWebhookResult
    {
        public string? From { get; set; }
        public string? To { get; set; }
        public InfobipWebhookMessage? Message { get; set; }
        public InfobipWebhookContact? Contact { get; set; }
    }

    public class InfobipWebhookMessage
    {
        public string? Type { get; set; }
        public string? Text { get; set; }
    }

    public class InfobipWebhookContact
    {
        public string? Name { get; set; }
    }
}
