using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;
using System.Security.Cryptography;
using System.Text;
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
        private const string SitePublishedKey     = "site.published";
        private const string SiteLaunchDateKey    = "site.launchDate";
        private const string BusinessHoursKey     = "booking.businessHours";
        private const string BusinessConfigKey    = "business.config";
        private const string ReferralRewardKey    = "referral.rewardAmount";
        private const string ReferralDiscountKey  = "referral.discountPercent"; // Discount for referred user
        private const string ReferralRequiredBookingsKey = "referral.requiredBookingsForReward"; // How many bookings needed for referrer reward
        private const string ClosedDatesKey           = "booking.closedDates";

        private static readonly Dictionary<string, (string Start, string End)> DefaultBusinessHours = new()
    {
        { "Sunday",    ("09:00", "18:00") },
        { "Monday",    ("09:00", "18:00") },
        { "Tuesday",   ("09:00", "18:00") },
        { "Wednesday", ("09:00", "18:00") },
        { "Thursday",  ("09:00", "18:00") },
        { "Friday",    ("00:00", "00:00") },
        { "Saturday",  ("00:00", "00:00") },
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
    private const int DefaultReferralRewardAmount = 50; // Default 50 QAR reward
    private const decimal DefaultReferralDiscountPercent = 0; // Default 0% discount for referred user

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        private readonly AppDbContext _context;
        private readonly ILogger<SettingsController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IAuditService _audit;
        private readonly ICredentialVerifier _credentialVerifier;

        public SettingsController(AppDbContext context, ILogger<SettingsController> logger, IConfiguration configuration, IAuditService audit, ICredentialVerifier credentialVerifier)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
            _audit = audit;
            _credentialVerifier = credentialVerifier;
        }

        // ── GET api/Settings ────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var keys = new[] { MultipliersKey, WorkerTravelKey, SmsFollowUpKey, SitePublishedKey, SiteLaunchDateKey, DiscountKey, BusinessHoursKey, BusinessConfigKey, ClosedDatesKey, ReferralRewardKey, ReferralDiscountKey, ReferralRequiredBookingsKey };
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

            bool sitePublished = false;
            if (bool.TryParse(GetVal(SitePublishedKey), out var parsedSitePublished))
                sitePublished = parsedSitePublished;

            string? siteLaunchDate = null;
            var launchDateRaw = GetVal(SiteLaunchDateKey);
            if (!string.IsNullOrWhiteSpace(launchDateRaw))
            {
                // Validate it's a valid ISO datetime string
                if (DateTime.TryParse(launchDateRaw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                    siteLaunchDate = parsedDate.ToUniversalTime().ToString("o");
            }
            // Default to 2026-06-01 if not set
            if (string.IsNullOrWhiteSpace(siteLaunchDate))
                siteLaunchDate = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc).ToString("o");

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

            // ── business config ──────────────────────────────────────────────────
            BusinessConfigDto businessConfig = new()
            {
                Name         = "Glanz",
                Tagline      = "Professional car detailing services in Qatar. Quality you can trust.",
                Phone        = "+974 4444 4444",
                Email        = "info@Glanz.qa",
                Location     = "Doha, Qatar",
                ServiceAreas = ["Doha", "Al Rayyan", "Al Wakrah", "Lusail", "Al Khor", "Dukhan", "Al Shahaniya"],
            };
            var bizRaw = GetVal(BusinessConfigKey);
            if (!string.IsNullOrWhiteSpace(bizRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<BusinessConfigDto>(bizRaw, _jsonOpts);
                    if (parsed != null) businessConfig = parsed;
                }
                catch { /* Corrupt JSON — fall back to defaults. */ }
            }

            // Get referral reward amount
            int referralRewardAmount = DefaultReferralRewardAmount;
            var rewardRaw = GetVal(ReferralRewardKey);
            if (!string.IsNullOrWhiteSpace(rewardRaw) && int.TryParse(rewardRaw, out var parsedReward) && parsedReward >= 0)
            {
                referralRewardAmount = parsedReward;
            }

            // Get referral discount for referred user
            decimal referralDiscountPercent = 0;
            var discountRaw = GetVal(ReferralDiscountKey);
            if (!string.IsNullOrWhiteSpace(discountRaw) && decimal.TryParse(discountRaw, out var parsedReferralDiscount) && parsedReferralDiscount >= 0)
            {
                referralDiscountPercent = parsedReferralDiscount;
            }

            // Get required bookings for referrer reward
            int referralRequiredBookings = 1;
            var requiredBookingsRaw = GetVal(ReferralRequiredBookingsKey);
            if (!string.IsNullOrWhiteSpace(requiredBookingsRaw) && int.TryParse(requiredBookingsRaw, out var parsedRequired) && parsedRequired > 0)
            {
                referralRequiredBookings = parsedRequired;
            }

            // ── closed dates ─────────────────────────────────────────────────────
            var closedDates = new List<string>();
            var closedRaw = GetVal(ClosedDatesKey);
            if (!string.IsNullOrWhiteSpace(closedRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(closedRaw, _jsonOpts);
                    if (parsed != null) closedDates = parsed;
                }
                catch { }
            }

            return Ok(new
            {
                pricing = new { vehicleMultipliers },
                booking = new { workerTravelBufferMinutes },
                sms     = new { followUpEnabled = smsFollowUpEnabled },
                site    = new { published = sitePublished, launchDate = siteLaunchDate },
                subscriptionDiscountPercent,
                businessHours,
                businessConfig,
                referralRewardAmount,
                referralDiscountPercent,
                referralRequiredBookings,
                closedDates,
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

            if (dto.SitePublished.HasValue)
                updates.Add((SitePublishedKey, dto.SitePublished.Value.ToString()));

            if (!string.IsNullOrWhiteSpace(dto.SiteLaunchDate))
            {
                // Validate it's a valid ISO datetime string
                if (!DateTime.TryParse(dto.SiteLaunchDate, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                    return BadRequest(new { message = "SiteLaunchDate must be a valid ISO datetime string." });
                updates.Add((SiteLaunchDateKey, parsedDate.ToUniversalTime().ToString("o")));
            }

            // Handle referral reward amount
            if (dto.ReferralRewardAmount.HasValue)
            {
                if (dto.ReferralRewardAmount.Value < 0 || dto.ReferralRewardAmount.Value > 500) // Max 500 QAR reasonable limit
                    return BadRequest(new { message = "referralRewardAmount must be between 0 and 500." });
                updates.Add((ReferralRewardKey, dto.ReferralRewardAmount.Value.ToString()));
            }

            // Handle referral discount for referred user
            if (dto.ReferralDiscountPercent.HasValue)
            {
                if (dto.ReferralDiscountPercent.Value < 0 || dto.ReferralDiscountPercent.Value > 100)
                    return BadRequest(new { message = "referralDiscountPercent must be between 0 and 100." });
                updates.Add((ReferralDiscountKey, dto.ReferralDiscountPercent.Value.ToString()));
            }

            // Handle referral required bookings for referrer reward
            if (dto.ReferralRequiredBookings.HasValue)
            {
                if (dto.ReferralRequiredBookings.Value < 1 || dto.ReferralRequiredBookings.Value > 100)
                    return BadRequest(new { message = "referralRequiredBookings must be between 1 and 100." });
                updates.Add((ReferralRequiredBookingsKey, dto.ReferralRequiredBookings.Value.ToString()));
            }

            // Handle vehicle multipliers
            if (dto.VehicleMultipliers != null)
            {
                var multipliersJson = JsonSerializer.Serialize(dto.VehicleMultipliers, _jsonOpts);
                updates.Add((MultipliersKey, multipliersJson));
            }

            if (dto.BusinessHours != null)
            {
                var json = JsonSerializer.Serialize(dto.BusinessHours, _jsonOpts);
                updates.Add((BusinessHoursKey, json));
            }

            if (dto.BusinessConfig != null)
            {
                var json = JsonSerializer.Serialize(dto.BusinessConfig, _jsonOpts);
                updates.Add((BusinessConfigKey, json));
            }

            if (dto.ClosedDates != null)
            {
                // Validate all are valid date strings
                var valid = dto.ClosedDates
                    .Where(d => DateOnly.TryParse(d, out _))
                    .Select(d => DateOnly.Parse(d).ToString("yyyy-MM-dd"))
                    .Distinct()
                    .OrderBy(d => d)
                    .ToList();
                updates.Add((ClosedDatesKey, JsonSerializer.Serialize(valid, _jsonOpts)));
                BookingSlotHelper.SetClosedDatesFromSettings(valid);
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

        // ── POST api/Settings/gate/verify ───────────────────────────────────
        /// <summary>
        /// Verify admin credentials for site access gate (unlock countdown page).
        /// No auth required, but only admin-level user credentials are accepted.
        /// Returns a gate token that should be stored in localStorage.
        /// </summary>
        [HttpPost("gate/verify")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyGateAccess([FromBody] GateVerifyDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { message = "Email and password are required.", reasonCode = "invalid_payload" });

            try
            {
                var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

                // Check Users table for Admin role
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

                if (user == null)
                    return Unauthorized(new { message = "Invalid credentials.", reasonCode = "user_not_found" });

                var verification = _credentialVerifier.Verify(dto.Password, user.PasswordHash);
                if (!verification.IsValid)
                    return Unauthorized(new { message = "Invalid credentials.", reasonCode = "password_mismatch" });

                if (verification.RequiresUpgrade && !string.IsNullOrWhiteSpace(verification.UpgradedHash))
                {
                    user.PasswordHash = verification.UpgradedHash;
                    user.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                // Only Admins can unlock the gate
                if (!string.Equals(user.Role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase))
                    return StatusCode(403, new { message = "Only admins can access the site gate.", reasonCode = "insufficient_role" });

                if (!user.IsActive) 
                    return Unauthorized(new { message = "Account is disabled.", reasonCode = "account_disabled" });

                // Generate a simple gate token (can be any string; frontend just stores it)
                // In production, this could be a JWT with expiration
                var gateToken = $"gate_{user.Id}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";

                return Ok(new { token = gateToken });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gate verify failed for email {Email}", dto.Email);
                return StatusCode(500, new { message = "Verification failed.", reasonCode = "verification_failed" });
            }
        }

        // ── POST api/Settings/gate/recover-admin ───────────────────────────
        /// <summary>
        /// Emergency admin password recovery. Protected by a server-side recovery token.
        /// Keep AdminRecovery:Enabled false by default and enable only during incidents.
        /// </summary>
        [HttpPost("gate/recover-admin")]
        [AllowAnonymous]
        public async Task<IActionResult> RecoverAdminPassword([FromBody] GateAdminRecoveryDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.NewPassword) || string.IsNullOrWhiteSpace(dto.RecoveryToken))
                return BadRequest(new { message = "Email, newPassword, and recoveryToken are required.", reasonCode = "invalid_payload" });

            if (dto.NewPassword.Length < 8)
                return BadRequest(new { message = "New password must be at least 8 characters.", reasonCode = "weak_password" });

            var recoveryEnabled = _configuration.GetValue("AdminRecovery:Enabled", false);
            if (!recoveryEnabled)
                return StatusCode(403, new { message = "Admin recovery is disabled.", reasonCode = "recovery_disabled" });

            var configuredToken = _configuration["AdminRecovery:Token"];
            if (string.IsNullOrWhiteSpace(configuredToken))
                return StatusCode(503, new { message = "Admin recovery is not configured.", reasonCode = "recovery_not_configured" });

            if (!SecureEquals(configuredToken, dto.RecoveryToken))
            {
                await _audit.LogAsync(
                    action: "admin_recovery_failed",
                    userEmail: dto.Email,
                    entityType: "User",
                    metadata: new { reasonCode = "invalid_recovery_token" },
                    success: false);
                return Unauthorized(new { message = "Invalid recovery token.", reasonCode = "invalid_recovery_token" });
            }

            try
            {
                var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
                if (user == null)
                {
                    await _audit.LogAsync(
                        action: "admin_recovery_failed",
                        userEmail: dto.Email,
                        entityType: "User",
                        metadata: new { reasonCode = "user_not_found" },
                        success: false);
                    return NotFound(new { message = "Admin user not found.", reasonCode = "user_not_found" });
                }

                if (!string.Equals(user.Role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    await _audit.LogAsync(
                        action: "admin_recovery_failed",
                        userId: user.Id,
                        userEmail: user.Email,
                        entityType: "User",
                        entityId: user.Id.ToString(),
                        metadata: new { reasonCode = "insufficient_role" },
                        success: false);
                    return StatusCode(403, new { message = "Only admin accounts can be recovered from this endpoint.", reasonCode = "insufficient_role" });
                }

                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword.Trim());
                user.IsActive = true;
                user.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                await _audit.LogAsync(
                    action: "admin_recovery_succeeded",
                    userId: user.Id,
                    userEmail: user.Email,
                    entityType: "User",
                    entityId: user.Id.ToString(),
                    metadata: new { reasonCode = "password_reset" },
                    success: true);

                return Ok(new { message = "Admin password has been reset.", reasonCode = "password_reset" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin recovery failed for email {Email}", dto.Email);
                return StatusCode(500, new { message = "Admin recovery failed.", reasonCode = "recovery_failed" });
            }
        }

        private static bool SecureEquals(string expected, string actual)
        {
            var expectedBytes = Encoding.UTF8.GetBytes(expected);
            var actualBytes = Encoding.UTF8.GetBytes(actual);
            return CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
        }
    }

    public class UpdateSettingsDto
    {
        public int?              WorkerTravelBufferMinutes   { get; set; }
        public decimal?          SubscriptionDiscountPercent { get; set; }
        public bool?             SmsFollowUpEnabled          { get; set; }
        public bool?             SitePublished               { get; set; }
        public string?           SiteLaunchDate              { get; set; }
        public int?              ReferralRewardAmount        { get; set; } // Referral reward in QAR for referrer
        public decimal?         ReferralDiscountPercent     { get; set; } // Discount % for referred user
        public int?             ReferralRequiredBookings   { get; set; } // Number of bookings needed for referrer reward
        public VehicleMultipliersDto? VehicleMultipliers     { get; set; } // Vehicle type multipliers
        public BusinessHoursPerDayDto? BusinessHours         { get; set; }
        public BusinessConfigDto?      BusinessConfig        { get; set; }
        public List<string>?           ClosedDates           { get; set; }
    }

    public class VehicleMultipliersDto
    {
        public decimal Motorcycle { get; set; } = 0.8m;
        public decimal Sedan      { get; set; } = 1.0m;
        public decimal SUV        { get; set; } = 1.25m;
        public decimal Pickup     { get; set; } = 1.5m;
    }

    public class BusinessConfigDto
    {
        public string?       Name         { get; set; }
        public string?       Logo         { get; set; }
        public string?       Tagline      { get; set; }
        public string?       Phone        { get; set; }
        public string?       Email        { get; set; }
        public string?       Location     { get; set; }
        public List<string>? ServiceAreas { get; set; }
    }

    public class GateVerifyDto
    {
        [System.ComponentModel.DataAnnotations.Required]
        [System.ComponentModel.DataAnnotations.EmailAddress]
        public string Email { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required]
        public string Password { get; set; } = string.Empty;
    }

    public class GateAdminRecoveryDto
    {
        [System.ComponentModel.DataAnnotations.Required]
        [System.ComponentModel.DataAnnotations.EmailAddress]
        public string Email { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required]
        [System.ComponentModel.DataAnnotations.MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;

        [System.ComponentModel.DataAnnotations.Required]
        public string RecoveryToken { get; set; } = string.Empty;
    }
}
