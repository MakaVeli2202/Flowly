using System.Security.Claims;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlansController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PlansController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SubscriptionPlanDto>>> GetPlans([FromQuery] VehicleType? vehicleType = null)
        {
            var query = _context.SubscriptionPlans
                .AsNoTracking()
                .Include(p => p.Features)
                .Include(p => p.Benefits)
                .Include(p => p.PlanPackages).ThenInclude(pp => pp.Package)
                .Where(p => p.IsActive);

            if (vehicleType.HasValue)
            {
                query = query.Where(p => p.VehicleType == vehicleType.Value);
            }

            var plans = await query
                .OrderByDescending(p => p.IsPopular)
                .ThenBy(p => p.DisplayOrder)
                .ThenBy(p => p.Price)
                .ToListAsync();

            return Ok(plans.Select(p => ToPlanDto(p, 0)));
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<SubscriptionPlanDto>>> GetAdminPlans()
        {
            var plans = await _context.SubscriptionPlans
                .AsNoTracking()
                .Include(p => p.Features)
                .Include(p => p.Benefits)
                .Include(p => p.PlanPackages).ThenInclude(pp => pp.Package)
                .Include(p => p.UserSubscriptions)
                .OrderByDescending(p => p.IsPopular)
                .ThenBy(p => p.DisplayOrder)
                .ThenBy(p => p.Price)
                .ToListAsync();

            return Ok(plans.Select(p => ToPlanDto(p, p.UserSubscriptions.Count(s => s.Status == UserSubscriptionStatus.Active))));
        }

        [HttpGet("subscribers")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<UserSubscriptionAdminDto>>> GetSubscribers([FromQuery] UserSubscriptionStatus? status = null)
        {
            var query = _context.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.User)
                .Include(s => s.Plan)
                .AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(s => s.Status == status.Value);
            }

            var subscriptions = await query
                .OrderByDescending(s => s.StartDate)
                .ToListAsync();

            return Ok(subscriptions.Select(s => new UserSubscriptionAdminDto
            {
                Id = s.Id,
                UserId = s.UserId,
                CustomerName = $"{s.User.FirstName} {s.User.LastName}".Trim(),
                CustomerEmail = s.User.Email,
                PlanId = s.PlanId,
                PlanName = s.Plan.Name,
                VehicleType = s.Plan.VehicleType,
                BillingCycle = s.Plan.BillingCycle,
                Price = s.Plan.Price,
                DiscountPercent = s.Plan.DiscountPercent,
                StartDate = s.StartDate,
                NextBillingDate = s.NextBillingDate,
                Status = s.Status.ToString(),
            }));
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SubscriptionPlanDto>> CreatePlan([FromBody] UpsertSubscriptionPlanDto dto)
        {
            var plan = new SubscriptionPlan();
            ApplyPlanUpdate(plan, dto);
            _context.SubscriptionPlans.Add(plan);
            await _context.SaveChangesAsync();

            await _context.Entry(plan).Collection(p => p.Features).LoadAsync();
            await _context.Entry(plan).Collection(p => p.Benefits).LoadAsync();

            return Ok(ToPlanDto(plan, 0));
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SubscriptionPlanDto>> UpdatePlan(int id, [FromBody] UpsertSubscriptionPlanDto dto)
        {
            var plan = await _context.SubscriptionPlans
                .Include(p => p.Features)
                .Include(p => p.Benefits)
                .Include(p => p.PlanPackages)
                .Include(p => p.UserSubscriptions)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (plan == null)
            {
                return NotFound(new { message = "Subscription plan not found." });
            }

            ApplyPlanUpdate(plan, dto);
            await _context.SaveChangesAsync();

            return Ok(ToPlanDto(plan, plan.UserSubscriptions.Count(s => s.Status == UserSubscriptionStatus.Active)));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeletePlan(int id)
        {
            var plan = await _context.SubscriptionPlans
                .Include(p => p.UserSubscriptions)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (plan == null)
            {
                return NotFound(new { message = "Subscription plan not found." });
            }

            if (plan.UserSubscriptions.Any())
            {
                plan.IsActive = false;
                plan.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Plan deactivated because subscriptions already reference it." });
            }

            _context.SubscriptionPlans.Remove(plan);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Plan deleted." });
        }

        // ── Customer subscription endpoints ───────────────────────────────────

        [HttpPost("{planId:int}/subscribe")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> Subscribe(int planId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var plan = await _context.SubscriptionPlans
                .Include(p => p.Features)
                .Include(p => p.Benefits)
                .Include(p => p.PlanPackages)
                .FirstOrDefaultAsync(p => p.Id == planId && p.IsActive);

            if (plan == null)
            {
                return NotFound(new { message = "Subscription plan not found or inactive." });
            }

            var existingSubscriptions = await _context.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .ToListAsync();

            if (existingSubscriptions.Count > 0)
            {
                foreach (var existing in existingSubscriptions)
                {
                    existing.Status = UserSubscriptionStatus.Cancelled;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
            }

            var now = DateTime.UtcNow;
            var subscription = new UserSubscription
            {
                UserId = userId,
                PlanId = plan.Id,
                StartDate = now,
                NextBillingDate = plan.BillingCycle == SubscriptionBillingCycle.Quarterly
                    ? now.AddMonths(3)
                    : now.AddMonths(1),
                Status = UserSubscriptionStatus.Active,
                CreatedAt = now,
                UpdatedAt = now,
            };

            _context.UserSubscriptions.Add(subscription);
            await _context.SaveChangesAsync();

            subscription.Plan = plan;
            return Ok(ToCustomerSubscriptionDto(subscription));
        }

        [HttpGet("my")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> GetMy()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var subscription = await _context.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.Plan)
                .ThenInclude(p => p.Features)
                .Include(s => s.Plan)
                .ThenInclude(p => p.Benefits)
                .Include(s => s.Plan)
                .ThenInclude(p => p.PlanPackages).ThenInclude(pp => pp.Package)
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .OrderByDescending(s => s.StartDate)
                .FirstOrDefaultAsync();

            if (subscription == null)
            {
                return NotFound(new { message = "No active subscription found." });
            }

            return Ok(ToCustomerSubscriptionDto(subscription));
        }

        [HttpPost("cancel")]
        [Authorize]
        public async Task<ActionResult> CancelMySubscription()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var subscription = await _context.UserSubscriptions
                .Where(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active)
                .OrderByDescending(s => s.StartDate)
                .FirstOrDefaultAsync();

            if (subscription == null)
            {
                return NotFound(new { message = "No active subscription found." });
            }

            subscription.Status = UserSubscriptionStatus.Cancelled;
            subscription.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Subscription cancelled." });
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static SubscriptionPlanDto ToPlanDto(SubscriptionPlan plan, int subscriberCount)
        {
            return new SubscriptionPlanDto
            {
                Id = plan.Id,
                Name = plan.Name,
                VehicleType = plan.VehicleType,
                VehicleIcon = GetVehicleIcon(plan.VehicleType),
                BillingCycle = plan.BillingCycle,
                Price = plan.Price,
                DiscountPercent = plan.DiscountPercent,
                IsActive = plan.IsActive,
                IsPopular = plan.IsPopular,
                DisplayOrder = plan.DisplayOrder,
                SubscriberCount = subscriberCount,
                Features = plan.Features
                    .OrderBy(f => f.DisplayOrder)
                    .Select(f => new SubscriptionPlanFeatureDto { Id = f.Id, FeatureText = f.FeatureText, DisplayOrder = f.DisplayOrder })
                    .ToList(),
                Benefits = plan.Benefits
                    .OrderBy(b => b.DisplayOrder)
                    .Select(b => new SubscriptionPlanBenefitDto { Id = b.Id, BenefitText = b.BenefitText, DisplayOrder = b.DisplayOrder })
                    .ToList(),
                PlanPackages = plan.PlanPackages
                    .OrderBy(pp => pp.DisplayOrder)
                    .Select(pp => new SubscriptionPlanPackageDto
                    {
                        Id = pp.Id,
                        PackageId = pp.PackageId,
                        PackageName = pp.Package?.Name ?? string.Empty,
                        PackagePrice = pp.Package?.Price ?? 0,
                        EstimatedDurationMinutes = pp.Package?.EstimatedDurationMinutes ?? 0,
                        Description = pp.Package?.Description,
                        DisplayOrder = pp.DisplayOrder,
                    })
                    .ToList(),
            };
        }

        internal static CustomerSubscriptionDto ToCustomerSubscriptionDto(UserSubscription subscription)
        {
            return new CustomerSubscriptionDto
            {
                Id = subscription.Id,
                PlanId = subscription.PlanId,
                PlanName = subscription.Plan.Name,
                VehicleType = subscription.Plan.VehicleType,
                VehicleIcon = GetVehicleIcon(subscription.Plan.VehicleType),
                BillingCycle = subscription.Plan.BillingCycle,
                Price = subscription.Plan.Price,
                DiscountPercent = subscription.Plan.DiscountPercent,
                StartDate = subscription.StartDate,
                NextBillingDate = subscription.NextBillingDate,
                Status = subscription.Status.ToString(),
                IsActive = subscription.Status == UserSubscriptionStatus.Active,
                Features = subscription.Plan.Features
                    .OrderBy(f => f.DisplayOrder)
                    .Select(f => new SubscriptionPlanFeatureDto { Id = f.Id, FeatureText = f.FeatureText, DisplayOrder = f.DisplayOrder })
                    .ToList(),
                Benefits = subscription.Plan.Benefits
                    .OrderBy(b => b.DisplayOrder)
                    .Select(b => new SubscriptionPlanBenefitDto { Id = b.Id, BenefitText = b.BenefitText, DisplayOrder = b.DisplayOrder })
                    .ToList(),
                PlanPackages = subscription.Plan.PlanPackages
                    .OrderBy(pp => pp.DisplayOrder)
                    .Select(pp => new SubscriptionPlanPackageDto
                    {
                        Id = pp.Id,
                        PackageId = pp.PackageId,
                        PackageName = pp.Package?.Name ?? string.Empty,
                        PackagePrice = pp.Package?.Price ?? 0,
                        EstimatedDurationMinutes = pp.Package?.EstimatedDurationMinutes ?? 0,
                        Description = pp.Package?.Description,
                        DisplayOrder = pp.DisplayOrder,
                    })
                    .ToList(),
            };
        }

        private static string GetVehicleIcon(VehicleType vehicleType) => vehicleType switch
        {
            VehicleType.Motorcycle => "bicycle-outline",
            VehicleType.SUV => "car-sport-outline",
            VehicleType.Pickup => "car-outline",
            _ => "car-outline",
        };

        private static void ApplyPlanUpdate(SubscriptionPlan plan, UpsertSubscriptionPlanDto dto)
        {
            plan.Name = dto.Name.Trim();
            plan.VehicleType = dto.VehicleType;
            plan.BillingCycle = dto.BillingCycle;
            plan.Price = dto.Price;
            plan.DiscountPercent = Math.Clamp(dto.DiscountPercent ?? 0, 0, 100);
            plan.IsActive = dto.IsActive;
            plan.IsPopular = dto.IsPopular;
            plan.DisplayOrder = dto.DisplayOrder;
            plan.UpdatedAt = DateTime.UtcNow;

            plan.Features.Clear();
            for (var index = 0; index < dto.Features.Count; index++)
            {
                var text = dto.Features[index]?.Trim();
                if (string.IsNullOrWhiteSpace(text)) continue;
                plan.Features.Add(new SubscriptionPlanFeature { FeatureText = text, DisplayOrder = index });
            }

            plan.Benefits.Clear();
            for (var index = 0; index < dto.Benefits.Count; index++)
            {
                var text = dto.Benefits[index]?.Trim();
                if (string.IsNullOrWhiteSpace(text)) continue;
                plan.Benefits.Add(new SubscriptionPlanBenefit { BenefitText = text, DisplayOrder = index });
            }

            plan.PlanPackages.Clear();
            for (var index = 0; index < dto.PackageIds.Count; index++)
            {
                plan.PlanPackages.Add(new SubscriptionPlanPackage
                {
                    PackageId = dto.PackageIds[index],
                    DisplayOrder = index,
                });
            }
        }
    }
}
