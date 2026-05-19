using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Flowly.API.Controllers
{
    /// <summary>
    /// Tap Payments webhook receiver â€” async safety net for payment lifecycle events.
    ///
    /// Register this endpoint in the Tap Payments dashboard:
    ///   URL: POST https://yourdomain.com/api/Webhooks/tap
    ///   Events: CAPTURED, FAILED, CANCELLED
    ///
    /// Set Tap:WebhookSecret in appsettings / Render env vars to the signing key
    /// shown in the Tap dashboard so every payload is verified before processing.
    ///
    /// NO [Authorize] â€” Tap does not send auth headers.
    /// Security comes from HMAC-SHA256 signature verification.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext    _context;
        private readonly IConfiguration _configuration;

        public WebhooksController(AppDbContext context, IConfiguration configuration)
        {
            _context       = context;
            _configuration = configuration;
        }

        [HttpPost("tap")]
        public async Task<IActionResult> TapWebhook()
        {
            var json = await new StreamReader(Request.Body).ReadToEndAsync();

            var webhookSecret = _configuration["TapPayments:WebhookSecret"];

            // If a webhook secret is configured, verify the HMAC-SHA256 signature.
            // Tap sends the signature in the "hashstring" header.
            if (!string.IsNullOrWhiteSpace(webhookSecret))
            {
                var tapSignature = Request.Headers["hashstring"].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(tapSignature))
                {
                    Console.WriteLine("[Webhook/Tap] Missing hashstring header.");
                    return BadRequest(new { message = "Missing webhook signature." });
                }

                using var hmac         = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
                var computedHash       = hmac.ComputeHash(Encoding.UTF8.GetBytes(json));
                var computedSignature  = Convert.ToHexString(computedHash).ToLowerInvariant();

                if (!computedSignature.Equals(tapSignature, StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine("[Webhook/Tap] Signature mismatch â€” possible forged request.");
                    return BadRequest(new { message = "Invalid webhook signature." });
                }
            }

            try
            {
                using var doc  = JsonDocument.Parse(json);
                var root       = doc.RootElement;
                var status     = root.TryGetProperty("status", out var statusEl) ? statusEl.GetString() ?? "" : "";
                var chargeId   = root.TryGetProperty("id",     out var idEl)     ? idEl.GetString()     ?? "" : "";

                if (string.IsNullOrWhiteSpace(chargeId))
                {
                    return Ok(); // ignore unrecognised payloads
                }

                var upperStatus = status.ToUpperInvariant();
                switch (upperStatus)
                {
                    case "CAPTURED":
                    case "AUTHORIZED":
                        await HandlePaymentSucceededAsync(chargeId);
                        break;

                    case "FAILED":
                    case "DECLINED":
                        await HandlePaymentFailedAsync(chargeId);
                        break;

                    case "CANCELLED":
                        await HandlePaymentCancelledAsync(chargeId);
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Webhook/Tap] Handler error: {ex.Message}");
                // Return 200 so Tap doesn't keep retrying â€” log for investigation.
            }

            return Ok();
        }

        // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        private async Task HandlePaymentSucceededAsync(string chargeId)
        {
            var booking = await FindBookingByChargeIdAsync(chargeId);
            if (booking == null) return;

            if (booking.Status == BookingStatus.Pending)
            {
                booking.Status        = BookingStatus.Confirmed;
                booking.PaymentStatus = PaymentStatus.Paid;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook/Tap] Booking {booking.BookingNumber} confirmed via charge {chargeId}.");
            }
        }

        private async Task HandlePaymentFailedAsync(string chargeId)
        {
            var booking = await FindBookingByChargeIdAsync(chargeId);
            if (booking == null) return;

            if (booking.PaymentStatus != PaymentStatus.Paid)
            {
                booking.PaymentStatus = PaymentStatus.Failed;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook/Tap] Booking {booking.BookingNumber} payment failed (charge {chargeId}).");
            }
        }

        private async Task HandlePaymentCancelledAsync(string chargeId)
        {
            var booking = await FindBookingByChargeIdAsync(chargeId);
            if (booking == null) return;

            if (booking.Status == BookingStatus.Pending)
            {
                booking.Status        = BookingStatus.Cancelled;
                booking.PaymentStatus = PaymentStatus.Failed;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook/Tap] Booking {booking.BookingNumber} cancelled (charge {chargeId}).");
            }
        }

        // StripePaymentIntentId column is reused to store the Tap charge ID.
        private async Task<Booking?> FindBookingByChargeIdAsync(string chargeId)
        {
            if (string.IsNullOrWhiteSpace(chargeId)) return null;
            return await _context.Bookings
                .FirstOrDefaultAsync(b => b.StripePaymentIntentId == chargeId);
        }
    }
}

