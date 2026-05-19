using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Services;
using System.Security.Claims;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IExpoPushService _expoPush;

        public NotificationsController(AppDbContext context, IExpoPushService expoPush)
        {
            _context  = context;
            _expoPush = expoPush;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        [HttpGet("unread-count")]
        public async Task<ActionResult<int>> GetUnreadCount()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var query = await BuildScopedQuery(userId.Value);
            var count = await query
                .Where(n => !n.IsRead)
                .CountAsync();

            return Ok(count);
        }

        [HttpGet("recent")]
        public async Task<ActionResult<List<NotificationDto>>> GetRecentNotifications(int limit = 10)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var query = await BuildScopedQuery(userId.Value);
            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(limit)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Type = n.Type.ToString(),
                    Message = n.Message,
                    BookingId = n.BookingId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();

            return Ok(notifications);
        }

        [HttpGet]
        public async Task<ActionResult<List<NotificationDto>>> GetAllNotifications(int? limit = null)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var scopedQuery = await BuildScopedQuery(userId.Value);
            var query = scopedQuery
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Type = n.Type.ToString(),
                    Message = n.Message,
                    BookingId = n.BookingId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                });

            if (limit.HasValue && limit.Value > 0)
            {
                return Ok(await query.Take(limit.Value).ToListAsync());
            }

            return Ok(await query.ToListAsync());
        }

        [HttpPut("{id}/mark-read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var query = await BuildScopedQuery(userId.Value);
            var notification = await query.FirstOrDefaultAsync(n => n.Id == id);

            if (notification == null)
            {
                return NotFound();
            }

            notification.IsRead = true;
            _context.Notifications.Update(notification);
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpPut("mark-all-read")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var query = await BuildScopedQuery(userId.Value);
            var notifications = await query
                .Where(n => !n.IsRead)
                .ToListAsync();

            foreach (var notification in notifications)
            {
                notification.IsRead = true;
            }

            _context.Notifications.UpdateRange(notifications);
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpPost("send-test")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendTestNotification([FromBody] SendTestNotificationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "Message is required." });

            var customer = await _context.Users.FindAsync(dto.UserId);
            if (customer == null || customer.Role != "Customer")
                return NotFound(new { message = "Customer not found." });

            if (string.IsNullOrWhiteSpace(customer.ExpoPushToken))
                return BadRequest(new { message = "Customer has no push token registered. They must open the app first." });

            await _expoPush.SendAsync(customer.ExpoPushToken, "Flowly", dto.Message, new { type = "SpecialOffer" });

            _context.Notifications.Add(new Notification
            {
                UserId    = customer.Id,
                Type      = NotificationType.SpecialOffer,
                Message   = dto.Message,
                IsRead    = false,
                CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();

            return Ok(new { success = true, tokenPreview = customer.ExpoPushToken[..Math.Min(25, customer.ExpoPushToken.Length)] });
        }

        private async Task<IQueryable<Flowly.API.Models.Notification>> BuildScopedQuery(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return _context.Notifications.Where(n => false);
            }

            if (user.Role == "Admin")
            {
                return _context.Notifications.Where(n => n.AdminId == userId);
            }

            return _context.Notifications.Where(n => n.UserId == userId);
        }
    }
}
