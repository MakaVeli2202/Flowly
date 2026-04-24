using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Stripe;

namespace Glanz.API.Controllers
{
    /// <summary>
    /// Stripe webhook receiver — safety net for payment lifecycle events.
    ///
    /// Register this endpoint in the Stripe Dashboard:
    ///   URL: POST https://yourdomain.com/api/Webhooks/stripe
    ///   Events to listen for:
    ///     • payment_intent.payment_failed
    ///     • payment_intent.succeeded
    ///     • payment_intent.canceled
    ///
    /// After registering, copy the "Signing secret" from the dashboard to
    /// appsettings.json → Stripe:WebhookSecret.
    ///
    /// NO [Authorize] — Stripe does not send auth headers.
    /// Security comes from verifying the Stripe-Signature header.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WebhooksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public WebhooksController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("stripe")]
        public async Task<IActionResult> StripeWebhook()
        {
            // ── Read raw body (must happen before any other middleware consumes it) ──
            var json = await new StreamReader(Request.Body).ReadToEndAsync();

            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                // Webhook secret not configured — log and accept to avoid Stripe retries
                // during development. In production this key MUST be set.
                Console.WriteLine("[Webhook] WARNING: Stripe:WebhookSecret is not configured. Skipping signature verification.");
                return Ok();
            }

            // ── Verify signature ────────────────────────────────────────────────────
            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    Request.Headers["Stripe-Signature"],
                    webhookSecret,
                    throwOnApiVersionMismatch: false);
            }
            catch (StripeException ex)
            {
                Console.WriteLine($"[Webhook] Signature verification failed: {ex.Message}");
                return BadRequest(new { message = "Invalid Stripe signature." });
            }

            // ── Handle events ───────────────────────────────────────────────────────
            try
            {
                switch (stripeEvent.Type)
                {
                    case "payment_intent.succeeded":
                        await HandlePaymentSucceededAsync(stripeEvent);
                        break;

                    case "payment_intent.payment_failed":
                        await HandlePaymentFailedAsync(stripeEvent);
                        break;

                    case "payment_intent.canceled":
                        await HandlePaymentCanceledAsync(stripeEvent);
                        break;

                    default:
                        // Unhandled event type — acknowledge so Stripe doesn't retry
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Webhook] Handler error for {stripeEvent.Type}: {ex.Message}");
                // Return 200 anyway so Stripe doesn't keep retrying. Log the error for investigation.
            }

            return Ok();
        }

        // ── Handlers ─────────────────────────────────────────────────────────────────

        /// <summary>
        /// payment_intent.succeeded: if the booking is still Pending, move it to Confirmed.
        /// This handles the edge case where payment succeeded but the mobile app crashed
        /// before calling CreateBooking.
        ///
        /// Note: In the normal happy path the booking is created via POST /Bookings *after*
        /// presentPaymentSheet succeeds, so the booking may already be Confirmed by the time
        /// this webhook fires. That's fine — the guard below handles it safely.
        /// </summary>
        private async Task HandlePaymentSucceededAsync(Event stripeEvent)
        {
            if (stripeEvent.Data.Object is not PaymentIntent intent) return;

            var booking = await FindBookingByIntentIdAsync(intent.Id);
            if (booking == null) return;

            if (booking.Status == BookingStatus.Pending)
            {
                booking.Status        = BookingStatus.Confirmed;
                booking.PaymentStatus = PaymentStatus.Paid;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook] Booking {booking.BookingNumber} confirmed via payment_intent.succeeded.");
            }
        }

        /// <summary>
        /// payment_intent.payment_failed: mark the booking payment as Failed so admin
        /// can see it in the dashboard and follow up. The booking remains in Pending so
        /// it can be re-attempted (do not cancel automatically — the customer may retry).
        /// </summary>
        private async Task HandlePaymentFailedAsync(Event stripeEvent)
        {
            if (stripeEvent.Data.Object is not PaymentIntent intent) return;

            var booking = await FindBookingByIntentIdAsync(intent.Id);
            if (booking == null) return;

            if (booking.PaymentStatus != PaymentStatus.Paid)
            {
                booking.PaymentStatus = PaymentStatus.Failed;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook] Booking {booking.BookingNumber} payment failed.");
            }
        }

        /// <summary>
        /// payment_intent.canceled: Stripe canceled the intent (e.g., expired after 24 h).
        /// Move the booking to Cancelled so the slot is freed.
        /// </summary>
        private async Task HandlePaymentCanceledAsync(Event stripeEvent)
        {
            if (stripeEvent.Data.Object is not PaymentIntent intent) return;

            var booking = await FindBookingByIntentIdAsync(intent.Id);
            if (booking == null) return;

            if (booking.Status == BookingStatus.Pending)
            {
                booking.Status        = BookingStatus.Cancelled;
                booking.PaymentStatus = PaymentStatus.Failed;
                booking.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[Webhook] Booking {booking.BookingNumber} cancelled — payment intent expired.");
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────────

        private async Task<Booking?> FindBookingByIntentIdAsync(string intentId)
        {
            if (string.IsNullOrWhiteSpace(intentId)) return null;

            return await _context.Bookings
                .FirstOrDefaultAsync(b => b.StripePaymentIntentId == intentId);
        }
    }
}
