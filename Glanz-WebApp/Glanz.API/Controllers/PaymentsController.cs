using Microsoft.AspNetCore.Mvc;
using Glanz.API.Data;
using Glanz.API.Models;
using Stripe;

namespace Glanz.API.Controllers
{
    /// <summary>
    /// Thin server-side wrapper for Stripe PaymentIntent lifecycle.
    /// Called by the mobile app (Phase 2A) to create and verify intents
    /// without exposing the Stripe secret key to the client.
    ///
    /// Phase 3 addition: CreateIntent now also inserts a SlotReservation so
    /// that the chosen slot cannot be taken by a second customer while the
    /// first is completing payment.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentsController : ControllerBase
    {
        private const int SlotHoldMinutes = 15;

        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public PaymentsController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
        }

        /// <summary>
        /// Creates a Stripe PaymentIntent and reserves the time slot for
        /// <see cref="SlotHoldMinutes"/> minutes.
        ///
        /// POST /api/Payments/create-intent
        /// Body: { amount, currency, scheduledDate, timeSlot, durationMinutes, customerEmail? }
        /// Returns: { clientSecret, intentId, amount, currency }
        /// </summary>
        [HttpPost("create-intent")]
        public async Task<IActionResult> CreateIntent([FromBody] CreatePaymentIntentDto dto)
        {
            if (dto.Amount <= 0)
                return BadRequest(new { message = "Amount must be greater than zero." });

            try
            {
                // ── Create Stripe PaymentIntent ──────────────────────────────────────────
                var service = new PaymentIntentService();
                var options = new PaymentIntentCreateOptions
                {
                    // Stripe uses smallest currency unit (fils/halalah for QAR = 1/100 QAR)
                    Amount = (long)Math.Round(dto.Amount * 100),
                    Currency = (dto.Currency ?? "QAR").ToLowerInvariant(),
                    // manual capture: we capture only after the booking is confirmed
                    CaptureMethod = "manual",
                    Metadata = new Dictionary<string, string>
                    {
                        { "scheduled_date", dto.ScheduledDate?.ToString("yyyy-MM-dd") ?? "" },
                        { "time_slot",      dto.TimeSlot ?? "" },
                        { "customer_email", dto.CustomerEmail ?? "" },
                    },
                };

                var intent = await service.CreateAsync(options);

                // ── Reserve the slot ────────────────────────────────────────────────────
                if (dto.ScheduledDate.HasValue && !string.IsNullOrWhiteSpace(dto.TimeSlot))
                {
                    _context.SlotReservations.Add(new SlotReservation
                    {
                        PaymentIntentId = intent.Id,
                        ScheduledDate   = DateTime.SpecifyKind(dto.ScheduledDate.Value.Date, DateTimeKind.Utc),
                        TimeSlot        = dto.TimeSlot.Trim(),
                        DurationMinutes = dto.DurationMinutes,
                        CustomerEmail   = dto.CustomerEmail?.Trim().ToLowerInvariant(),
                        ExpiresAt       = DateTime.UtcNow.AddMinutes(SlotHoldMinutes),
                        CreatedAt       = DateTime.UtcNow,
                    });
                    await _context.SaveChangesAsync();
                }

                return Ok(new
                {
                    clientSecret = intent.ClientSecret,
                    intentId     = intent.Id,
                    amount       = dto.Amount,
                    currency     = dto.Currency ?? "QAR",
                });
            }
            catch (StripeException ex)
            {
                Console.WriteLine($"[PaymentsController] Stripe error: {ex.StripeError?.Message}");
                return StatusCode(502, new { message = "Payment provider error. Please try again." });
            }
        }

        /// <summary>
        /// Returns the current status of a PaymentIntent without exposing the secret key.
        ///
        /// GET /api/Payments/intent/{intentId}
        /// Returns: { intentId, status, amount }
        /// </summary>
        [HttpGet("intent/{intentId}")]
        public async Task<IActionResult> GetIntentStatus(string intentId)
        {
            if (string.IsNullOrWhiteSpace(intentId))
                return BadRequest(new { message = "intentId is required." });

            try
            {
                var service = new PaymentIntentService();
                var intent  = await service.GetAsync(intentId);

                return Ok(new
                {
                    intentId = intent.Id,
                    status   = intent.Status,
                    amount   = intent.Amount / 100m,
                });
            }
            catch (StripeException ex) when (ex.StripeError?.Code == "resource_missing")
            {
                return NotFound(new { message = "Payment intent not found." });
            }
            catch (StripeException ex)
            {
                Console.WriteLine($"[PaymentsController] Stripe error: {ex.StripeError?.Message}");
                return StatusCode(502, new { message = "Payment provider error." });
            }
        }
    }

    public class CreatePaymentIntentDto
    {
        public decimal Amount { get; set; }
        public string? Currency { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? TimeSlot { get; set; }
        public int DurationMinutes { get; set; }
        public string? CustomerEmail { get; set; }
    }
}
