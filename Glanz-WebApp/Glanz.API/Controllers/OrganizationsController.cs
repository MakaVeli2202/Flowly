using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.DTOs;
using Glanz.API.Modules.Organization;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrganizationsController : ControllerBase
    {
        private readonly IOrganizationService _organizationService;
        private readonly TenantContext _tenantContext;

        public OrganizationsController(IOrganizationService organizationService, TenantContext tenantContext)
        {
            _organizationService = organizationService;
            _tenantContext = tenantContext;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // POST /api/Organizations/register - platform admin or public sign-up
        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<ActionResult<OrganizationDto>> Register([FromBody] RegisterOrganizationDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var (result, error, statusCode) = await _organizationService.RegisterOrganizationAsync(dto);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        // GET /api/Organizations/me - get current org details
        [Authorize(Roles = "Admin")]
        [HttpGet("me")]
        public async Task<ActionResult<OrganizationDto>> GetMyOrg()
        {
            var orgId = _tenantContext.OrgId;
            var (result, error, statusCode) = await _organizationService.GetOrganizationAsync(orgId);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        // PUT /api/Organizations/me - update current org settings
        [Authorize(Roles = "Admin")]
        [HttpPut("me")]
        public async Task<ActionResult<OrganizationDto>> UpdateMyOrg([FromBody] UpdateOrganizationDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var orgId = _tenantContext.OrgId;
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _organizationService.UpdateOrganizationAsync(orgId, dto, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        // GET /api/Organizations/me/branding
        [Authorize(Roles = "Admin")]
        [HttpGet("me/branding")]
        public async Task<ActionResult<OrganizationBrandingDto>> GetBranding()
        {
            var orgId = _tenantContext.OrgId;
            var (result, error, statusCode) = await _organizationService.GetBrandingAsync(orgId);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        // PUT /api/Organizations/me/branding
        [Authorize(Roles = "Admin")]
        [HttpPut("me/branding")]
        public async Task<ActionResult<OrganizationBrandingDto>> UpdateBranding([FromBody] UpdateOrganizationBrandingDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var orgId = _tenantContext.OrgId;
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _organizationService.UpdateBrandingAsync(orgId, dto, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        // GET /api/Organizations/me/onboarding
        [Authorize(Roles = "Admin")]
        [HttpGet("me/onboarding")]
        public async Task<ActionResult<OrganizationOnboardingDto>> GetOnboarding()
        {
            var orgId = _tenantContext.OrgId;
            var result = await _organizationService.GetOnboardingStatusAsync(orgId);
            return Ok(result);
        }
    }
}
