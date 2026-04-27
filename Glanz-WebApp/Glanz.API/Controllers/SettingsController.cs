using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
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
    ///   "booking": { "workerTravelBufferMinutes": 30 }
    /// }
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private const string MultipliersKey       = "pricing.vehicleMultipliers";
        private const string WorkerTravelKey      = "booking.workerTravelBufferMinutes";
        private const string DiscountKey          = "subscription.discountPercent";
        private const string SmsFollowUpKey       = "sms.followUpEnabled";
        private const string BusinessHoursKey     = "booking.businessHours";

        private static readonly Dictionary<string, (string Start, string End)> DefaultBusinessHours = new()
        {
            { "Sunday",    ("09:00", "18:00") },
            { "Monday",    ("09:00", "18:00") },
            { "Tuesday",   ("09:00", "18:00") },
            { "Wednesday", ("09:00", "18:00") },
            { "Thursday",  ("09:00", "18:00") },
            { "Friday",    ("00:00", "00:00") },
            { "Saturday",  ("10:00", "16:00") },
        };

        // Safe in-code defaults — used when the SystemSettings row is absent.
        private static readonly object DefaultVehicleMultipliers = new
        {
            Motorcycle = 0.8,
            Sedan      = 1.0,
            SUV        = 1.25,
            Pickup     = 1.5,
        };
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
            var keys = new[] { MultipliersKey, WorkerTravelKey, SmsFollowUpKey, DiscountKey, BusinessHoursKey };
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

            // ── worker travel buffer ──────────────────────────────────────────────
            int workerTravelBufferMinutes = DefaultWorkerTravelMinutes;
            if (int.TryParse(GetVal(WorkerTravelKey), out var parsedTravel) && parsedTravel >= 0)
                workerTravelBufferMinutes = parsedTravel;

            bool smsFollowUpEnabled = false;
            if (bool.TryParse(GetVal(SmsFollowUpKey), out var parsedSms))
                smsFollowUpEnabled = parsedSms;

            // ── subscription discount ────────────────────────────────────────────
            decimal subscriptionDiscountPercent = 10;
            if (decimal.TryParse(GetVal(DiscountKey), out var parsedDiscount) && parsedDiscount >= 0)
                subscriptionDiscountPercent = parsedDiscount;

            // ── business hours ──────────────────────────────────────────────────
            var businessHours = new BusinessHoursPerDayDto();
            var hoursRaw = GetVal(BusinessHoursKey);
            if (!string.IsNullOrWhiteSpace(hoursRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<BusinessHoursPerDayDto>(hoursRaw, _jsonOpts);
                    if (parsed != null) businessHours = parsed;
                }
                catch { /* Corrupt JSON — fall back to defaults. */ }
            }
            else
            {
                businessHours = new BusinessHoursPerDayDto
                {
                    Sunday    = $"{DefaultBusinessHours["Sunday"].Start}-{DefaultBusinessHours["Sunday"].End}",
                    Monday    = $"{DefaultBusinessHours["Monday"].Start}-{DefaultBusinessHours["Monday"].End}",
                    Tuesday   = $"{DefaultBusinessHours["Tuesday"].Start}-{DefaultBusinessHours["Tuesday"].End}",
                    Wednesday = $"{DefaultBusinessHours["Wednesday"].Start}-{DefaultBusinessHours["Wednesday"].End}",
                    Thursday  = $"{DefaultBusinessHours["Thursday"].Start}-{DefaultBusinessHours["Thursday"].End}",
                    Friday    = $"{DefaultBusinessHours["Friday"].Start}-{DefaultBusinessHours["Friday"].End}",
                    Saturday  = $"{DefaultBusinessHours["Saturday"].Start}-{DefaultBusinessHours["Saturday"].End}",
                };
            }

            return Ok(new
            {
                pricing = new { vehicleMultipliers },
                booking = new { workerTravelBufferMinutes },
                sms     = new { followUpEnabled = smsFollowUpEnabled },
                subscriptionDiscountPercent,
                businessHours,
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

            if (dto.BusinessHours != null)
            {
                var json = JsonSerializer.Serialize(dto.BusinessHours, _jsonOpts);
                updates.Add((BusinessHoursKey, json));
            }

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
        public int?              WorkerTravelBufferMinutes   { get; set; }
        public decimal?          SubscriptionDiscountPercent { get; set; }
        public bool?             SmsFollowUpEnabled          { get; set; }
        public BusinessHoursPerDayDto? BusinessHours         { get; set; }
    }
}
