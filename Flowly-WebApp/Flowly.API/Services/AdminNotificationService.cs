using Flowly.API.Data;
using Flowly.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Services
{
    public interface IAdminNotificationService
    {
        Task NotifyNewBookingAsync(Booking booking);
        Task NotifyBookingStatusChangedAsync(Booking booking, BookingStatus previousStatus);
        Task NotifyBookingClaimedAsync(Booking booking, int workerId);
        Task NotifyBookingCancelledAsync(Booking booking);
        Task NotifyLowStockAsync(Product product);
        Task NotifyJobStartedAsync(Booking booking);
        Task NotifyWorkerArrivedAsync(Booking booking);
        Task NotifyWorkerOnMyWayAsync(Booking booking);
        Task NotifyWorkerRunningLateAsync(Booking booking, int delayMinutes, string reason);
        Task NotifyJobCompletedAsync(Booking booking);
        Task NotifyOfferAssignedAsync(int userId, Offer offer, string personalCode);
        Task NotifyLoyaltyCouponEarnedAsync(int userId, Offer offer, string personalCode);
        Task NotifyJobPausedAsync(Booking booking, string reason);
        Task NotifyJobResumedAsync(Booking booking);
        Task NotifyUnassignedBookingAsync(Booking booking, string absentWorkerName);
        Task NotifyBookingEditedByAdminAsync(Booking booking);
        Task NotifyCancellationRequestedAsync(Booking booking);
        Task NotifyRescheduleRequestedAsync(Booking booking, string? preferredDate, string? preferredTime);
        Task NotifyServiceAddedAsync(Booking booking, string serviceName, decimal newTotal, int newDurationMinutes);
        Task NotifyCancellationRequestRejectedAsync(Booking booking);
        Task NotifyRescheduleRequestRejectedAsync(Booking booking);
        Task NotifyLoyaltyReviewRequestedAsync(User user);
        Task SendPushNotificationAsync(string expoPushToken, string title, string body);
    }
       

    public class AdminNotificationService : IAdminNotificationService
    {
        private const int LowStockThreshold = 20;
        private readonly AppDbContext _context;
        private readonly IExpoPushService _expoPush;
        private readonly IRealtimeService _realtime;

        public AdminNotificationService(AppDbContext context, IExpoPushService expoPush, IRealtimeService realtime)
        {
            _context  = context;
            _expoPush = expoPush;
            _realtime = realtime;
        }

        public Task NotifyNewBookingAsync(Booking booking)
        {
            var adminMessage = $"New booking from {booking.CustomerName} — {booking.ScheduledDate:dd MMM} at {booking.TimeSlot}.";
            var customerMessage = $"You're booked! We'll see you on {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}. We can't wait to make your car shine.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.NewBooking,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyBookingStatusChangedAsync(Booking booking, BookingStatus previousStatus)
        {
            if (booking.Status == previousStatus)
            {
                return Task.CompletedTask;
            }

            var adminMessage = $"{booking.BookingNumber} is now {booking.Status}.";

            string? customerMessage = booking.Status switch
            {
                BookingStatus.Confirmed => $"Your booking is confirmed for {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}. See you soon!",
                BookingStatus.Cancelled => "Your booking has been cancelled. We're sorry for any inconvenience — we'd love to help you rebook.",
                _ => null
            };

            if (customerMessage != null && booking.UserId.HasValue)
            {
                return NotifyAdminsAndCustomerAsync(
                    NotificationType.BookingStatusChanged,
                    adminMessage,
                    booking.Id,
                    booking.UserId,
                    customerMessage);
            }

            return CreateForAllAdminsAsync(NotificationType.BookingStatusChanged, adminMessage, booking.Id);
        }

        public Task NotifyBookingClaimedAsync(Booking booking, int workerId)
        {
            var adminMessage = $"{GetWorkerName(workerId)} picked up {booking.BookingNumber}.";
            var customerMessage = $"A detailer is assigned to your booking on {booking.ScheduledDate:dd MMM} at {booking.TimeSlot}. They'll be there right on time!";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingAssigned,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyBookingCancelledAsync(Booking booking)
        {
            var adminMessage = $"{booking.CustomerName}'s booking has been cancelled.";
            var customerMessage = "Your booking has been cancelled. We're sorry for any inconvenience — feel free to rebook anytime.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingCancelled,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public async Task NotifyLowStockAsync(Product product)
        {
            if (product.StockQuantity > LowStockThreshold)
            {
                return;
            }

            var message = $"{product.Name} is running low — only {product.StockQuantity} {product.Unit} left.";
            var hasRecentUnread = await _context.Notifications.AnyAsync(n =>
                n.Type == NotificationType.LowStock &&
                n.Message == message &&
                !n.IsRead &&
                n.CreatedAt >= DateTime.UtcNow.AddDays(-1));

            if (hasRecentUnread)
            {
                return;
            }

            await CreateForAllAdminsAsync(NotificationType.LowStock, message);
        }

        public Task NotifyJobStartedAsync(Booking booking)
        {
            var adminMessage = $"{GetWorkerName(booking.AssignedWorkerId)} started work on {booking.BookingNumber}.";
            var customerMessage = "Your detailer has started — the magic is happening! We'll let you know when it's done.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.JobStarted,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyWorkerArrivedAsync(Booking booking)
        {
            var adminMessage = $"{GetWorkerName(booking.AssignedWorkerId)} arrived at {booking.CustomerName}'s location.";
            var customerMessage = "Your detailer has arrived! They're ready to get started.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.WorkerArrived,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyWorkerOnMyWayAsync(Booking booking)
        {
            var adminMessage = $"{GetWorkerName(booking.AssignedWorkerId)} is on the way to {booking.CustomerName}'s location.";
            var customerMessage = "Your detailer is on the way and will arrive shortly. We'll keep you updated!";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.WorkerOnMyWay,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyWorkerRunningLateAsync(Booking booking, int delayMinutes, string reason)
        {
            var safeDelayMinutes = Math.Clamp(delayMinutes, 5, 120);
            var safeReason = string.IsNullOrWhiteSpace(reason) ? "Traffic delay" : reason.Trim();
            var adminMessage = $"{GetWorkerName(booking.AssignedWorkerId)} is running ~{safeDelayMinutes} mins late on {booking.BookingNumber}.";
            var customerMessage = $"Your detailer is on the way but running about {safeDelayMinutes} minutes late. Thanks for your patience — it'll be worth the wait!";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.WorkerRunningLate,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyJobCompletedAsync(Booking booking)
        {
            var durationText = "";
            if (booking.WorkDurationSeconds.HasValue)
            {
                var minutes = booking.WorkDurationSeconds.Value / 60;
                durationText = $" in {minutes} min";
            }
            var adminMessage = $"{GetWorkerName(booking.AssignedWorkerId)} completed {booking.BookingNumber}{durationText}.";
            var customerMessage = $"All done{durationText}! Your car is looking its best. Thank you for choosing Flowly - we hope to see you again soon!";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.JobCompleted,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyOfferAssignedAsync(int userId, Offer offer, string personalCode)
        {
            var offerName = string.IsNullOrWhiteSpace(offer.Name) ? "a special offer" : offer.Name.Trim();
            return CreateForUserAsync(
                userId,
                NotificationType.SpecialOffer,
                $"You've unlocked {offerName}! Use code {personalCode} on your next booking.");
        }

        public Task NotifyLoyaltyCouponEarnedAsync(int userId, Offer offer, string personalCode)
        {
            var offerName = string.IsNullOrWhiteSpace(offer.Name) ? "a loyalty reward" : offer.Name.Trim();
            return CreateForUserAsync(
                userId,
                NotificationType.LoyaltyReward,
                $"You've earned {offerName}! Leave us a Google review to activate it, then use code {personalCode}.");
        }

        public Task NotifyLoyaltyReviewRequestedAsync(User user)
        {
            var name = $"{user.FirstName} {user.LastName}".Trim();
            return CreateForAllAdminsAsync(
                NotificationType.LoyaltyReviewRequested,
                $"Customer {name} submitted a Google review and is requesting loyalty reward activation.");
        }

        private string GetWorkerName(int? workerId)
        {
            if (!workerId.HasValue)
            {
                return "Unknown";
            }

            var worker = _context.Staff.Where(s => s.Id == workerId).Select(s => $"{s.FirstName} {s.LastName}").FirstOrDefault();
            return worker ?? "Unknown";
        }

        private async Task CreateForAllAdminsAsync(NotificationType type, string message, int? bookingId = null)
        {
            var admins = await _context.Users
                .Where(u => u.Role == "Admin" && u.IsActive)
                .Select(u => new { u.Id, u.ExpoPushToken })
                .ToListAsync();

            if (admins.Count == 0)
            {
                Console.WriteLine($"Warning: No active admins found to notify for {type}");
                return;
            }

            var adminIds = admins.Select(a => a.Id).ToList();

            var notifications = adminIds.Select(adminId => new Notification
            {
                AdminId   = adminId,
                Type      = type,
                BookingId = bookingId,
                Message   = message,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            await _context.Notifications.AddRangeAsync(notifications);
            await _context.SaveChangesAsync();

            // WebSocket push — instant delivery to connected clients
            var savedIds = notifications.Select(n => n.Id).ToList();
            for (int i = 0; i < adminIds.Count; i++)
            {
                await _realtime.BroadcastNotificationAsync(
                    adminIds[i], savedIds[i], type, message, bookingId);
            }

            // Expo push — delivers even when app is closed
            var expoTokens = admins
                .Where(a => !string.IsNullOrWhiteSpace(a.ExpoPushToken))
                .Select(a => a.ExpoPushToken!);
            await _expoPush.SendBatchAsync(expoTokens, "Flowly", message, new { type = type.ToString(), bookingId });
        }

        private async Task CreateForUserAsync(int userId, NotificationType type, string message, int? bookingId = null)
        {
            var user = await _context.Users
                .Where(u => u.Id == userId && u.IsActive)
                .Select(u => new { u.Id, u.ExpoPushToken })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                Console.WriteLine($"Warning: User {userId} not found or inactive for {type} notification");
                return;
            }

            var notif = new Notification
            {
                UserId    = userId,
                Type      = type,
                BookingId = bookingId,
                Message   = message,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow,
            };
            await _context.Notifications.AddAsync(notif);
            await _context.SaveChangesAsync();

            // WebSocket push — instant delivery to connected clients
            await _realtime.BroadcastNotificationAsync(userId, notif.Id, type, message, bookingId);

            // Expo push — delivers even when app is closed
            if (!string.IsNullOrWhiteSpace(user.ExpoPushToken))
                await _expoPush.SendAsync(user.ExpoPushToken, "Flowly", message, new { type = type.ToString(), bookingId });
        }

        private async Task NotifyAdminsAndCustomerAsync(NotificationType type, string adminMessage, int? bookingId, int? userId, string customerMessage)
        {
            await CreateForAllAdminsAsync(type, adminMessage, bookingId);

            if (userId.HasValue)
            {
                await CreateForUserAsync(userId.Value, type, customerMessage, bookingId);
            }
        } 
        public Task NotifyJobPausedAsync(Booking booking, string reason)
        {
            var safeReason = string.IsNullOrWhiteSpace(reason) ? "No reason given" : reason.Trim();
            var workerName = GetWorkerName(booking.AssignedWorkerId);
            var adminMessage = $"{workerName} paused the job. Reason: {safeReason}.";
            var customerMessage = $"Your detailer paused the job for a moment. Reason: {safeReason}.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.JobPaused,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyJobResumedAsync(Booking booking)
        {
            var workerName = GetWorkerName(booking.AssignedWorkerId);
            var adminMessage = $"{workerName} resumed the job.";
            var customerMessage = "Your detailer has resumed your job and work is continuing.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.JobResumed,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyUnassignedBookingAsync(Booking booking, string absentWorkerName)
        {
            var adminMessage    = $"⚠️ {booking.BookingNumber} is unassigned — {absentWorkerName} is absent and no replacement was found for {booking.ScheduledDate:dd MMM} at {booking.TimeSlot}. Please contact the customer.";
            var customerMessage = $"We're working to find a detailer for your booking on {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}. Our team will be in touch shortly to confirm your detailer.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingStatusChanged,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyBookingEditedByAdminAsync(Booking booking)
        {
            var adminMessage    = $"📝 {booking.BookingNumber} was edited — now scheduled {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}.";
            var customerMessage = $"Your booking has been updated. New appointment: {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}. If you have questions, please contact us.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingStatusChanged,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyCancellationRequestedAsync(Booking booking)
        {
            var adminMessage = $"🚫 {booking.CustomerName} requested to cancel {booking.BookingNumber} ({booking.ScheduledDate:dd MMM} at {booking.TimeSlot}).";
            return CreateForAllAdminsAsync(NotificationType.NewBooking, adminMessage, booking.Id);
        }

        public Task NotifyRescheduleRequestedAsync(Booking booking, string? preferredDate, string? preferredTime)
        {
            var dateHint = string.IsNullOrWhiteSpace(preferredDate) ? "" : $" — prefers {preferredDate}{(string.IsNullOrWhiteSpace(preferredTime) ? "" : $" at {preferredTime}")}";
            var adminMessage = $"📅 {booking.CustomerName} wants to reschedule {booking.BookingNumber} (currently {booking.ScheduledDate:dd MMM} at {booking.TimeSlot}){dateHint}.";
            return CreateForAllAdminsAsync(NotificationType.BookingStatusChanged, adminMessage, booking.Id);
        }

        public Task NotifyServiceAddedAsync(Booking booking, string serviceName, decimal newTotal, int newDurationMinutes)
        {
            var hours   = newDurationMinutes / 60;
            var minutes = newDurationMinutes % 60;
            var duration = hours > 0
                ? $"{hours}h {minutes}m"
                : $"{minutes}m";

            var adminMessage    = $"➕ {GetWorkerName(booking.AssignedWorkerId)} added '{serviceName}' to {booking.BookingNumber}. New total: {newTotal:C}, estimated {duration}.";
            var customerMessage = $"Your detailer added '{serviceName}' to your booking. Updated total: {newTotal:C} — estimated completion in {duration}.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.ServiceAdded,
                adminMessage,
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyCancellationRequestRejectedAsync(Booking booking)
        {
            var customerMessage = $"Your cancellation request for booking {booking.BookingNumber} has been reviewed and rejected. Your booking remains scheduled for {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingStatusChanged,
                $"Admin rejected cancellation request for {booking.BookingNumber}.",
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public Task NotifyRescheduleRequestRejectedAsync(Booking booking)
        {
            var customerMessage = $"Your reschedule request for booking {booking.BookingNumber} has been reviewed and rejected. Your booking remains at the original date: {booking.ScheduledDate:dd MMM yyyy} at {booking.TimeSlot}.";
            return NotifyAdminsAndCustomerAsync(
                NotificationType.BookingStatusChanged,
                $"Admin rejected reschedule request for {booking.BookingNumber}.",
                booking.Id,
                booking.UserId,
                customerMessage);
        }

        public async Task SendPushNotificationAsync(string expoPushToken, string title, string body)
        {
            if (string.IsNullOrEmpty(expoPushToken)) return;

            try
            {
                await _expoPush.SendAsync(expoPushToken, title, body, new { type = "Reminder" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PushNotification] Failed to send: {ex.Message}");
            }
        }
    }
}