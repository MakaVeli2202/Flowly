using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.DTOs;
using Flowly.API.Services;
using System.Security.Claims;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminSettingsController : ControllerBase
    {
        private const string FeeEnabledKey = "cancellation.feeEnabled";
        private const string FeeTypeKey    = "cancellation.feeType";
        private const string FeeAmountKey  = "cancellation.feeAmount";
        private const string FreeWindowKey = "cancellation.freeWindowHours";

        private readonly AppDbContext _context;
        private readonly ICredentialVerifier _credentialVerifier;

        public AdminSettingsController(AppDbContext context, ICredentialVerifier credentialVerifier)
        {
            _context = context;
            _credentialVerifier = credentialVerifier;
        }

        private bool IsAdmin()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        // GET api/AdminSettings/cancellation-policy
        [HttpGet("cancellation-policy")]
        public async Task<IActionResult> GetCancellationPolicy()
        {
            if (!IsAdmin()) return Forbid();

            var settings = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.Key == FeeEnabledKey || s.Key == FeeTypeKey || s.Key == FeeAmountKey || s.Key == FreeWindowKey)
                .ToListAsync();

            var dto = BuildPolicyDto(settings);
            return Ok(dto);
        }

        // PUT api/AdminSettings/cancellation-policy
        [HttpPut("cancellation-policy")]
        public async Task<IActionResult> UpdateCancellationPolicy([FromBody] CancellationPolicyDto dto)
        {
            if (!IsAdmin()) return Forbid();

            if (!string.Equals(dto.FeeType, "Percent", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(dto.FeeType, "Flat", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "FeeType must be 'Percent' or 'Flat'." });
            }

            if (dto.FeeAmount < 0)
                return BadRequest(new { message = "Fee amount cannot be negative." });

            if (string.Equals(dto.FeeType, "Percent", StringComparison.OrdinalIgnoreCase) && dto.FeeAmount > 100)
                return BadRequest(new { message = "Percentage fee cannot exceed 100%." });

            if (dto.FreeWindowHours < 0)
                return BadRequest(new { message = "Free cancellation window cannot be negative." });

            await UpsertSettingAsync(FeeEnabledKey, dto.FeeEnabled.ToString());
            await UpsertSettingAsync(FeeTypeKey,    dto.FeeType);
            await UpsertSettingAsync(FeeAmountKey,  dto.FeeAmount.ToString("F2"));
            await UpsertSettingAsync(FreeWindowKey, dto.FreeWindowHours.ToString());

            await _context.SaveChangesAsync();

            var updated = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.Key == FeeEnabledKey || s.Key == FeeTypeKey || s.Key == FeeAmountKey || s.Key == FreeWindowKey)
                .ToListAsync();

            return Ok(BuildPolicyDto(updated));
        }

        // ── helpers ─────────────────────────────────────────────────────────

        private static CancellationPolicyDto BuildPolicyDto(List<SystemSetting> settings)
        {
            string Get(string key) => settings.FirstOrDefault(s => s.Key == key)?.Value ?? string.Empty;

            bool feeEnabled = bool.TryParse(Get(FeeEnabledKey), out var fe) ? fe : false;
            string feeType  = Get(FeeTypeKey) is { Length: > 0 } ft ? ft : "Percent";
            decimal feeAmt  = decimal.TryParse(Get(FeeAmountKey), out var fa) ? fa : 0m;
            int freeHrs     = int.TryParse(Get(FreeWindowKey), out var fh) ? fh : 24;

            return new CancellationPolicyDto
            {
                FeeEnabled      = feeEnabled,
                FeeType         = feeType,
                FeeAmount       = feeAmt,
                FreeWindowHours = freeHrs,
            };
        }

        private async Task UpsertSettingAsync(string key, string value)
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (setting == null)
            {
                _context.SystemSettings.Add(new SystemSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
            }
            else
            {
                setting.Value     = value;
                setting.UpdatedAt = DateTime.UtcNow;
            }
        }

        // GET api/AdminSettings/database-stats
        [HttpGet("database-stats")]
        public async Task<IActionResult> GetDatabaseStats()
        {
            if (!IsAdmin()) return Forbid();

            var stats = new
            {
                customers      = await _context.Users.CountAsync(u => u.Role == "Customer"),
                admins         = await _context.Users.CountAsync(u => u.Role == "Admin"),
                workers        = await _context.Staff.CountAsync(),
                bookings       = await _context.Bookings.CountAsync(),
                packages       = await _context.Packages.CountAsync(),
                services       = await _context.Services.CountAsync(),
                products       = await _context.Products.CountAsync(),
                offers         = await _context.Offers.CountAsync(),
                subscriptionPlans    = await _context.SubscriptionPlans.CountAsync(),
                userSubscriptions    = await _context.UserSubscriptions.CountAsync(),
                notifications  = await _context.Notifications.CountAsync(),
                auditLogs      = await _context.AuditLogs.CountAsync(),
                leads          = await _context.Leads.CountAsync(),
                vehicles       = await _context.Vehicles.CountAsync(),
                jobPositions   = await _context.JobPositions.CountAsync(),
                jobApplications = await _context.JobApplications.CountAsync(),
            };

            return Ok(stats);
        }

        // POST api/AdminSettings/reset-database
        [HttpPost("reset-database")]
        public async Task<IActionResult> ResetDatabase([FromBody] ResetDatabaseDto dto)
        {
            if (!IsAdmin()) return Forbid();

            var adminId = User.GetCurrentUserId();

            var admin = await _context.Users.FindAsync(adminId);
            if (admin == null)
                return NotFound(new { message = "Admin user not found." });

            var verification = _credentialVerifier.Verify(dto.Password, admin.PasswordHash);
            if (!verification.IsValid)
                return BadRequest(new { message = "Incorrect password." });

            var mode = dto.Mode?.Trim().ToLowerInvariant() ?? "keep_catalog";
            if (mode != "full" && mode != "keep_catalog" && mode != "transactional_only")
                return BadRequest(new { message = "Invalid mode. Use 'full', 'keep_catalog', or 'transactional_only'." });

            var counts = new Dictionary<string, int>();

            // ── Always delete (transactional data) ─────────────────────────────
            // FK-safe order: child rows before parent rows
            counts["workerLocations"]      = await DeleteAllAsync(_context.WorkerLocations);
            counts["slotReservations"]     = await DeleteAllAsync(_context.SlotReservations);
            counts["bookingPhotos"]        = await DeleteAllAsync(_context.BookingPhotos);
            counts["checklistItems"]       = await DeleteAllAsync(_context.BookingChecklistItems);
            counts["bookingItems"]         = await DeleteAllAsync(_context.BookingItems);
            counts["notifications"]        = await DeleteAllAsync(_context.Notifications);
            counts["customerFeedbacks"]    = await DeleteAllAsync(_context.CustomerFeedbacks);
            counts["leads"]                = await DeleteAllAsync(_context.Leads);
            counts["auditLogs"]            = await DeleteAllAsync(_context.AuditLogs);
            counts["bookings"]             = await DeleteAllAsync(_context.Bookings);
            counts["subBookings"]          = await DeleteAllAsync(_context.SubscriptionBookings);
            counts["userSubscriptions"]    = await DeleteAllAsync(_context.UserSubscriptions);
            counts["serviceSubscriptions"] = await DeleteAllAsync(_context.ServiceSubscriptions);
            counts["userOffers"]           = await DeleteAllAsync(_context.UserOffers);
            counts["vehicles"]             = await DeleteAllAsync(_context.Vehicles);
            counts["referrals"]            = await DeleteAllAsync(_context.Referrals);
            counts["availabilities"]       = await DeleteAllAsync(_context.Availabilities);

            // ── Workers + Customers (keep admin) ───────────────────────────────
            counts["workers"]   = await DeleteAllAsync(_context.Staff);
            var customersToDelete = _context.Users.Where(u => u.Id != adminId);
            counts["customers"] = customersToDelete.Count();
            _context.Users.RemoveRange(customersToDelete);
            await _context.SaveChangesAsync();

            if (mode == "full" || mode == "keep_catalog")
            {
                // Job applications always cleared in full + keep_catalog
                counts["jobApplications"] = await DeleteAllAsync(_context.JobApplications);
            }

            if (mode == "full")
            {
                // Also wipe catalog
                counts["subPlanPackages"]  = await DeleteAllAsync(_context.SubscriptionPlanPackages);
                counts["subPlanBenefits"]  = await DeleteAllAsync(_context.SubscriptionPlanBenefits);
                counts["subPlanFeatures"]  = await DeleteAllAsync(_context.SubscriptionPlanFeatures);
                counts["subscriptionPlans"] = await DeleteAllAsync(_context.SubscriptionPlans);
                counts["offers"]           = await DeleteAllAsync(_context.Offers);
                counts["packageServices"]  = await DeleteAllAsync(_context.PackageServices);
                counts["packages"]         = await DeleteAllAsync(_context.Packages);
                counts["serviceProducts"]  = await DeleteAllAsync(_context.ServiceProducts);
                counts["services"]         = await DeleteAllAsync(_context.Services);
                counts["products"]         = await DeleteAllAsync(_context.Products);
                counts["jobPositions"]     = await DeleteAllAsync(_context.JobPositions);
            }

            return Ok(new
            {
                message = $"Database reset complete ({mode} mode). Admin account preserved.",
                mode,
                deletedCounts = counts,
            });
        }

        // ExecuteDeleteAsync generates a raw DELETE FROM without SELECT-ing columns,
        // so it works even when the prod schema has drifted from the EF model.
        private static async Task<int> DeleteAllAsync<T>(Microsoft.EntityFrameworkCore.DbSet<T> dbSet) where T : class
            => await dbSet.ExecuteDeleteAsync();
    }
}
