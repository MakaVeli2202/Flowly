using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using System.Text.Json;

namespace Glanz.API.Controllers
{
    /// <summary>
    /// Public (no auth required) GET — returns client-facing system configuration.
    /// Admin-auth PUT   — persists booking/pricing settings from the Admin UI.
    ///
    /// GET shape:
    /// {
    ///   "pricing": { "vehicleMultipliers": { ... } },
    ///   "booking": { "defaultBufferMinutes": 90, "workerTravelBufferMinutes": 30 }
    /// }
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private const string MultipliersKey       = "pricing.vehicleMultipliers";
        private const string BufferKey            = "booking.defaultBufferMinutes";
        private const string WorkerTravelKey      = "booking.workerTravelBufferMinutes";
        private const string DiscountKey          = "subscription.discountPercent";
        private const string SmsFollowUpKey       = "sms.followUpEnabled";

        // Safe in-code defaults — used when the SystemSettings row is absent.
        private static readonly object DefaultVehicleMultipliers = new
        {
            Motorcycle = 0.8,
            Sedan      = 1.0,
            SUV        = 1.25,
            Pickup     = 1.5,
        };
        private const int DefaultBufferMinutes       = 90;
        private const int DefaultWorkerTravelMinutes = 30;

        private static readonly JsonSerializerOptions _jsonOpts =
            new() { PropertyNameCaseInsensitive = true };

        private readonly AppDbContext _context;

        public SettingsController(AppDbContext context)
        {
            _context = context;
        }

        // ── GET api/Settings ────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var keys = new[] { MultipliersKey, BufferKey, WorkerTravelKey, SmsFollowUpKey };
            var rows = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => keys.Contains(s.Key))
                .ToListAsync();

            string? GetVal(string key) => rows.FirstOrDefault(r => r.Key == key)?.Value;

            // ── vehicle multipliers ──────────────────────────────────────────────
            object vehicleMultipliers = DefaultVehicleMultipliers;
            var multipliersRaw = GetVal(MultipliersKey);
            if (!string.IsNullOrWhiteSpace(multipliersRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<Dictionary<string, decimal>>(multipliersRaw, _jsonOpts);
                    if (parsed != null && parsed.Count > 0)
                        vehicleMultipliers = parsed;
                }
                catch { /* Corrupt JSON — fall back to defaults. */ }
            }

            // ── booking buffer (customer lead time) ──────────────────────────────
            int defaultBufferMinutes = DefaultBufferMinutes;
            if (int.TryParse(GetVal(BufferKey), out var parsedBuffer) && parsedBuffer > 0)
                defaultBufferMinutes = parsedBuffer;

            // ── worker travel buffer ──────────────────────────────────────────────
            int workerTravelBufferMinutes = DefaultWorkerTravelMinutes;
            if (int.TryParse(GetVal(WorkerTravelKey), out var parsedTravel) && parsedTravel >= 0)
                workerTravelBufferMinutes = parsedTravel;

            bool smsFollowUpEnabled = false;
            if (bool.TryParse(GetVal(SmsFollowUpKey), out var parsedSms))
                smsFollowUpEnabled = parsedSms;

            return Ok(new
            {
                pricing = new { vehicleMultipliers },
                booking = new { defaultBufferMinutes, workerTravelBufferMinutes },
                sms     = new { followUpEnabled = smsFollowUpEnabled },
            });
        }

        // ── PUT api/Settings ────────────────────────────────────────────────────

        [HttpPut]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "Request body is required." });

            var updates = new List<(string Key, string Value)>();

            if (dto.DefaultBufferMinutes.HasValue)
            {
                if (dto.DefaultBufferMinutes.Value < 0 || dto.DefaultBufferMinutes.Value > 1440)
                    return BadRequest(new { message = "defaultBufferMinutes must be between 0 and 1440." });
                updates.Add((BufferKey, dto.DefaultBufferMinutes.Value.ToString()));
            }

            if (dto.WorkerTravelBufferMinutes.HasValue)
            {
                if (dto.WorkerTravelBufferMinutes.Value < 0 || dto.WorkerTravelBufferMinutes.Value > 480)
                    return BadRequest(new { message = "workerTravelBufferMinutes must be between 0 and 480." });
                updates.Add((WorkerTravelKey, dto.WorkerTravelBufferMinutes.Value.ToString()));
            }

            if (dto.SubscriptionDiscountPercent.HasValue)
            {
                if (dto.SubscriptionDiscountPercent.Value < 0 || dto.SubscriptionDiscountPercent.Value > 100)
                    return BadRequest(new { message = "subscriptionDiscountPercent must be between 0 and 100." });
                updates.Add((DiscountKey, dto.SubscriptionDiscountPercent.Value.ToString()));
            }

            if (dto.SmsFollowUpEnabled.HasValue)
                updates.Add((SmsFollowUpKey, dto.SmsFollowUpEnabled.Value.ToString()));

            if (updates.Count == 0)
                return BadRequest(new { message = "No valid settings provided to update." });

            foreach (var (key, value) in updates)
            {
                var existing = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
                if (existing != null)
                {
                    existing.Value     = value;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.SystemSettings.Add(new SystemSetting
                    {
                        Key       = key,
                        Value     = value,
                        UpdatedAt = DateTime.UtcNow,
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Settings updated successfully." });
        }
    }

    public class UpdateSettingsDto
    {
        public int?     DefaultBufferMinutes       { get; set; }
        public int?     WorkerTravelBufferMinutes   { get; set; }
        public decimal? SubscriptionDiscountPercent { get; set; }
        public bool?    SmsFollowUpEnabled          { get; set; }
    }
}
