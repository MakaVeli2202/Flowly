using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.Modules.FeatureFlags;
using Flowly.API.Platform.Tenancy;
using Flowly.API.Services;
// SetFeatureFlagDto is defined in ConfigController.cs (same namespace)

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class FeatureFlagsController : ControllerBase
    {
        private readonly IFeatureFlagService _featureFlags;
        private readonly TenantContext _tenantContext;

        public FeatureFlagsController(IFeatureFlagService featureFlags, TenantContext tenantContext)
        {
            _featureFlags = featureFlags;
            _tenantContext = tenantContext;
        }

        [HttpGet]
        public async Task<ActionResult<Dictionary<string, bool>>> GetAll()
        {
            var flags = await _featureFlags.GetAllFlagsAsync(_tenantContext.OrgId);
            return Ok(flags);
        }

        [HttpGet("{featureKey}")]
        public async Task<ActionResult<object>> GetFlag(string featureKey)
        {
            var enabled = await _featureFlags.IsEnabledAsync(_tenantContext.OrgId, featureKey);
            return Ok(new { featureKey, enabled });
        }

        [HttpPut("{featureKey}")]
        public async Task<ActionResult> SetFlag(string featureKey, [FromBody] SetFeatureFlagDto dto)
        {
            var (error, statusCode) = await _featureFlags.SetFlagAsync(_tenantContext.OrgId, featureKey, dto.Enabled);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(new { featureKey, dto.Enabled });
        }

        [HttpDelete("{featureKey}")]
        public async Task<ActionResult> DeleteFlag(string featureKey)
        {
            var (error, statusCode) = await _featureFlags.DeleteFlagAsync(_tenantContext.OrgId, featureKey);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }

}
