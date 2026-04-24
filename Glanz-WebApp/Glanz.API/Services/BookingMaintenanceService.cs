using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Services
{
    /// <summary>
    /// Background service that runs every 5 minutes to handle time-sensitive cleanup:
    ///
    ///   1. Expired slot reservations — removed so the slot opens up for new bookings.
    ///   2. Late bookings — Confirmed bookings where the scheduled time + grace period
    ///      has passed are flagged so admin can see them in the dashboard.
    ///
    /// Registered as a hosted service in Program.cs.
    /// Uses IServiceScopeFactory to create a scoped DbContext (BackgroundService is singleton).
    /// </summary>
    public class BookingMaintenanceService : BackgroundService
    {
        private static readonly TimeSpan TickInterval   = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan LateGracePeriod = TimeSpan.FromMinutes(90); // confirmed + scheduled time + 90 min = late

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BookingMaintenanceService> _logger;

        public BookingMaintenanceService(
            IServiceScopeFactory scopeFactory,
            ILogger<BookingMaintenanceService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger       = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[Maintenance] BookingMaintenanceService started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunMaintenanceTickAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "[Maintenance] Unhandled error in maintenance tick.");
                }

                await Task.Delay(TickInterval, stoppingToken);
            }

            _logger.LogInformation("[Maintenance] BookingMaintenanceService stopping.");
        }

        private async Task RunMaintenanceTickAsync(CancellationToken ct)
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var expired   = await CleanExpiredReservationsAsync(db, ct);
            var lateCount = await FlagLateBookingsAsync(db, ct);

            if (expired > 0 || lateCount > 0)
            {
                _logger.LogInformation(
                    "[Maintenance] Tick complete — expired reservations removed: {Expired}, late bookings flagged: {Late}",
                    expired, lateCount);
            }
        }

        // ── Task 1: Expired slot reservations ────────────────────────────────────────

        private static async Task<int> CleanExpiredReservationsAsync(AppDbContext db, CancellationToken ct)
        {
            var now     = DateTime.UtcNow;
            var expired = await db.SlotReservations
                .Where(r => r.ExpiresAt < now)
                .ToListAsync(ct);

            if (expired.Count == 0) return 0;

            db.SlotReservations.RemoveRange(expired);
            await db.SaveChangesAsync(ct);
            return expired.Count;
        }

        // ── Task 2: Flag overdue bookings ─────────────────────────────────────────────
        //
        // A booking is considered "late" when:
        //   • Status == Confirmed (worker should be on the job or on the way)
        //   • ScheduledDate + LateGracePeriod < UtcNow
        //   • WorkerRunningLateAt is null (not already manually flagged by the worker)
        //
        // We set WorkerRunningLateAt to signal the admin dashboard AlertsPanel.
        // We do NOT auto-cancel or reassign — that requires human judgement.

        private async Task<int> FlagLateBookingsAsync(AppDbContext db, CancellationToken ct)
        {
            var cutoff = DateTime.UtcNow - LateGracePeriod;

            // Fetch bookings scheduled more than <grace period> ago that are still Confirmed
            // and have not been manually flagged as late.
            var late = await db.Bookings
                .Where(b => b.Status           == BookingStatus.Confirmed
                         && b.ScheduledDate    <  cutoff
                         && b.WorkStartedAt    == null
                         && b.WorkerRunningLateAt == null)
                .ToListAsync(ct);

            if (late.Count == 0) return 0;

            foreach (var booking in late)
            {
                // Use a sentinel value so the admin dashboard can show "auto-flagged"
                // differently from worker-flagged late jobs if needed in future.
                booking.WorkerRunningLateAt = DateTime.UtcNow;
                booking.UpdatedAt           = DateTime.UtcNow;
                _logger.LogWarning(
                    "[Maintenance] Booking {BookingNumber} auto-flagged as late (scheduled {Date} {Slot}).",
                    booking.BookingNumber, booking.ScheduledDate.ToString("yyyy-MM-dd"), booking.TimeSlot);
            }

            await db.SaveChangesAsync(ct);
            return late.Count;
        }
    }
}
