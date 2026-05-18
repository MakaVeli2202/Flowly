using Glanz.API.Data;
using Glanz.API.Platform.AuditEvents;
using Glanz.API.Platform.Messaging;
using Glanz.API.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Modules.Automation
{
    // Executes automation rules when domain events fire.
    public class AutomationRuleExecutor :
        INotificationHandler<BookingCompletedEvent>,
        INotificationHandler<BookingCancelledEvent>
    {
        private readonly IAutomationRuleService _rules;
        private readonly ISmsService _sms;
        private readonly IExpoPushService _push;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AutomationRuleExecutor> _logger;

        public AutomationRuleExecutor(
            IAutomationRuleService rules,
            ISmsService sms,
            IExpoPushService push,
            IServiceScopeFactory scopeFactory,
            ILogger<AutomationRuleExecutor> logger)
        {
            _rules = rules;
            _sms = sms;
            _push = push;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Handle(BookingCompletedEvent e, CancellationToken ct)
        {
            var activeRules = await _rules.GetActiveRulesForEventAsync(e.OrgId, "BookingCompleted");
            foreach (var rule in activeRules)
                await ExecuteRuleAsync(rule, e.OrgId, e.BookingId, ct);
        }

        public async Task Handle(BookingCancelledEvent e, CancellationToken ct)
        {
            var activeRules = await _rules.GetActiveRulesForEventAsync(e.OrgId, "BookingCancelled");
            foreach (var rule in activeRules)
                await ExecuteRuleAsync(rule, e.OrgId, e.BookingId, ct);

            // Built-in: auto-notify waitlist when a booking is cancelled
            await AutoNotifyWaitlistAsync(e.OrgId, e.BookingId, ct);
        }

        // ── Rule actions ────────────────────────────────────────────────────

        private async Task ExecuteRuleAsync(Models.AutomationRule rule, int orgId, int bookingId, CancellationToken ct)
        {
            try
            {
                switch (rule.ActionType)
                {
                    case "SendReviewRequest":
                        await SendReviewRequestAsync(orgId, bookingId, rule.DelayMinutes, ct);
                        break;

                    case "SendReminderPush":
                        _logger.LogInformation("[Automation] SendReminderPush rule {RuleId} triggered for booking {BookingId}", rule.Id, bookingId);
                        break;

                    case "NotifyWaitlist":
                        await AutoNotifyWaitlistAsync(orgId, bookingId, ct);
                        break;

                    default:
                        _logger.LogWarning("[Automation] Unknown action type {Action} on rule {RuleId}", rule.ActionType, rule.Id);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Automation] Rule {RuleId} failed for booking {BookingId}", rule.Id, bookingId);
            }
        }

        private async Task SendReviewRequestAsync(int orgId, int bookingId, int delayMinutes, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var booking = await db.Bookings.AsNoTracking()
                .IgnoreQueryFilters()
                .Include(b => b.User)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking?.User?.Phone == null) return;

            if (delayMinutes > 0)
                await Task.Delay(TimeSpan.FromMinutes(delayMinutes), ct);

            var message = $"Thank you for using Flowly! We'd love your feedback. Please rate your experience: https://flowly.qa/feedback/{booking.BookingNumber}";
            var (ok, err) = await _sms.SendAsync(booking.User.Phone, message);

            if (!ok)
                _logger.LogWarning("[Automation] Review SMS failed for booking {BookingId}: {Error}", bookingId, err);
            else
                _logger.LogInformation("[Automation] Review SMS sent for booking {BookingId}", bookingId);
        }

        private async Task AutoNotifyWaitlistAsync(int orgId, int bookingId, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var booking = await db.Bookings.AsNoTracking()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking == null) return;

            var waiting = await db.WaitlistEntries
                .IgnoreQueryFilters()
                .Include(w => w.User)
                .Where(w => w.OrgId == orgId
                         && w.RequestedDate.Date == booking.ScheduledDate.Date
                         && w.Status == "Waiting")
                .OrderBy(w => w.CreatedAt)
                .Take(3)
                .ToListAsync(ct);

            if (waiting.Count == 0) return;

            foreach (var entry in waiting)
            {
                entry.Status = "Notified";
                var dateStr = booking.ScheduledDate.ToString("d MMM");
                var pushMsg = $"Good news! A slot opened on {dateStr}. Tap to book now.";

                // Push notification (preferred channel)
                if (entry.User?.ExpoPushToken != null)
                {
                    await _push.SendAsync(entry.User.ExpoPushToken,
                        "Slot Available!",
                        pushMsg,
                        new { type = "waitlist_slot_available", date = booking.ScheduledDate });
                    _logger.LogInformation("[Waitlist] Push sent to user {UserId} for {Date}", entry.UserId, dateStr);
                }
                // SMS fallback for users without the app
                else if (entry.User?.Phone != null)
                {
                    var smsMsg = $"Good news! A slot has opened on {dateStr}. Book now at https://flowly.qa/booking";
                    var (ok, _) = await _sms.SendAsync(entry.User.Phone, smsMsg);
                    _logger.LogInformation("[Waitlist] SMS sent to user {UserId} for {Date}: {Ok}", entry.UserId, dateStr, ok);
                }
            }

            await db.SaveChangesAsync(ct);
        }
    }
}
