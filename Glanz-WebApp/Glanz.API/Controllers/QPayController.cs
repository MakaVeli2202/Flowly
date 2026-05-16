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
    /// QPay payment gateway integration (Qatar national payment network).
    ///
    /// Flow:
    ///   1. POST /api/QPay/create-invoice   - creates a QPay invoice, returns paymentUrl
    ///   2. Customer pays on QPay page
    ///   3. GET  /api/QPay/verify/{invoiceId} - polls QPay to confirm payment
    ///   4. Webhook: POST /api/Webhooks/qpay (registered on QPay merchant portal)
    ///
    /// Config (appsettings): QPay:Username, QPay:Password, QPay:InvoiceCode, QPay:BaseUrl
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class QPayController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;

        public QPayController(AppDbContext context, IConfiguration config, IHttpClientFactory httpFactory)
        {
            _context = context;
            _config = config;
            _httpFactory = httpFactory;
        }

        [HttpPost("create-invoice")]
        public async Task<IActionResult> CreateInvoice([FromBody] QPayInvoiceRequestDto dto)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingNumber == dto.BookingNumber);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            if (booking.TotalAmount <= 0) return BadRequest(new { message = "Invalid booking amount." });

            var baseUrl = _config["QPay:BaseUrl"] ?? "https://api.qpay.qa/v2";
            var username = _config["QPay:Username"] ?? "";
            var password = _config["QPay:Password"] ?? "";
            var invoiceCode = _config["QPay:InvoiceCode"] ?? "FLOWLY_INVOICE";
            var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";

            if (string.IsNullOrWhiteSpace(username))
                return StatusCode(503, new { message = "QPay not configured." });

            try
            {
                var http = _httpFactory.CreateClient("QPay");
                // Step 1: Authenticate
                var authBytes = Encoding.UTF8.GetBytes($"{username}:{password}");
                var authHeader = Convert.ToBase64String(authBytes);
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                var tokenResp = await http.PostAsync($"{baseUrl}/auth/token", null);
                if (!tokenResp.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "QPay authentication failed." });

                var tokenJson = await tokenResp.Content.ReadAsStringAsync();
                using var tokenDoc = JsonDocument.Parse(tokenJson);
                var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString();

                // Step 2: Create invoice
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var payload = new
                {
                    invoice_code = invoiceCode,
                    sender = new { name = "Flowly" },
                    amount = booking.TotalAmount,
                    currency_code = "QAR",
                    description = $"Booking #{booking.BookingNumber}",
                    language = "en",
                    callback_url = $"{frontendUrl}/payment/qpay-callback",
                    success_url = $"{frontendUrl}/booking-success?ref={booking.BookingNumber}",
                    failed_url = $"{frontendUrl}/booking-failed?ref={booking.BookingNumber}",
                    cancel_url = $"{frontendUrl}/booking?ref={booking.BookingNumber}"
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var invoiceResp = await http.PostAsync($"{baseUrl}/invoices", content);
                var invoiceJson = await invoiceResp.Content.ReadAsStringAsync();

                if (!invoiceResp.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "QPay invoice creation failed.", details = invoiceJson });

                using var invoiceDoc = JsonDocument.Parse(invoiceJson);
                var invoiceId = invoiceDoc.RootElement.GetProperty("invoice_id").GetString();
                var paymentUrl = invoiceDoc.RootElement.GetProperty("qpay_shortlink").GetString();

                booking.StripePaymentIntentId = $"qpay_{invoiceId}";
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { invoiceId, paymentUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "QPay error.", error = ex.Message });
            }
        }

        [HttpGet("verify/{invoiceId}")]
        public async Task<IActionResult> VerifyPayment(string invoiceId)
        {
            var booking = await _context.Bookings
                .FirstOrDefaultAsync(b => b.StripePaymentIntentId == $"qpay_{invoiceId}");
            if (booking == null) return NotFound(new { message = "Booking not found." });

            // Already confirmed
            if (booking.PaymentStatus == PaymentStatus.Paid)
                return Ok(new { status = "PAID", bookingNumber = booking.BookingNumber });

            var baseUrl = _config["QPay:BaseUrl"] ?? "https://api.qpay.qa/v2";
            var username = _config["QPay:Username"] ?? "";
            var password = _config["QPay:Password"] ?? "";

            if (string.IsNullOrWhiteSpace(username))
                return StatusCode(503, new { message = "QPay not configured." });

            try
            {
                var http = _httpFactory.CreateClient("QPay");
                var authHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                var tokenResp = await http.PostAsync($"{baseUrl}/auth/token", null);
                var tokenJson = await tokenResp.Content.ReadAsStringAsync();
                using var tokenDoc = JsonDocument.Parse(tokenJson);
                var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString();
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                var checkResp = await http.GetAsync($"{baseUrl}/payment/check?invoice_id={invoiceId}&payment_method=all&release_amount=0");
                var checkJson = await checkResp.Content.ReadAsStringAsync();
                using var checkDoc = JsonDocument.Parse(checkJson);

                var paid = checkDoc.RootElement.TryGetProperty("count", out var countEl) && countEl.GetInt32() > 0;
                if (paid)
                {
                    booking.PaymentStatus = PaymentStatus.Paid;
                    booking.Status = BookingStatus.Confirmed;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                return Ok(new { status = paid ? "PAID" : "PENDING", bookingNumber = booking.BookingNumber });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "QPay verification error.", error = ex.Message });
            }
        }
    }

    public class QPayInvoiceRequestDto
    {
        [System.ComponentModel.DataAnnotations.Required]
        public string BookingNumber { get; set; } = string.Empty;
    }
}
