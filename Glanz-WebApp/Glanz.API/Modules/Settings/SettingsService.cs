using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Glanz.API.Modules.Settings
{
    public class SettingsService : ISettingsService
    {
        private const string MultipliersKey              = "pricing.vehicleMultipliers";
        private const string WorkerTravelKey             = "booking.workerTravelBufferMinutes";
        private const string DiscountKey                 = "subscription.discountPercent";
        private const string SmsFollowUpKey              = "sms.followUpEnabled";
        private const string SitePublishedKey            = "site.published";
        private const string SiteLaunchDateKey           = "site.launchDate";
        private const string BusinessHoursKey            = "booking.businessHours";
        private const string BusinessConfigKey           = "business.config";
        private const string ReferralRewardKey           = "referral.rewardAmount";
        private const string ReferralDiscountKey         = "referral.discountPercent";
        private const string ReferralRequiredBookingsKey = "referral.requiredBookingsForReward";
        private const string ClosedDatesKey              = "booking.closedDates";

        private const int DefaultWorkerTravelMinutes   = 30;
        private const int DefaultReferralRewardAmount  = 50;

        private static readonly object DefaultVehicleMultipliers = new
        {
            Motorcycle = 0.8,
            Sedan      = 1.0,
            SUV        = 1.25,
            Pickup     = 1.5,
        };

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

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        private readonly AppDbContext _context;
        private readonly ILogger<SettingsService> _logger;
        private readonly IConfiguration _configuration;
        private readonly IAuditService _audit;
        private readonly ICredentialVerifier _credentialVerifier;

        public SettingsService(
            AppDbContext context,
            ILogger<SettingsService> logger,
            IConfiguration configuration,
            IAuditService audit,
            ICredentialVerifier credentialVerifier)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
            _audit = audit;
            _credentialVerifier = credentialVerifier;
        }

        public async Task<object> GetSettingsAsync()
        {
            var keys = new[] { MultipliersKey, WorkerTravelKey, SmsFollowUpKey, SitePublishedKey, SiteLaunchDateKey, DiscountKey, BusinessHoursKey, BusinessConfigKey, ClosedDatesKey, ReferralRewardKey, ReferralDiscountKey, ReferralRequiredBookingsKey };
            var rows = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => keys.Contains(s.Key))
                .ToListAsync();

            string? GetVal(string key) => rows.FirstOrDefault(r => r.Key == key)?.Value;

            object vehicleMultipliers = DefaultVehicleMultipliers;
            var multipliersRaw = GetVal(MultipliersKey);
            if (!string.IsNullOrWhiteSpace(multipliersRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<Dictionary<string, decimal>>(multipliersRaw, _jsonOpts);
                    if (parsed != null && parsed.Count > 0) vehicleMultipliers = parsed;
                }
                catch { }
            }

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
            if (!string.IsNullOrWhiteSpace(launchDateRaw) &&
                DateTime.TryParse(launchDateRaw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                siteLaunchDate = parsedDate.ToUniversalTime().ToString("o");
            if (string.IsNullOrWhiteSpace(siteLaunchDate))
                siteLaunchDate = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc).ToString("o");

            decimal subscriptionDiscountPercent = 10;
            if (decimal.TryParse(GetVal(DiscountKey), out var parsedDiscount) && parsedDiscount >= 0)
                subscriptionDiscountPercent = parsedDiscount;

            var businessHours = new BusinessHoursPerDayDto();
            var hoursRaw = GetVal(BusinessHoursKey);
            if (!string.IsNullOrWhiteSpace(hoursRaw))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<BusinessHoursPerDayDto>(hoursRaw, _jsonOpts);
                    if (parsed != null) businessHours = parsed;
                }
                catch { }
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
                catch { }
            }

            int referralRewardAmount = DefaultReferralRewardAmount;
            var rewardRaw = GetVal(ReferralRewardKey);
            if (!string.IsNullOrWhiteSpace(rewardRaw) && int.TryParse(rewardRaw, out var parsedReward) && parsedReward >= 0)
                referralRewardAmount = parsedReward;

            decimal referralDiscountPercent = 0;
            var discountRaw = GetVal(ReferralDiscountKey);
            if (!string.IsNullOrWhiteSpace(discountRaw) && decimal.TryParse(discountRaw, out var parsedReferralDiscount) && parsedReferralDiscount >= 0)
                referralDiscountPercent = parsedReferralDiscount;

            int referralRequiredBookings = 1;
            var requiredBookingsRaw = GetVal(ReferralRequiredBookingsKey);
            if (!string.IsNullOrWhiteSpace(requiredBookingsRaw) && int.TryParse(requiredBookingsRaw, out var parsedRequired) && parsedRequired > 0)
                referralRequiredBookings = parsedRequired;

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

            return new
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
            };
        }

        public async Task<(string? Error, string? Message)> UpdateSettingsAsync(UpdateSettingsDto dto)
        {
            var updates = new List<(string Key, string Value)>();

            if (dto.WorkerTravelBufferMinutes.HasValue)
            {
                if (dto.WorkerTravelBufferMinutes.Value < 0 || dto.WorkerTravelBufferMinutes.Value > 480)
                    return ("workerTravelBufferMinutes must be between 0 and 480.", null);
                updates.Add((WorkerTravelKey, dto.WorkerTravelBufferMinutes.Value.ToString()));
            }

            if (dto.SubscriptionDiscountPercent.HasValue)
            {
                if (dto.SubscriptionDiscountPercent.Value < 0 || dto.SubscriptionDiscountPercent.Value > 100)
                    return ("subscriptionDiscountPercent must be between 0 and 100.", null);
                updates.Add((DiscountKey, dto.SubscriptionDiscountPercent.Value.ToString()));
            }

            if (dto.SmsFollowUpEnabled.HasValue)
                updates.Add((SmsFollowUpKey, dto.SmsFollowUpEnabled.Value.ToString()));

            if (dto.SitePublished.HasValue)
                updates.Add((SitePublishedKey, dto.SitePublished.Value.ToString()));

            if (!string.IsNullOrWhiteSpace(dto.SiteLaunchDate))
            {
                if (!DateTime.TryParse(dto.SiteLaunchDate, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                    return ("SiteLaunchDate must be a valid ISO datetime string.", null);
                updates.Add((SiteLaunchDateKey, parsedDate.ToUniversalTime().ToString("o")));
            }

            if (dto.ReferralRewardAmount.HasValue)
            {
                if (dto.ReferralRewardAmount.Value < 0 || dto.ReferralRewardAmount.Value > 500)
                    return ("referralRewardAmount must be between 0 and 500.", null);
                updates.Add((ReferralRewardKey, dto.ReferralRewardAmount.Value.ToString()));
            }

            if (dto.ReferralDiscountPercent.HasValue)
            {
                if (dto.ReferralDiscountPercent.Value < 0 || dto.ReferralDiscountPercent.Value > 100)
                    return ("referralDiscountPercent must be between 0 and 100.", null);
                updates.Add((ReferralDiscountKey, dto.ReferralDiscountPercent.Value.ToString()));
            }

            if (dto.ReferralRequiredBookings.HasValue)
            {
                if (dto.ReferralRequiredBookings.Value < 1 || dto.ReferralRequiredBookings.Value > 100)
                    return ("referralRequiredBookings must be between 1 and 100.", null);
                updates.Add((ReferralRequiredBookingsKey, dto.ReferralRequiredBookings.Value.ToString()));
            }

            if (dto.VehicleMultipliers != null)
                updates.Add((MultipliersKey, JsonSerializer.Serialize(dto.VehicleMultipliers, _jsonOpts)));

            if (dto.BusinessHours != null)
                updates.Add((BusinessHoursKey, JsonSerializer.Serialize(dto.BusinessHours, _jsonOpts)));

            if (dto.BusinessConfig != null)
                updates.Add((BusinessConfigKey, JsonSerializer.Serialize(dto.BusinessConfig, _jsonOpts)));

            if (dto.ClosedDates != null)
            {
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
                return ("No valid settings provided to update.", null);

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
            return (null, "Settings updated successfully.");
        }

        public async Task<(string? Token, string? Error, string? ReasonCode, int StatusCode)> VerifyGateAccessAsync(string email, string password)
        {
            try
            {
                var normalizedEmail = email.Trim().ToLowerInvariant();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

                if (user == null)
                    return (null, "Invalid credentials.", "user_not_found", 401);

                var verification = _credentialVerifier.Verify(password, user.PasswordHash);
                if (!verification.IsValid)
                    return (null, "Invalid credentials.", "password_mismatch", 401);

                if (verification.RequiresUpgrade && !string.IsNullOrWhiteSpace(verification.UpgradedHash))
                {
                    user.PasswordHash = verification.UpgradedHash;
                    user.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                if (!string.Equals(user.Role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase))
                    return (null, "Only admins can access the site gate.", "insufficient_role", 403);

                if (!user.IsActive)
                    return (null, "Account is disabled.", "account_disabled", 401);

                var gateToken = $"gate_{user.Id}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N")[..8]}";
                return (gateToken, null, null, 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gate verify failed for email {Email}", email);
                return (null, "Verification failed.", "verification_failed", 500);
            }
        }

        public async Task<(string? Error, string? ReasonCode, int StatusCode)> RecoverAdminPasswordAsync(string email, string newPassword, string recoveryToken)
        {
            if (newPassword.Length < 8)
                return ("New password must be at least 8 characters.", "weak_password", 400);

            var recoveryEnabled = _configuration.GetValue("AdminRecovery:Enabled", false);
            if (!recoveryEnabled)
                return ("Admin recovery is disabled.", "recovery_disabled", 403);

            var configuredToken = _configuration["AdminRecovery:Token"];
            if (string.IsNullOrWhiteSpace(configuredToken))
                return ("Admin recovery is not configured.", "recovery_not_configured", 503);

            if (!SecureEquals(configuredToken, recoveryToken))
            {
                await _audit.LogAsync(
                    action: "admin_recovery_failed",
                    userEmail: email,
                    entityType: "User",
                    metadata: new { reasonCode = "invalid_recovery_token" },
                    success: false);
                return ("Invalid recovery token.", "invalid_recovery_token", 401);
            }

            try
            {
                var normalizedEmail = email.Trim().ToLowerInvariant();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
                if (user == null)
                {
                    await _audit.LogAsync(
                        action: "admin_recovery_failed",
                        userEmail: email,
                        entityType: "User",
                        metadata: new { reasonCode = "user_not_found" },
                        success: false);
                    return ("Admin user not found.", "user_not_found", 404);
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
                    return ("Only admin accounts can be recovered from this endpoint.", "insufficient_role", 403);
                }

                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword.Trim());
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

                return (null, "password_reset", 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin recovery failed for email {Email}", email);
                return ("Admin recovery failed.", "recovery_failed", 500);
            }
        }

        private static bool SecureEquals(string expected, string actual)
        {
            var expectedBytes = Encoding.UTF8.GetBytes(expected);
            var actualBytes = Encoding.UTF8.GetBytes(actual);
            return CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
        }
    }
}
