using Flowly.API.Data;
using Flowly.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Modules.Webhooks
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class WebhookController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public WebhookController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        // GET api/Webhook/subscriptions
        [HttpGet("subscriptions")]
        public async Task<ActionResult<List<WebhookSubscriptionDto>>> GetSubscriptions()
        {
            var subs = await _db.WebhookSubscriptions.AsNoTracking()
                .Where(s => s.IsActive)
                .Select(s => new WebhookSubscriptionDto(s.Id, s.EventType, s.TargetUrl, s.IsActive, s.CreatedAt))
                .ToListAsync();
            return Ok(subs);
        }

        // POST api/Webhook/subscriptions
        [HttpPost("subscriptions")]
        public async Task<IActionResult> CreateSubscription([FromBody] CreateWebhookDto dto)
        {
            if (!Uri.TryCreate(dto.TargetUrl, UriKind.Absolute, out _))
                return BadRequest(new { message = "TargetUrl must be a valid absolute URL." });

            _db.WebhookSubscriptions.Add(new WebhookSubscription
            {
                OrgId = _tenant.OrgId,
                EventType = dto.EventType,
                TargetUrl = dto.TargetUrl,
                Secret = dto.Secret,
                IsActive = true
            });
            await _db.SaveChangesAsync();
            return Ok(new { message = "Webhook subscription created." });
        }

        // DELETE api/Webhook/subscriptions/{id}
        [HttpDelete("subscriptions/{id:int}")]
        public async Task<IActionResult> DeleteSubscription(int id)
        {
            var sub = await _db.WebhookSubscriptions.FirstOrDefaultAsync(s => s.Id == id);
            if (sub == null) return NotFound();
            sub.IsActive = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // GET api/Webhook/deliveries?eventType=booking.created&take=50
        [HttpGet("deliveries")]
        public async Task<ActionResult<List<WebhookDeliveryDto>>> GetDeliveries(
            [FromQuery] string? eventType, [FromQuery] int take = 50)
        {
            var query = _db.WebhookDeliveries.AsNoTracking()
                .Where(d => d.OrgId == _tenant.OrgId)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(eventType))
                query = query.Where(d => d.EventType == eventType);

            var items = await query
                .OrderByDescending(d => d.CreatedAt)
                .Take(Math.Min(take, 200))
                .Select(d => new WebhookDeliveryDto(d.Id, d.EventType, d.ResponseStatusCode, d.Success, d.AttemptCount, d.CreatedAt))
                .ToListAsync();

            return Ok(items);
        }
    }

    public record WebhookSubscriptionDto(int Id, string EventType, string TargetUrl, bool IsActive, DateTime CreatedAt);
    public record WebhookDeliveryDto(int Id, string EventType, int? ResponseStatusCode, bool Success, int AttemptCount, DateTime CreatedAt);
    public record CreateWebhookDto(string EventType, string TargetUrl, string? Secret);
}
