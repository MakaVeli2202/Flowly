using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Services;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Controllers
{
    public class UpdateLocationDto
    {
        [Required]
        public int BookingId { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        public DateTime? Timestamp { get; set; }
    }

    [ApiController]
    [Route("api/location")]
    [Authorize]
    public class LocationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<LocationController> _logger;
        private readonly IRealtimeService _realtime;

        public LocationController(AppDbContext context, ILogger<LocationController> logger, IRealtimeService realtime)
        {
            _context  = context;
            _logger   = logger;
            _realtime = realtime;
        }

        [HttpPost("update")]
        public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationDto dto)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized(new { message = "User not authenticated" });

            var booking = await _context.Bookings
                .FirstOrDefaultAsync(b => b.Id == dto.BookingId);

            if (booking == null)
                return NotFound(new { message = "Booking not found" });

            if (booking.AssignedWorkerId != userId)
                return Forbid();

            if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                return BadRequest(new { message = "Cannot update location for cancelled or completed bookings" });

            var location = await _context.WorkerLocations
                .FirstOrDefaultAsync(wl => wl.BookingId == dto.BookingId && wl.WorkerId == userId);

            if (location == null)
            {
                location = new WorkerLocation
                {
                    WorkerId = userId.Value,
                    BookingId = dto.BookingId,
                    Latitude = dto.Latitude,
                    Longitude = dto.Longitude,
                    Timestamp = dto.Timestamp ?? DateTime.UtcNow,
                    IsActive = true,
                    Status = booking.WorkStartedAt.HasValue
                        ? BookingStatus.InProgress.ToString()
                        : booking.WorkerOnMyWayAt.HasValue
                            ? "OnTheWay"
                            : booking.Status.ToString()
                };
                _context.WorkerLocations.Add(location);
            }
            else
            {
                location.Latitude = dto.Latitude;
                location.Longitude = dto.Longitude;
                location.Timestamp = dto.Timestamp ?? DateTime.UtcNow;
                location.IsActive = true;
                location.Status = booking.WorkStartedAt.HasValue
                    ? BookingStatus.InProgress.ToString()
                    : booking.WorkerOnMyWayAt.HasValue
                        ? "OnTheWay"
                        : booking.Status.ToString();
            }

            await _context.SaveChangesAsync();

            // Also broadcast via WebSocket for clients that have an active SignalR connection.
            // Workers using the WebSocket path call GlanzHub.UpdateAdminLocation directly,
            // but this HTTP fallback ensures the map stays current for non-WS callers.
            await _realtime.BroadcastAdminLocationAsync(userId.Value, dto.Latitude, dto.Longitude);

            return Ok(new { message = "Location updated", locationId = location.Id });
        }

        [HttpGet("{bookingId}")]
        public async Task<IActionResult> GetLocation(int bookingId)
        {
            var location = await _context.WorkerLocations
                .Where(wl => wl.BookingId == bookingId)
                .OrderByDescending(wl => wl.Timestamp)
                .FirstOrDefaultAsync();

            if (location == null)
                return NotFound(new { message = "No location data found for this booking" });

            return Ok(new
            {
                locationId = location.Id,
                workerId = location.WorkerId,
                bookingId = location.BookingId,
                latitude = location.Latitude,
                longitude = location.Longitude,
                timestamp = location.Timestamp,
                status = location.Status,
                isActive = location.IsActive
            });
        }

        [HttpPost("stop/{bookingId}")]
        public async Task<IActionResult> StopLocation(int bookingId)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var locations = await _context.WorkerLocations
                .Where(wl => wl.BookingId == bookingId && wl.WorkerId == userId)
                .ToListAsync();

            foreach (var loc in locations)
            {
                loc.IsActive = false;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Location tracking stopped" });
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return null;
            return userId;
        }
    }

    [ApiController]
    [Route("api/admin/location")]
    [Authorize(Roles = "Admin")]
    public class AdminLocationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AdminLocationController> _logger;

        public AdminLocationController(AppDbContext context, ILogger<AdminLocationController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet("live-workers")]
        public async Task<IActionResult> GetLiveWorkers()
        {
            var activeLocations = await _context.WorkerLocations
                .Include(wl => wl.Worker)
                .Include(wl => wl.Booking)
                .Where(wl => wl.IsActive)
                .GroupBy(wl => wl.WorkerId)
                .Select(g => g.OrderByDescending(wl => wl.Timestamp).First())
                .ToListAsync();

            activeLocations = activeLocations
                .Where(wl => wl.Worker != null)
                .ToList();

            var result = activeLocations.Select(wl => new
            {
                workerId = wl.WorkerId,
                workerName = wl.Worker != null ? $"{wl.Worker.FirstName} {wl.Worker.LastName}" : "Unknown",
                workerEmail = wl.Worker?.Email,
                latitude = wl.Latitude,
                longitude = wl.Longitude,
                timestamp = wl.Timestamp,
                status = wl.Status,
                currentBooking = wl.Booking != null ? new
                {
                    bookingId = wl.BookingId,
                    bookingNumber = wl.Booking.BookingNumber,
                    customerName = wl.Booking.CustomerName,
                    customerAddress = wl.Booking.CustomerAddress,
                    bookingStatus = wl.Booking.Status.ToString()
                } : null
            }).ToList();

            return Ok(result);
        }

        [HttpGet("all-active")]
        public async Task<IActionResult> GetAllActiveLocations()
        {
            var locations = await _context.WorkerLocations
                .Include(wl => wl.Worker)
                .Where(wl => wl.IsActive)
                .GroupBy(wl => wl.WorkerId)
                .Select(g => g.OrderByDescending(wl => wl.Timestamp).First())
                .ToListAsync();

            locations = locations
                .Where(wl => wl.Worker != null)
                .ToList();

            return Ok(locations.Select(wl => new
            {
                workerId = wl.WorkerId,
                workerName = wl.Worker != null ? $"{wl.Worker.FirstName} {wl.Worker.LastName}" : "Unknown",
                latitude = wl.Latitude,
                longitude = wl.Longitude,
                timestamp = wl.Timestamp,
                status = wl.Status
            }));
        }
    }
}