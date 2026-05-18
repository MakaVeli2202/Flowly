using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StaffRatingsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public StaffRatingsController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // Customer: rate worker after booking completes
        [Authorize(Roles = "Customer")]
        [HttpPost]
        public async Task<IActionResult> RateWorker([FromBody] CreateRatingDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var booking = await _db.Bookings.FirstOrDefaultAsync(b =>
                b.Id == dto.BookingId && b.UserId == userId.Value);
            if (booking == null) return NotFound(new { message = "Booking not found" });
            if (booking.Status != BookingStatus.Completed)
                return BadRequest(new { message = "Can only rate after booking is completed" });
            if (!booking.AssignedWorkerId.HasValue)
                return BadRequest(new { message = "No worker assigned to this booking" });

            var existing = await _db.StaffRatings
                .FirstOrDefaultAsync(r => r.BookingId == dto.BookingId);
            if (existing != null) return Conflict(new { message = "Already rated this booking" });

            var rating = new StaffRating
            {
                OrgId = booking.OrgId,
                BookingId = dto.BookingId,
                WorkerId = booking.AssignedWorkerId.Value,
                Rating = dto.Rating,
                Comment = dto.Comment?.Trim(),
                CreatedAt = DateTime.UtcNow
            };
            _db.StaffRatings.Add(rating);

            // Denormalize rating onto booking for quick access
            booking.WorkerRating = dto.Rating;
            booking.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Rating submitted" });
        }

        // Admin: get ratings for a worker
        [Authorize(Roles = "Admin")]
        [HttpGet("worker/{workerId}")]
        public async Task<IActionResult> GetWorkerRatings(int workerId)
        {
            var ratings = await _db.StaffRatings
                .AsNoTracking()
                .Where(r => r.WorkerId == workerId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.BookingId,
                    r.Rating,
                    r.Comment,
                    r.CreatedAt
                })
                .ToListAsync();

            var avg = ratings.Count > 0 ? ratings.Average(r => r.Rating) : 0;
            return Ok(new { averageRating = Math.Round(avg, 1), count = ratings.Count, ratings });
        }
    }

    public class CreateRatingDto
    {
        public int BookingId { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, 5)]
        public int Rating { get; set; }
        [System.ComponentModel.DataAnnotations.StringLength(500)]
        public string? Comment { get; set; }
    }
}
