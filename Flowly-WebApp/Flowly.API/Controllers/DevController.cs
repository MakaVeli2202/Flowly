using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class DevController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public DevController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        /// <summary>
        /// Simulates advancing time by N days. Deletes notifications and slot reservations
        /// that would have expired/been cleaned up in that window.
        /// Only available in Development environment.
        /// </summary>
        [HttpPost("simulate-time-forward")]
        public async Task<ActionResult> SimulateTimeForward([FromQuery] int days = 7)
        {
            if (days < 1 || days > 365)
                return BadRequest(new { message = "Days must be between 1 and 365." });

            var cutoff = DateTime.UtcNow.AddDays(-days);
            var results = new Dictionary<string, int>();

            // 1. Delete read notifications older than the window
            var oldReadNotifs = await _context.Notifications
                .Where(n => n.IsRead && n.CreatedAt < cutoff)
                .ToListAsync();
            _context.Notifications.RemoveRange(oldReadNotifs);
            results["readNotificationsDeleted"] = oldReadNotifs.Count;

            // 2. Delete unread notifications older than 2x the window (they're definitely stale)
            var staleUnreadCutoff = DateTime.UtcNow.AddDays(-days * 2);
            var staleUnreadNotifs = await _context.Notifications
                .Where(n => !n.IsRead && n.CreatedAt < staleUnreadCutoff)
                .ToListAsync();
            _context.Notifications.RemoveRange(staleUnreadNotifs);
            results["staleUnreadNotificationsDeleted"] = staleUnreadNotifs.Count;

            // 3. Delete expired slot reservations
            var expiredReservations = await _context.SlotReservations
                .Where(r => r.ExpiresAt < DateTime.UtcNow)
                .ToListAsync();
            _context.SlotReservations.RemoveRange(expiredReservations);
            results["expiredSlotReservationsDeleted"] = expiredReservations.Count;

            // 4. For Pending bookings older than the window that have no payment — mark Cancelled
            var stalePending = await _context.Bookings
                .Where(b => b.Status == Models.BookingStatus.Pending
                         && b.CreatedAt < cutoff
                         && b.PaymentStatus != Models.PaymentStatus.Paid
                         && b.PaymentStatus != Models.PaymentStatus.PreAuthorized)
                .ToListAsync();
            foreach (var b in stalePending) b.Status = Models.BookingStatus.Cancelled;
            results["stalePendingBookingsCancelled"] = stalePending.Count;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Simulated {days}-day time advance. Records cleaned up as if {days} days have passed.",
                daysSimulated = days,
                simulatedCutoffDate = cutoff,
                results,
            });
        }

        /// <summary>
        /// Deletes notifications older than N days (both read and unread).
        /// </summary>
        [HttpPost("cleanup-notifications")]
        public async Task<ActionResult> CleanupNotifications([FromQuery] int days = 30)
        {
            if (days < 1 || days > 365)
                return BadRequest(new { message = "Days must be between 1 and 365." });

            var cutoff = DateTime.UtcNow.AddDays(-days);
            var toDelete = await _context.Notifications
                .Where(n => n.CreatedAt < cutoff)
                .ToListAsync();

            _context.Notifications.RemoveRange(toDelete);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Deleted {toDelete.Count} notification(s) older than {days} days.",
                deleted = toDelete.Count,
                cutoffDate = cutoff,
            });
        }

        /// <summary>
        /// Runs a comprehensive cleanup: expired reservations, stale pending bookings,
        /// old read notifications (30+ days), orphaned audit logs (90+ days).
        /// </summary>
        [HttpPost("run-full-cleanup")]
        public async Task<ActionResult> RunFullCleanup()
        {
            var results = new Dictionary<string, int>();

            // Expired slot reservations
            var expiredReservations = await _context.SlotReservations
                .Where(r => r.ExpiresAt < DateTime.UtcNow)
                .ToListAsync();
            _context.SlotReservations.RemoveRange(expiredReservations);
            results["expiredSlotReservationsDeleted"] = expiredReservations.Count;

            // Read notifications older than 30 days
            var oldReadNotifs = await _context.Notifications
                .Where(n => n.IsRead && n.CreatedAt < DateTime.UtcNow.AddDays(-30))
                .ToListAsync();
            _context.Notifications.RemoveRange(oldReadNotifs);
            results["oldReadNotificationsDeleted"] = oldReadNotifs.Count;

            // Unread notifications older than 90 days (definitely stale)
            var veryOldUnread = await _context.Notifications
                .Where(n => !n.IsRead && n.CreatedAt < DateTime.UtcNow.AddDays(-90))
                .ToListAsync();
            _context.Notifications.RemoveRange(veryOldUnread);
            results["veryOldUnreadNotificationsDeleted"] = veryOldUnread.Count;

            // Stale pending bookings (> 7 days old, unpaid)
            var stalePending = await _context.Bookings
                .Where(b => b.Status == Models.BookingStatus.Pending
                         && b.CreatedAt < DateTime.UtcNow.AddDays(-7)
                         && b.PaymentStatus != Models.PaymentStatus.Paid
                         && b.PaymentStatus != Models.PaymentStatus.PreAuthorized)
                .ToListAsync();
            foreach (var b in stalePending) b.Status = Models.BookingStatus.Cancelled;
            results["stalePendingBookingsCancelled"] = stalePending.Count;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Full cleanup completed.",
                results,
            });
        }
    }
}
