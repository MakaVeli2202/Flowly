using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.DTOs;
using Flowly.API.Modules.Billing;
using Flowly.API.Platform.Tenancy;
using Flowly.API.Services;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlatformPlansController : ControllerBase
    {
        private readonly IBillingService _billing;
        private readonly TenantContext _tenantContext;

        public PlatformPlansController(IBillingService billing, TenantContext tenantContext)
        {
            _billing = billing;
            _tenantContext = tenantContext;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // ---- Public plan catalog --------------------------------------------------

        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PlatformPlanDto>>> GetPlans()
        {
            var plans = await _billing.GetPlansAsync();
            return Ok(plans);
        }

        [AllowAnonymous]
        [HttpGet("{id:int}")]
        public async Task<ActionResult<PlatformPlanDto>> GetPlan(int id)
        {
            var (result, error, statusCode) = await _billing.GetPlanAsync(id);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        // ---- Platform admin: plan management -------------------------------------

        [Authorize(Roles = "PlatformAdmin")]
        [HttpPost]
        public async Task<ActionResult<PlatformPlanDto>> CreatePlan([FromBody] CreatePlatformPlanDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var (result, error, statusCode) = await _billing.CreatePlanAsync(dto);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [Authorize(Roles = "PlatformAdmin")]
        [HttpPut("{id:int}")]
        public async Task<ActionResult<PlatformPlanDto>> UpdatePlan(int id, [FromBody] UpdatePlatformPlanDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var (result, error, statusCode) = await _billing.UpdatePlanAsync(id, dto);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "PlatformAdmin")]
        [HttpDelete("{id:int}")]
        public async Task<ActionResult> DeactivatePlan(int id)
        {
            var (error, statusCode) = await _billing.DeactivatePlanAsync(id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        // ---- Org billing (tenant-scoped) -----------------------------------------

        [Authorize(Roles = "Admin")]
        [HttpGet("subscription")]
        public async Task<ActionResult<OrganizationSubscriptionDto>> GetSubscription()
        {
            var (result, error, statusCode) = await _billing.GetSubscriptionAsync(_tenantContext.OrgId);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("checkout")]
        public async Task<ActionResult<CheckoutSessionResultDto>> CreateCheckout([FromBody] CreateCheckoutSessionDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var (result, error, statusCode) = await _billing.CreateCheckoutSessionAsync(_tenantContext.OrgId, dto);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("billing-portal")]
        public async Task<ActionResult<BillingPortalSessionDto>> CreateBillingPortal([FromBody] string returnUrl)
        {
            var (result, error, statusCode) = await _billing.CreateBillingPortalSessionAsync(_tenantContext.OrgId, returnUrl);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("usage")]
        public async Task<ActionResult<UsageRecordDto>> GetUsage()
        {
            var result = await _billing.GetCurrentUsageAsync(_tenantContext.OrgId);
            return Ok(result);
        }
    }
}
