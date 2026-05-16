using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;

namespace Glanz.API.Controllers
{
    /// <summary>
    /// GDPR (DSGVO) compliance endpoints:
    ///   GET  /api/Gdpr/export          - customer requests their data (JSON)
    ///   POST /api/Gdpr/delete-request  - customer requests account deletion (soft delete, scheduled hard delete after 30 days)
    ///   POST /api/Gdpr/admin/hard-delete/{id} - admin executes hard delete after 30-day window
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GdprController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GdprController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : null;
        }

        /// <summary>Customer: export all personal data as JSON.</summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportMyData()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user == null) return NotFound();

            var bookings = await _context.Bookings
                .Where(b => b.UserId == userId.Value)
                .Select(b => new { b.BookingNumber, b.ScheduledDate, b.TimeSlot, b.TotalAmount, Status = b.Status.ToString(), b.CreatedAt })
                .ToListAsync();

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value)
                .Select(n => new { n.Message, n.CreatedAt, n.IsRead })
                .ToListAsync();

            var feedback = await _context.CustomerFeedbacks
                .Where(f => f.UserId == userId.Value)
                .Select(f => new { f.Comment, f.Rating, f.CreatedAt })
                .ToListAsync();

            var export = new
            {
                exportedAt = DateTime.UtcNow,
                profile = new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Phone,
                    user.HomeAddress,
                    user.CreatedAt
                },
                bookings,
                notifications,
                feedback
            };

            var json = JsonSerializer.Serialize(export, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            return File(bytes, "application/json", $"my-data-{DateTime.UtcNow:yyyy-MM-dd}.json");
        }

        /// <summary>Customer: request account deletion. Sets a deletion flag; hard delete by admin after 30 days.</summary>
        [HttpPost("delete-request")]
        public async Task<IActionResult> RequestDeletion()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user == null) return NotFound();

            if (user.DeletionRequestedAt.HasValue)
                return BadRequest(new { message = "Deletion already requested.", scheduledFor = user.DeletionRequestedAt.Value.AddDays(30) });

            user.DeletionRequestedAt = DateTime.UtcNow;
            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Deletion request submitted. Your data will be permanently deleted after 30 days.",
                scheduledFor = user.DeletionRequestedAt.Value.AddDays(30)
            });
        }

        /// <summary>Admin: hard delete a user whose 30-day window has elapsed.</summary>
        [Authorize(Roles = "Admin")]
        [HttpPost("admin/hard-delete/{id}")]
        public async Task<IActionResult> HardDelete(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound(new { message = "User not found." });

            if (!user.DeletionRequestedAt.HasValue)
                return BadRequest(new { message = "No deletion request on record for this user." });

            var daysSinceRequest = (DateTime.UtcNow - user.DeletionRequestedAt.Value).TotalDays;
            if (daysSinceRequest < 30)
                return BadRequest(new { message = $"30-day window not elapsed. {30 - (int)daysSinceRequest} day(s) remaining." });

            // Anonymise rather than hard-delete to preserve booking history integrity
            user.FirstName = "Deleted";
            user.LastName = "User";
            user.Email = $"deleted-{user.Id}@gdpr.invalid";
            user.Phone = null;
            user.HomeAddress = null;
            user.ProfileImageUrl = null;
            user.ExpoPushToken = null;
            user.PasswordHash = "GDPR_DELETED";
            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "User data permanently anonymised." });
        }

        /// <summary>Admin: list users who have requested deletion.</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/deletion-requests")]
        public async Task<IActionResult> GetDeletionRequests()
        {
            var users = await _context.Users
                .Where(u => u.DeletionRequestedAt.HasValue)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.DeletionRequestedAt,
                    ScheduledHardDelete = u.DeletionRequestedAt!.Value.AddDays(30),
                    ReadyForDeletion = (DateTime.UtcNow - u.DeletionRequestedAt.Value).TotalDays >= 30
                })
                .ToListAsync();

            return Ok(users);
        }
    }
}
