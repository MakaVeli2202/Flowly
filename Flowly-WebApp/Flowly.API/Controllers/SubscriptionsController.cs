using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Modules.Plans;
using Flowly.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SubscriptionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SubscriptionsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("my-subscription")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> GetMySubscription()
        {
            var userId = User.GetCurrentUserId();

            var sub = await _context.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.Plan)
                .ThenInclude(p => p.Features)
                .Include(s => s.Plan)
                .ThenInclude(p => p.Benefits)
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .OrderByDescending(s => s.StartDate)
                .FirstOrDefaultAsync();

            if (sub == null)
                return NotFound(new { message = "No active subscription found." });

            return Ok(PlansService.ToCustomerSubscriptionDto(sub));
        }

        [HttpPost("subscribe")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> Subscribe([FromBody] SubscribeToPlanDto dto)
        {
            var userId = User.GetCurrentUserId();

            var plan = await _context.SubscriptionPlans
                .Include(p => p.Features)
                .Include(p => p.Benefits)
                .FirstOrDefaultAsync(p => p.Id == dto.PlanId && p.IsActive);
            if (plan == null)
                return BadRequest(new { message = "Subscription plan not found or inactive." });

            var existingSubscriptions = await _context.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .ToListAsync();

            foreach (var existing in existingSubscriptions)
            {
                existing.Status    = UserSubscriptionStatus.Cancelled;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            var now = DateTime.UtcNow;
            var entity = new UserSubscription
            {
                UserId          = userId,
                PlanId          = plan.Id,
                StartDate       = now,
                NextBillingDate = plan.BillingCycle == SubscriptionBillingCycle.Quarterly ? now.AddMonths(3) : now.AddMonths(1),
                Status          = UserSubscriptionStatus.Active,
                CreatedAt       = now,
                UpdatedAt       = now,
            };

            _context.UserSubscriptions.Add(entity);
            await _context.SaveChangesAsync();

            entity.Plan = plan;
            return Ok(PlansService.ToCustomerSubscriptionDto(entity));
        }

        [HttpPost("unsubscribe")]
        [Authorize]
        public async Task<ActionResult> Unsubscribe()
        {
            var userId = User.GetCurrentUserId();

            var entity = await _context.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .OrderByDescending(s => s.StartDate)
                .FirstOrDefaultAsync();

            if (entity == null)
                return NotFound(new { message = "No active subscription found." });

            entity.Status    = UserSubscriptionStatus.Cancelled;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Subscription cancelled." });
        }
    }
}
