using Glanz.API.Hubs;
using Glanz.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Glanz.API.Services
{
    public interface IRealtimeService
    {
        /// <summary>Broadcasts a location update to admins watching a specific worker.</summary>
        Task BroadcastAdminLocationAsync(int workerId, double latitude, double longitude);

        /// <summary>Broadcasts a job lifecycle status change to all subscribed parties.</summary>
        Task BroadcastJobStatusAsync(int bookingId, string status, int? workerId = null);

        /// <summary>Pushes a notification to a single user's notification feed.</summary>
        Task BroadcastNotificationAsync(int userId, int notificationId, NotificationType type, string message, int? bookingId = null);

        /// <summary>Pushes a notification to multiple admin users at once.</summary>
        Task BroadcastNotificationToUsersAsync(IEnumerable<int> userIds, int notificationId, NotificationType type, string message, int? bookingId = null);
    }

    public class RealtimeService : IRealtimeService
    {
        private readonly IHubContext<GlanzHub> _hub;

        public RealtimeService(IHubContext<GlanzHub> hub)
        {
            _hub = hub;
        }

        public Task BroadcastAdminLocationAsync(int workerId, double latitude, double longitude)
        {
            return _hub.Clients
                .Group($"location:admin:{workerId}")
                .SendAsync("LocationUpdate", new
                {
                    workerId,
                    latitude,
                    longitude,
                    timestamp = DateTime.UtcNow,
                    stream    = "admin",
                });
        }

        public Task BroadcastJobStatusAsync(int bookingId, string status, int? workerId = null)
        {
            return _hub.Clients
                .Group($"job:status:{bookingId}")
                .SendAsync("JobStatusUpdate", new
                {
                    bookingId,
                    status,
                    workerId,
                    timestamp = DateTime.UtcNow,
                });
        }

        public Task BroadcastNotificationAsync(int userId, int notificationId, NotificationType type, string message, int? bookingId = null)
        {
            return _hub.Clients
                .Group($"notifications:{userId}")
                .SendAsync("Notification", new
                {
                    id        = notificationId,
                    type      = type.ToString(),
                    message,
                    bookingId,
                    timestamp = DateTime.UtcNow,
                    isRead    = false,
                });
        }

        public async Task BroadcastNotificationToUsersAsync(IEnumerable<int> userIds, int notificationId, NotificationType type, string message, int? bookingId = null)
        {
            var tasks = userIds.Select(uid => BroadcastNotificationAsync(uid, notificationId, type, message, bookingId));
            await Task.WhenAll(tasks);
        }
    }
}
