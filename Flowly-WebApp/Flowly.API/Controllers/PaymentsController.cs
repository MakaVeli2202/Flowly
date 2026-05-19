using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Flowly.API.Controllers
{
    /// <summary>
    /// Server-side wrapper for Tap Payments charge lifecycle.
    /// Tap Payments is the leading gateway in Qatar / GCC.
    ///
    /// Flow:
    ///   1. POST /api/Payments/create-charge  – creates a Tap charge + slot reservation,
    ///      returns { chargeId, redirectUrl } so the frontend can redirect the customer to Tap.
    ///   2. Customer pays on the Tap-hosted page.
    ///   3. Tap redirects back to redirect_url with ?tap_id=<chargeId>.
    ///   4. GET  /api/Payments/verify/{chargeId} – verifies the charge status with Tap and
    ///      updates the booking payment status accordingly.
    ///
    /// Webhooks (POST /api/Webhooks/tap) provide an async safety net for the same events.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentsController : ControllerBase
    {
        private const int SlotHoldMinutes = 15;
        private const string TapApiBase   = "https://api.tap.company/v2";

        private readonly AppDbContext        _context;
        private readonly IConfiguration      _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly IHttpClientFactory  _httpClientFactory;

        public PaymentsController(
            AppDbContext context,
            IConfiguration configuration,
            IWebHostEnvironment env,
            IHttpClientFactory httpClientFactory)
        {
            _context           = context;
            _configuration     = configuration;
            _env               = env;
            _httpClientFactory = httpClientFactory;
        }

        /// <summary>
        /// Creates a Tap charge and reserves the time slot.
        ///
        /// POST /api/Payments/create-charge
        /// Body: { currency, durationMinutes, customerEmail, bookingNumber, redirectUrl }
        ///
        /// The charge amount is always derived server-side from the booking record —
        /// never from the client payload — to prevent price manipulation.
        ///
        /// Returns: { chargeId, redirectUrl, amount, currency }
        /// </summary>
        [HttpPost("create-charge")]
        public async Task<IActionResult> CreateCharge([FromBody] CreateChargeDto dto)
        {
            var isDevLoopback = _env.IsDevelopment()
                && _configuration.GetValue<bool>("DevBypass:AllowDevBypass");
            if (!isDevLoopback && !(User.Identity?.IsAuthenticated ?? false))
                return Unauthorized(new { message = "Authentication required." });

            if (string.IsNullOrWhiteSpace(dto.BookingNumber))
                return BadRequest(new { message = "bookingNumber is required." });

            if (string.IsNullOrWhiteSpace(dto.RedirectUrl))
                return BadRequest(new { message = "redirectUrl is required." });

            // Always derive the charge amount from the server-side booking record.
            // Never trust any client-supplied amount — it can be tampered with.
            var booking = await _context.Bookings
                .FirstOrDefaultAsync(b => b.BookingNumber == dto.BookingNumber);
            if (booking == null)
                return BadRequest(new { message = "Booking not found." });
            if (booking.PaymentStatus == PaymentStatus.Paid)
                return BadRequest(new { message = "This booking has already been paid." });

            var chargeAmount = Math.Round(booking.TotalAmount, 2);
            if (chargeAmount <= 0)
                return BadRequest(new { message = "Booking total amount is invalid." });

            var secretKey = _configuration["TapPayments:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey) || secretKey == "YOUR_TAP_SECRET_KEY")
                return StatusCode(503, new { message = "Payment gateway not configured." });

            try
            {
                // Encode the booking number into the redirect URL so the frontend can
                // retrieve it on return without extra state management.
                var sep             = dto.RedirectUrl.Contains('?') ? '&' : '?';
                var fullRedirectUrl = $"{dto.RedirectUrl}{sep}booking={Uri.EscapeDataString(dto.BookingNumber)}";

                var chargeBody = new
                {
                    amount             = chargeAmount,
                    currency           = (dto.Currency ?? "QAR").ToUpperInvariant(),
                    customer_initiated = true,
                    threeDSecure       = true,
                    save_card          = false,
                    description        = $"Flowly Car Detailing – {dto.BookingNumber}",
                    metadata = new
                    {
                        booking_number = dto.BookingNumber,
                        scheduled_date = booking.ScheduledDate.ToString("yyyy-MM-dd"),
                        time_slot      = booking.TimeSlot ?? "",
                    },
                    customer = new { email = dto.CustomerEmail ?? booking.CustomerEmail ?? "" },
                    source   = new { id = "src_all" }, // accept all payment methods
                    redirect = new { url = fullRedirectUrl },
                };

                using var http = _httpClientFactory.CreateClient();
                http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", secretKey);
                http.DefaultRequestHeaders.Accept.Add(
                    new MediaTypeWithQualityHeaderValue("application/json"));

                var body     = JsonSerializer.Serialize(chargeBody);
                var content  = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
                var response = await http.PostAsync($"{TapApiBase}/charges", content);
                var raw      = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[PaymentsController] Tap error: {raw}");
                    return StatusCode(502, new { message = "Payment provider error. Please try again." });
                }

                using var doc      = JsonDocument.Parse(raw);
                var root           = doc.RootElement;
                var chargeId       = root.TryGetProperty("id",  out var idEl)  ? idEl.GetString()  : null;
                var tapRedirectUrl = root.TryGetProperty("transaction", out var tx)
                    && tx.TryGetProperty("url", out var urlEl)
                    ? urlEl.GetString() : null;

                if (string.IsNullOrWhiteSpace(chargeId) || string.IsNullOrWhiteSpace(tapRedirectUrl))
                    return StatusCode(502, new { message = "Payment gateway did not return a redirect URL." });

                // Store the Tap charge ID on the booking record.
                booking.StripePaymentIntentId = chargeId; // column reused for Tap charge ID
                booking.UpdatedAt             = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Reserve the slot for SlotHoldMinutes to block concurrent bookings during checkout.
                _context.SlotReservations.Add(new SlotReservation
                {
                    PaymentIntentId = chargeId,
                    ScheduledDate   = DateTime.SpecifyKind(booking.ScheduledDate.Date, DateTimeKind.Utc),
                    TimeSlot        = (booking.TimeSlot ?? "").Trim(),
                    DurationMinutes = dto.DurationMinutes,
                    CustomerEmail   = (dto.CustomerEmail ?? booking.CustomerEmail ?? "").Trim().ToLowerInvariant(),
                    ExpiresAt       = DateTime.UtcNow.AddMinutes(SlotHoldMinutes),
                    CreatedAt       = DateTime.UtcNow,
                });
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    chargeId,
                    redirectUrl = tapRedirectUrl,
                    amount      = chargeAmount,
                    currency    = dto.Currency ?? "QAR",
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PaymentsController] Tap error: {ex.Message}");
                return StatusCode(502, new { message = "Payment provider error. Please try again." });
            }
        }

        /// <summary>
        /// Verifies a Tap charge status and updates the booking if payment succeeded.
        ///
        /// GET /api/Payments/verify/{chargeId}
        /// Returns: { chargeId, status, amount, bookingNumber }
        /// </summary>
        [HttpGet("verify/{chargeId}")]
        public async Task<IActionResult> VerifyCharge(string chargeId)
        {
            var isDevLoopback = _env.IsDevelopment()
                && _configuration.GetValue<bool>("DevBypass:AllowDevBypass");
            if (!isDevLoopback && !(User.Identity?.IsAuthenticated ?? false))
                return Unauthorized(new { message = "Authentication required." });

            if (string.IsNullOrWhiteSpace(chargeId))
                return BadRequest(new { message = "chargeId is required." });

            var secretKey = _configuration["TapPayments:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey) || secretKey == "YOUR_TAP_SECRET_KEY")
                return StatusCode(503, new { message = "Payment gateway not configured." });

            try
            {
                using var http = _httpClientFactory.CreateClient();
                http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", secretKey);

                var response = await http.GetAsync($"{TapApiBase}/charges/{Uri.EscapeDataString(chargeId)}");
                var raw      = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                    return StatusCode(502, new { message = "Payment verification failed." });

                using var doc = JsonDocument.Parse(raw);
                var root      = doc.RootElement;
                var status    = root.TryGetProperty("status", out var statusEl) ? statusEl.GetString() ?? "UNKNOWN" : "UNKNOWN";
                var amount    = root.TryGetProperty("amount", out var amtEl)    ? amtEl.GetDecimal()   : 0m;

                var booking = await _context.Bookings
                    .FirstOrDefaultAsync(b => b.StripePaymentIntentId == chargeId);

                if (booking != null)
                {
                    var upperStatus = status.ToUpperInvariant();
                    if (upperStatus is "CAPTURED" or "AUTHORIZED")
                    {
                        if (booking.Status == BookingStatus.Pending)
                        {
                            booking.Status        = BookingStatus.Confirmed;
                            booking.PaymentStatus = PaymentStatus.Paid;
                            booking.UpdatedAt     = DateTime.UtcNow;
                            await _context.SaveChangesAsync();
                            Console.WriteLine($"[Verify] Booking {booking.BookingNumber} confirmed via charge {chargeId}.");
                        }
                    }
                    else if (upperStatus is "FAILED" or "DECLINED" or "CANCELLED")
                    {
                        if (booking.PaymentStatus != PaymentStatus.Paid)
                        {
                            booking.PaymentStatus = PaymentStatus.Failed;
                            booking.UpdatedAt     = DateTime.UtcNow;
                            await _context.SaveChangesAsync();
                        }
                    }
                }

                return Ok(new
                {
                    chargeId,
                    status,
                    amount,
                    bookingNumber = booking?.BookingNumber,
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PaymentsController] Tap verify error: {ex.Message}");
                return StatusCode(502, new { message = "Payment verification error." });
            }
        }
    }

    /// <summary>
    /// Note: Amount and ScheduledDate are intentionally absent.
    /// The charge amount is always derived server-side from the booking record.
    /// </summary>
    public class CreateChargeDto
    {
        public string?   Currency        { get; set; }
        public int       DurationMinutes { get; set; }
        public string?   CustomerEmail   { get; set; }
        public string?   BookingNumber   { get; set; }
        public string?   RedirectUrl     { get; set; }
    }
}
