using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Glanz.API.Controllers
{
    /// <summary>
    /// Dibsy payment gateway integration (Qatar/MENA hosted checkout).
    ///
    /// Flow:
    ///   1. POST /api/Dibsy/create-checkout  - creates a Dibsy checkout session, returns paymentUrl
    ///   2. Customer pays on Dibsy-hosted page
    ///   3. GET  /api/Dibsy/verify/{paymentId} - checks status
    ///   4. Webhook: POST /api/Webhooks/dibsy (registered on Dibsy merchant portal)
    ///
    /// Config: Dibsy:ApiKey, Dibsy:BaseUrl
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class DibsyController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;

        public DibsyController(AppDbContext context, IConfiguration config, IHttpClientFactory httpFactory)
        {
            _context = context;
            _config = config;
            _httpFactory = httpFactory;
        }

        [HttpPost("create-checkout")]
        public async Task<IActionResult> CreateCheckout([FromBody] DibsyCheckoutRequestDto dto)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingNumber == dto.BookingNumber);
            if (booking == null) return NotFound(new { message = "Booking not found." });

            var apiKey = _config["Dibsy:ApiKey"] ?? "";
            var baseUrl = _config["Dibsy:BaseUrl"] ?? "https://api.dibsy.one/v1";
            var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";

            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(503, new { message = "Dibsy not configured." });

            try
            {
                var http = _httpFactory.CreateClient("Dibsy");
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var payload = new
                {
                    amount = (int)(booking.TotalAmount * 100), // Dibsy uses amount in smallest currency unit
                    currency = "QAR",
                    description = $"Booking #{booking.BookingNumber}",
                    redirectUrl = $"{frontendUrl}/payment/dibsy-callback?ref={booking.BookingNumber}",
                    reference = booking.BookingNumber
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await http.PostAsync($"{baseUrl}/checkout", content);
                var json = await resp.Content.ReadAsStringAsync();

                if (!resp.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "Dibsy checkout creation failed.", details = json });

                using var doc = JsonDocument.Parse(json);
                var paymentId = doc.RootElement.GetProperty("id").GetString();
                var paymentUrl = doc.RootElement.GetProperty("url").GetString();

                booking.StripePaymentIntentId = $"dibsy_{paymentId}";
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { paymentId, paymentUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Dibsy error.", error = ex.Message });
            }
        }

        [HttpGet("verify/{paymentId}")]
        public async Task<IActionResult> VerifyPayment(string paymentId)
        {
            var booking = await _context.Bookings
                .FirstOrDefaultAsync(b => b.StripePaymentIntentId == $"dibsy_{paymentId}");
            if (booking == null) return NotFound(new { message = "Booking not found." });

            if (booking.PaymentStatus == PaymentStatus.Paid)
                return Ok(new { status = "paid", bookingNumber = booking.BookingNumber });

            var apiKey = _config["Dibsy:ApiKey"] ?? "";
            var baseUrl = _config["Dibsy:BaseUrl"] ?? "https://api.dibsy.one/v1";

            if (string.IsNullOrWhiteSpace(apiKey))
                return StatusCode(503, new { message = "Dibsy not configured." });

            try
            {
                var http = _httpFactory.CreateClient("Dibsy");
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var resp = await http.GetAsync($"{baseUrl}/checkout/{paymentId}");
                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                var status = doc.RootElement.TryGetProperty("status", out var statusEl)
                    ? statusEl.GetString() : "unknown";

                if (status == "paid" || status == "succeeded")
                {
                    booking.PaymentStatus = PaymentStatus.Paid;
                    booking.Status = BookingStatus.Confirmed;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                return Ok(new { status, bookingNumber = booking.BookingNumber });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Dibsy verification error.", error = ex.Message });
            }
        }
    }

    public class DibsyCheckoutRequestDto
    {
        [System.ComponentModel.DataAnnotations.Required]
        public string BookingNumber { get; set; } = string.Empty;
    }
}
