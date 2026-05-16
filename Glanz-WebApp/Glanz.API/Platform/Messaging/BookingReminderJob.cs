using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Platform.Messaging
{
    /// <summary>
    /// Sends SMS/WhatsApp reminders for upcoming bookings.
    /// Runs once per hour via BookingMaintenanceService.
    /// Reminder windows configurable via appsettings Messaging:ReminderHoursBefore (default: 24).
    /// Tracks sent reminders via a tag on the booking to avoid duplicates.
    /// </summary>
    public class BookingReminderJob
    {
        private readonly AppDbContext _context;
        private readonly ISmsService _sms;
        private readonly IConfiguration _config;
        private readonly ILogger<BookingReminderJob> _logger;

        public BookingReminderJob(AppDbContext context, ISmsService sms, IConfiguration config, ILogger<BookingReminderJob> logger)
        {
            _context = context;
            _sms = sms;
            _config = config;
            _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var enabled = _config.GetValue<bool>("Messaging:SmsRemindersEnabled");
            if (!enabled) return;

            var reminderHours = _config.GetValue<int>("Messaging:ReminderHoursBefore", 24);
            var useWhatsApp = _config.GetValue<bool>("Messaging:UseWhatsApp");

            var windowStart = DateTime.UtcNow.AddHours(reminderHours - 1);
            var windowEnd = DateTime.UtcNow.AddHours(reminderHours + 1);

            var bookings = await _context.Bookings
                .Where(b => b.ScheduledDate >= windowStart && b.ScheduledDate <= windowEnd
                    && b.Status == BookingStatus.Confirmed
                    && b.CustomerPhone != null
                    && (b.ReminderSentAt == null))
                .ToListAsync(ct);

            int sent = 0;
            foreach (var booking in bookings)
            {
                var phone = booking.CustomerPhone!;
                var date = booking.ScheduledDate.ToString("ddd, MMM d");
                var message = $"Reminder: Your booking #{booking.BookingNumber} is scheduled for {date} at {booking.TimeSlot}. " +
                              $"Questions? Reply to this message.";

                var (success, error) = await _sms.SendAsync(phone, message, useWhatsApp);
                if (success)
                {
                    booking.ReminderSentAt = DateTime.UtcNow;
                    sent++;
                }
                else
                {
                    _logger.LogWarning("SMS reminder failed for booking {BookingNumber}: {Error}", booking.BookingNumber, error);
                }
            }

            if (sent > 0)
            {
                await _context.SaveChangesAsync(ct);
                _logger.LogInformation("BookingReminderJob sent {Count} SMS reminders", sent);
            }
        }
    }
}
