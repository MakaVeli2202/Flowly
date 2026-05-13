using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;

namespace Glanz.API.Controllers
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

        // ── Manual Cleanup Test Endpoints ───────────────────────────────────────

        // POST api/AdminSettings/cleanup/notifications - Clean old notifications
        [HttpPost("cleanup/notifications")]
        public async Task<IActionResult> CleanupOldNotifications()
        {
            if (!IsAdmin()) return Forbid();

            var now       = DateTime.UtcNow;
            var cutoff7   = now.AddDays(-7);
            var cutoff60  = now.AddDays(-60);
            var cutoff90  = now.AddDays(-90);

            var ephemeralTypes = new[]
            {
                NotificationType.WorkerArrived,
                NotificationType.WorkerOnMyWay,
                NotificationType.JobStarted,
                NotificationType.JobPaused,
                NotificationType.JobResumed,
                NotificationType.WorkerRunningLate,
            };

            var engagementTypes = new[]
            {
                NotificationType.SpecialOffer,
                NotificationType.LoyaltyReward,
                NotificationType.LoyaltyReviewRequested,
            };

            var toDelete = await _context.Notifications
                .Where(n =>
                    (ephemeralTypes.Contains(n.Type) && n.CreatedAt < cutoff7) ||
                    (engagementTypes.Contains(n.Type) && n.CreatedAt < cutoff90) ||
                    (!ephemeralTypes.Contains(n.Type) && !engagementTypes.Contains(n.Type) && n.CreatedAt < cutoff60))
                .ToListAsync();

            var count = toDelete.Count;
            if (count > 0)
            {
                _context.Notifications.RemoveRange(toDelete);
                await _context.SaveChangesAsync();
            }

            return Ok(new { deleted = count, message = $"Deleted {count} old notifications." });
        }

        // POST api/AdminSettings/cleanup/expired-reservations - Clean expired slot reservations
        [HttpPost("cleanup/expired-reservations")]
        public async Task<IActionResult> CleanupExpiredReservations()
        {
            if (!IsAdmin()) return Forbid();

            var now = DateTime.UtcNow;
            var expired = await _context.SlotReservations
                .Where(r => r.ExpiresAt < now)
                .ToListAsync();

            var count = expired.Count;
            if (count > 0)
            {
                _context.SlotReservations.RemoveRange(expired);
                await _context.SaveChangesAsync();
            }

            return Ok(new { deleted = count, message = $"Deleted {count} expired slot reservations." });
        }

        // POST api/AdminSettings/cleanup/late-bookings - Flag late bookings
        [HttpPost("cleanup/late-bookings")]
        public async Task<IActionResult> FlagLateBookings()
        {
            if (!IsAdmin()) return Forbid();

            var gracePeriod = TimeSpan.FromMinutes(90);
            var cutoff = DateTime.UtcNow - gracePeriod;

            var late = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Confirmed
                         && b.ScheduledDate < cutoff
                         && b.WorkStartedAt == null
                         && b.WorkerRunningLateAt == null)
                .ToListAsync();

            foreach (var booking in late)
            {
                booking.WorkerRunningLateAt = DateTime.UtcNow;
                booking.UpdatedAt = DateTime.UtcNow;
            }

            var count = late.Count;
            if (count > 0)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new { flagged = count, message = $"Flagged {count} late bookings." });
        }

        // POST api/AdminSettings/test/notifications - Create old test notifications to test cleanup
        [HttpPost("test/create-old-notifications")]
        public async Task<IActionResult> CreateTestOldNotifications([FromBody] CreateTestNotificationsDto dto)
        {
            if (!IsAdmin()) return Forbid();

            var now = DateTime.UtcNow;
            var created = 0;

            // Create 7-day old ephemeral notifications
            if (dto.CreateEphemeral7Days)
            {
                var users = await _context.Users.Where(u => u.Role == "Customer").Take(5).ToListAsync();
                foreach (var user in users)
                {
                    _context.Notifications.Add(new Notification
                    {
                        UserId = user.Id,
                        Message = "Test: Worker arrived notification (7 days old)",
                        Type = NotificationType.WorkerArrived,
                        CreatedAt = now.AddDays(-7).AddHours(-1),
                        IsRead = false
                    });
                    created++;
                }
            }

            // Create 60-day old operational notifications
            if (dto.CreateOperational60Days)
            {
                var users = await _context.Users.Where(u => u.Role == "Customer").Take(5).ToListAsync();
                foreach (var user in users)
                {
                    _context.Notifications.Add(new Notification
                    {
                        UserId = user.Id,
                        Message = "Test: Booking confirmed notification (60 days old)",
                        Type = NotificationType.BookingConfirmed,
                        CreatedAt = now.AddDays(-60).AddHours(-1),
                        IsRead = false
                    });
                    created++;
                }
            }

            // Create 90-day old engagement notifications
            if (dto.CreateEngagement90Days)
            {
                var users = await _context.Users.Where(u => u.Role == "Customer").Take(5).ToListAsync();
                foreach (var user in users)
                {
                    _context.Notifications.Add(new Notification
                    {
                        UserId = user.Id,
                        Message = "Test: Special offer notification (90 days old)",
                        Type = NotificationType.SpecialOffer,
                        CreatedAt = now.AddDays(-90).AddHours(-1),
                        IsRead = false
                    });
                    created++;
                }
            }

            // Create 5-day old ephemeral (should NOT be deleted)
            if (dto.CreateRecentEphemeral)
            {
                var users = await _context.Users.Where(u => u.Role == "Customer").Take(5).ToListAsync();
                foreach (var user in users)
                {
                    _context.Notifications.Add(new Notification
                    {
                        UserId = user.Id,
                        Message = "Test: Worker on my way (5 days old - should stay)",
                        Type = NotificationType.WorkerOnMyWay,
                        CreatedAt = now.AddDays(-5),
                        IsRead = false
                    });
                    created++;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { created, message = $"Created {created} test notifications with old timestamps." });
        }

        // POST api/AdminSettings/test/slot-reservation - Create expired slot reservation
        [HttpPost("test/create-expired-reservation")]
        public async Task<IActionResult> CreateTestExpiredReservation()
        {
            if (!IsAdmin()) return Forbid();

            var now = DateTime.UtcNow;

            _context.SlotReservations.Add(new SlotReservation
            {
                CustomerEmail = "test@example.com",
                ScheduledDate = now.AddDays(-1),
                TimeSlot = "10:00-11:00",
                DurationMinutes = 60,
                PaymentIntentId = "test_pi_expired",
                ExpiresAt = now.AddDays(-1),
                CreatedAt = now.AddDays(-1)
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Created expired slot reservation (expires yesterday)." });
        }

        // POST api/AdminSettings/test/late-booking - Create test late booking
        [HttpPost("test/create-late-booking")]
        public async Task<IActionResult> CreateTestLateBooking()
        {
            if (!IsAdmin()) return Forbid();

            var now = DateTime.UtcNow;
            var yesterday = now.AddDays(-1).Date.AddHours(10);

            var admin = await _context.Users.FirstOrDefaultAsync(u => u.Role == "Admin");

            _context.Bookings.Add(new Booking
            {
                BookingNumber = $"TEST-LATE-{DateTime.Now:HHmmss}",
                CustomerName = "Test Late Customer",
                CustomerEmail = "testlate@example.com",
                CustomerPhone = "+97412345678",
                CustomerAddress = "Test Address",
                ScheduledDate = yesterday,
                TimeSlot = "10:00-11:00",
                Status = BookingStatus.Confirmed,
                PaymentStatus = PaymentStatus.Paid,
                TotalAmount = 100,
                EstimatedCost = 50,
                EstimatedProfit = 50,
                VehicleType = VehicleType.Sedan,
                CreatedAt = now.AddDays(-2),
                UpdatedAt = now.AddDays(-2),
                UserId = admin?.Id
            });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Created confirmed booking from yesterday (should be flagged as late)." });
        }

        // ExecuteDeleteAsync generates a raw DELETE FROM without SELECT-ing columns,
        // so it works even when the prod schema has drifted from the EF model.
        private static async Task<int> DeleteAllAsync<T>(Microsoft.EntityFrameworkCore.DbSet<T> dbSet) where T : class
            => await dbSet.ExecuteDeleteAsync();
    }

    public class CreateTestNotificationsDto
    {
        public bool CreateEphemeral7Days { get; set; } = true;
        public bool CreateOperational60Days { get; set; } = true;
        public bool CreateEngagement90Days { get; set; } = true;
        public bool CreateRecentEphemeral { get; set; } = true;
    }
}
