using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Services
{
    // ─────────────────────────────────────────────────────────────────────────────
    // BirthdayOfferJob  - runs daily, sends birthday + anniversary push offers
    // ─────────────────────────────────────────────────────────────────────────────
    public class BirthdayOfferJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<BirthdayOfferJob> _logger;

        public BirthdayOfferJob(IServiceScopeFactory scopes, ILogger<BirthdayOfferJob> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromMinutes(2), ct);
            while (!ct.IsCancellationRequested)
            {
                try { await RunAsync(ct); }
                catch (Exception ex) { _logger.LogError(ex, "BirthdayOfferJob error"); }
                var next = DateTime.UtcNow.Date.AddDays(1);
                await Task.Delay(next - DateTime.UtcNow, ct);
            }
        }

        private async Task RunAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db   = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IExpoPushService>();

            var today    = DateTime.UtcNow;
            var thisYear = today.Year;

            var orgIds = await db.Organizations
                .Where(o => o.IsActive)
                .Select(o => o.Id)
                .ToListAsync(ct);

            foreach (var orgId in orgIds)
            {
                var cfg = await db.OrgNotificationConfigs.FindAsync(new object[] { orgId }, ct)
                          ?? new OrgNotificationConfig { OrgId = orgId };

                var customers = await db.Users
                    .Where(u => u.OrgId == orgId && u.Role == "Customer" && u.IsActive
                                && u.ExpoPushToken != null
                                && u.DeletionRequestedAt == null)
                    .ToListAsync(ct);

                foreach (var c in customers)
                {
                    if (cfg.BirthdayOfferEnabled && c.DateOfBirth.HasValue)
                    {
                        var dob = c.DateOfBirth.Value;
                        if (dob.Month == today.Month && dob.Day == today.Day
                            && c.BirthdayOfferSentYear != thisYear)
                        {
                            var msg = cfg.BirthdayMessageTemplate
                                .Replace("{firstName}", c.FirstName)
                                .Replace("{discount}", cfg.BirthdayDiscountPct.ToString());

                            await push.SendAsync(c.ExpoPushToken!,
                                "Happy Birthday!",
                                msg,
                                new { type = "birthday_offer", discountPct = cfg.BirthdayDiscountPct });

                            c.BirthdayOfferSentYear = thisYear;
                        }
                    }

                    if (cfg.AnniversaryOfferEnabled && c.FirstWashCompletedAt.HasValue)
                    {
                        var ann = c.FirstWashCompletedAt.Value;
                        if (ann.Month == today.Month && ann.Day == today.Day
                            && ann.Year != thisYear
                            && c.AnniversaryOfferSentYear != thisYear)
                        {
                            var msg = cfg.AnniversaryMessageTemplate
                                .Replace("{firstName}", c.FirstName)
                                .Replace("{discount}", cfg.AnniversaryDiscountPct.ToString());

                            await push.SendAsync(c.ExpoPushToken!,
                                "Your Flowly Anniversary!",
                                msg,
                                new { type = "anniversary_offer", discountPct = cfg.AnniversaryDiscountPct });

                            c.AnniversaryOfferSentYear = thisYear;
                        }
                    }
                }

                await db.SaveChangesAsync(ct);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ReviewRequestPushJob - runs every 15 min, sends review push after completion
    // ─────────────────────────────────────────────────────────────────────────────
    public class ReviewRequestPushJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ReviewRequestPushJob> _logger;

        public ReviewRequestPushJob(IServiceScopeFactory scopes, ILogger<ReviewRequestPushJob> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromMinutes(3), ct);
            while (!ct.IsCancellationRequested)
            {
                try { await RunAsync(ct); }
                catch (Exception ex) { _logger.LogError(ex, "ReviewRequestPushJob error"); }
                await Task.Delay(TimeSpan.FromMinutes(15), ct);
            }
        }

        private async Task RunAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db   = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IExpoPushService>();

            var now = DateTime.UtcNow;

            var candidates = await db.Bookings
                .Include(b => b.User)
                .Where(b => b.Status == BookingStatus.Completed
                            && b.OrgId != null
                            && b.User != null
                            && b.User.ExpoPushToken != null
                            && b.User.DeletionRequestedAt == null
                            && (b.User.ReviewRequestSentAt == null || b.User.ReviewRequestSentAt < b.UpdatedAt))
                .ToListAsync(ct);

            foreach (var grp in candidates.GroupBy(b => b.OrgId!.Value))
            {
                var cfg = await db.OrgNotificationConfigs.FindAsync(new object[] { grp.Key }, ct)
                          ?? new OrgNotificationConfig { OrgId = grp.Key };

                if (!cfg.ReviewRequestEnabled) continue;

                var delayThreshold = now.AddHours(-cfg.ReviewRequestDelayHours);

                foreach (var booking in grp)
                {
                    if (booking.UpdatedAt > delayThreshold) continue;

                    await push.SendAsync(booking.User!.ExpoPushToken!,
                        "How was your experience?",
                        cfg.ReviewRequestTemplate,
                        new { type = "review_request", bookingId = booking.Id });

                    booking.User.ReviewRequestSentAt = now;
                }
            }

            await db.SaveChangesAsync(ct);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PushReminderJob - runs every 30 min, sends push reminders + escalation
    // (complements the existing BookingReminderJob which handles SMS/WhatsApp)
    // ─────────────────────────────────────────────────────────────────────────────
    public class PushReminderJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<PushReminderJob> _logger;

        public PushReminderJob(IServiceScopeFactory scopes, ILogger<PushReminderJob> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromMinutes(5), ct);
            while (!ct.IsCancellationRequested)
            {
                try { await RunAsync(ct); }
                catch (Exception ex) { _logger.LogError(ex, "PushReminderJob error"); }
                await Task.Delay(TimeSpan.FromMinutes(30), ct);
            }
        }

        private async Task RunAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db   = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IExpoPushService>();

            var now = DateTime.UtcNow;

            var upcoming = await db.Bookings
                .Include(b => b.User)
                .Where(b => (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Pending)
                            && b.OrgId != null
                            && b.ScheduledDate > now
                            && b.ScheduledDate <= now.AddHours(25)
                            && b.User != null
                            && b.User.ExpoPushToken != null
                            && b.User.DeletionRequestedAt == null)
                .ToListAsync(ct);

            foreach (var grp in upcoming.GroupBy(b => b.OrgId!.Value))
            {
                var cfg = await db.OrgNotificationConfigs.FindAsync(new object[] { grp.Key }, ct)
                          ?? new OrgNotificationConfig { OrgId = grp.Key };

                foreach (var booking in grp)
                {
                    var hoursUntil = (booking.ScheduledDate - now).TotalHours;
                    var timeStr = booking.ScheduledDate.ToString("h:mm tt");

                    if (cfg.ReminderEnabled
                        && hoursUntil <= cfg.ReminderHoursBefore
                        && hoursUntil > cfg.ReminderHoursBefore - 0.5
                        && booking.ReminderSentAt == null)
                    {
                        var msg = cfg.ReminderTemplate.Replace("{time}", timeStr);
                        await push.SendAsync(booking.User!.ExpoPushToken!,
                            "Booking Reminder",
                            msg,
                            new { type = "booking_reminder", bookingId = booking.Id });

                        booking.ReminderSentAt = now;
                    }

                    if (cfg.EscalationEnabled
                        && hoursUntil <= cfg.EscalationHoursBefore
                        && hoursUntil > cfg.EscalationHoursBefore - 0.5
                        && booking.EscalationSentAt == null)
                    {
                        var msg = cfg.EscalationTemplate
                            .Replace("{hours}", ((int)hoursUntil).ToString())
                            .Replace("{time}", timeStr);

                        await push.SendAsync(booking.User!.ExpoPushToken!,
                            "Confirm Your Booking",
                            msg,
                            new { type = "booking_escalation", bookingId = booking.Id });

                        booking.EscalationSentAt = now;
                    }
                }
            }

            await db.SaveChangesAsync(ct);
        }
    }
}
