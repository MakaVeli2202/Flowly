using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Flowly.API.Controllers
{
    /// <summary>
    /// SEPA Direct Debit via Stripe (European bank transfer for Austria/EU customers).
    ///
    /// Flow:
    ///   1. POST /api/Sepa/setup-intent      - creates a Stripe SetupIntent for SEPA mandate
    ///   2. Frontend uses Stripe.js to collect IBAN + confirm SetupIntent
    ///   3. POST /api/Sepa/charge/{bookingNumber} - charges the stored payment method
    ///   4. Stripe sends webhook to /api/Webhooks/stripe on payment success/failure
    ///
    /// Config: Stripe:SecretKey, Stripe:WebhookSecret
    /// Graceful: returns 503 if Stripe:SecretKey not configured.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SepaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<SepaController> _logger;

        private const string StripeApiBase = "https://api.stripe.com/v1";

        public SepaController(AppDbContext context, IConfiguration config, IHttpClientFactory httpFactory, ILogger<SepaController> logger)
        {
            _context = context;
            _config = config;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        private HttpClient CreateStripeClient()
        {
            var http = _httpFactory.CreateClient("Stripe");
            var key = _config["Stripe:SecretKey"] ?? "";
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
            return http;
        }

        private bool IsConfigured => !string.IsNullOrWhiteSpace(_config["Stripe:SecretKey"]);

        /// <summary>Create a SetupIntent so the customer can register their IBAN for future charges.</summary>
        [HttpPost("setup-intent")]
        public async Task<IActionResult> CreateSetupIntent()
        {
            if (!IsConfigured) return StatusCode(503, new { message = "Stripe not configured." });

            var userId = User.GetCurrentUserId();
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            try
            {
                var http = CreateStripeClient();
                var body = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["payment_method_types[]"] = "sepa_debit",
                    ["customer_email"] = user.Email ?? "",
                    ["metadata[user_id]"] = userId.ToString(),
                });
                var resp = await http.PostAsync($"{StripeApiBase}/setup_intents", body);
                var json = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "Stripe SetupIntent failed.", details = json });

                using var doc = JsonDocument.Parse(json);
                return Ok(new
                {
                    clientSecret = doc.RootElement.GetProperty("client_secret").GetString(),
                    setupIntentId = doc.RootElement.GetProperty("id").GetString(),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SEPA setup-intent error");
                return StatusCode(500, new { message = "SEPA setup error.", error = ex.Message });
            }
        }

        /// <summary>Charge the customer's saved SEPA payment method for a booking.</summary>
        [HttpPost("charge/{bookingNumber}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ChargeBooking(string bookingNumber, [FromBody] SepaChargeDto dto)
        {
            if (!IsConfigured) return StatusCode(503, new { message = "Stripe not configured." });

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingNumber == bookingNumber);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            if (booking.TotalAmount <= 0) return BadRequest(new { message = "Invalid booking amount." });

            try
            {
                var http = CreateStripeClient();
                // Amount in cents (EUR)
                var amountCents = (int)Math.Round(booking.TotalAmount * 100);
                var body = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["amount"] = amountCents.ToString(),
                    ["currency"] = "eur",
                    ["payment_method"] = dto.PaymentMethodId,
                    ["payment_method_types[]"] = "sepa_debit",
                    ["confirm"] = "true",
                    ["description"] = $"Flowly Booking {booking.BookingNumber}",
                    ["metadata[booking_number]"] = booking.BookingNumber,
                    ["mandate_data[customer_acceptance][type]"] = "online",
                    ["mandate_data[customer_acceptance][online][ip_address]"] = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0",
                    ["mandate_data[customer_acceptance][online][user_agent]"] = Request.Headers.UserAgent.ToString(),
                });
                var resp = await http.PostAsync($"{StripeApiBase}/payment_intents", body);
                var json = await resp.Content.ReadAsStringAsync();

                if (!resp.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "SEPA charge failed.", details = json });

                using var doc = JsonDocument.Parse(json);
                var piId = doc.RootElement.GetProperty("id").GetString();
                var status = doc.RootElement.GetProperty("status").GetString();

                booking.StripePaymentIntentId = piId;
                if (status == "succeeded") booking.PaymentStatus = PaymentStatus.Paid;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { paymentIntentId = piId, status, bookingNumber });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SEPA charge error for {BookingNumber}", bookingNumber);
                return StatusCode(500, new { message = "SEPA charge error.", error = ex.Message });
            }
        }
    }

    public class SepaChargeDto
    {
        public string PaymentMethodId { get; set; } = string.Empty;
    }
}
