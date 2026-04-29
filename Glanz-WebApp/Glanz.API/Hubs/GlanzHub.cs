using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Glanz.API.Hubs
{
    /// <summary>
    /// Central SignalR hub for all real-time features.
    ///
    /// Channel / Group naming:
    ///   location:admin:{workerId}       — admin live-map feed for a specific worker
    ///   location:customer:{bookingId}   — customer tracking (En Route → Start Job)
    ///   job:status:{bookingId}          — job lifecycle events (all parties)
    ///   notifications:{userId}          — per-user notification feed
    ///
    /// Workers INVOKE hub methods to push updates (GPS location).
    /// Admins / customers JOIN groups to RECEIVE updates.
    /// The server-side IRealtimeService broadcasts notifications and job status.
    /// </summary>
    [Authorize]
    public class GlanzHub : Hub
    {
        private readonly ILogger<GlanzHub> _logger;

        public GlanzHub(ILogger<GlanzHub> logger)
        {
            _logger = logger;
        }

        // ── Connection lifecycle ──────────────────────────────────────────────

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId.HasValue)
            {
                // Every user auto-joins their personal notification group on connect.
                await Groups.AddToGroupAsync(Context.ConnectionId, $"notifications:{userId.Value}");
                _logger.LogInformation("SignalR: user {UserId} connected ({ConnectionId})", userId, Context.ConnectionId);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            _logger.LogInformation("SignalR: user {UserId} disconnected ({ConnectionId})", userId, Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        // ── Worker → Server: location updates ────────────────────────────────

        /// <summary>
        /// Called by the worker app every 8 s (throttled to 20 m / 10 s before sending).
        /// Broadcasts the worker's location to ALL admins watching that worker.
        /// </summary>
        public async Task UpdateAdminLocation(double latitude, double longitude)
        {
            var workerId = GetUserId();
            if (workerId == null) return;

            var payload = new
            {
                workerId  = workerId.Value,
                latitude,
                longitude,
                timestamp = DateTime.UtcNow,
                stream    = "admin",
            };

            // Broadcast to specific-worker group (single-worker focused views)
            await Clients.Group($"location:admin:{workerId.Value}").SendAsync("LocationUpdate", payload);
            // Also broadcast to the "all" group used by the live map
            await Clients.Group("location:admin:all").SendAsync("LocationUpdate", payload);
        }

        /// <summary>
        /// Called when worker presses "On My Way" — starts broadcasting to the customer.
        /// </summary>
        public async Task StartCustomerStream(int bookingId)
        {
            var workerId = GetUserId();
            if (workerId == null) return;

            // Broadcast a status event so the customer's app knows tracking started.
            await Clients.Group($"job:status:{bookingId}").SendAsync("JobStatusUpdate", new
            {
                bookingId,
                status    = "EN_ROUTE",
                workerId  = workerId.Value,
                timestamp = DateTime.UtcNow,
            });
        }

        /// <summary>
        /// Called each GPS tick while customer stream is active (after "On My Way").
        /// Broadcasts only to the customer group for this booking.
        /// </summary>
        public async Task UpdateCustomerLocation(int bookingId, double latitude, double longitude)
        {
            var workerId = GetUserId();
            if (workerId == null) return;

            await Clients.Group($"location:customer:{bookingId}").SendAsync("LocationUpdate", new
            {
                workerId  = workerId.Value,
                bookingId,
                latitude,
                longitude,
                timestamp = DateTime.UtcNow,
                stream    = "customer",
            });
        }

        /// <summary>
        /// Called when worker presses "Start Job" — stops the customer tracking stream.
        /// Admin stream is unaffected and continues.
        /// </summary>
        public async Task StopCustomerStream(int bookingId)
        {
            var workerId = GetUserId();
            if (workerId == null) return;

            await Clients.Group($"job:status:{bookingId}").SendAsync("JobStatusUpdate", new
            {
                bookingId,
                status    = "IN_PROGRESS",
                workerId  = workerId.Value,
                timestamp = DateTime.UtcNow,
            });
        }

        // ── Client → Server: group subscriptions ─────────────────────────────

        /// <summary>Admins call this to receive GPS updates for a specific worker.</summary>
        public async Task SubscribeToAdminLocation(int workerId)
        {
            if (!IsAdminOrSelf(workerId)) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"location:admin:{workerId}");
        }

        /// <summary>Customers/admins call this to receive GPS updates for a booking en route.</summary>
        public async Task SubscribeToCustomerLocation(int bookingId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"location:customer:{bookingId}");
        }

        /// <summary>Anyone call this to receive job lifecycle events for a booking.</summary>
        public async Task SubscribeToJobStatus(int bookingId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"job:status:{bookingId}");
        }

        /// <summary>Unsubscribes from a job's status group (e.g. when leaving booking detail screen).</summary>
        public async Task UnsubscribeFromJobStatus(int bookingId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"job:status:{bookingId}");
        }

        /// <summary>Admins subscribe to the live worker map — all workers.</summary>
        public async Task SubscribeToAllAdminLocations()
        {
            if (!IsAdmin()) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, "location:admin:all");
        }

        // ── Admin override: force-stop worker location stream ────────────────

        /// <summary>
        /// Admin sends a ForceStop event to a worker's notification channel.
        /// The worker client receives it and self-terminates location tracking.
        /// </summary>
        public async Task ForceStopWorker(int workerId)
        {
            if (!IsAdmin()) return;

            await Clients.Group($"notifications:{workerId}").SendAsync("ForceStop", new
            {
                workerId,
                reason    = "Stopped by admin",
                timestamp = DateTime.UtcNow,
            });

            _logger.LogInformation("SignalR: admin force-stopped worker {WorkerId}", workerId);
        }

        /// <summary>
        /// Admin revokes a worker's tracking session (sends RevokeTracking command).
        /// The worker client disconnects its location stream upon receipt.
        /// </summary>
        public async Task RevokeTrackingSession(int workerId)
        {
            if (!IsAdmin()) return;

            await Clients.Group($"notifications:{workerId}").SendAsync("RevokeTracking", new
            {
                workerId,
                timestamp = DateTime.UtcNow,
            });

            _logger.LogInformation("SignalR: admin revoked tracking session for worker {WorkerId}", workerId);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private int? GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)
                     ?? Context.User?.FindFirst("sub")
                     ?? Context.User?.FindFirst("nameid");
            if (claim != null && int.TryParse(claim.Value, out var id)) return id;
            return null;
        }

        private bool IsAdmin()
            => Context.User?.IsInRole("Admin") == true;

        private bool IsAdminOrSelf(int workerId)
            => IsAdmin() || GetUserId() == workerId;
    }
}
