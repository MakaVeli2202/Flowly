using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.Modules.IndustryTemplates;
using Glanz.API.Platform.Tenancy;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IndustryTemplatesController : ControllerBase
    {
        private readonly IIndustryTemplateService _templates;
        private readonly TenantContext _tenantContext;

        public IndustryTemplatesController(IIndustryTemplateService templates, TenantContext tenantContext)
        {
            _templates = templates;
            _tenantContext = tenantContext;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<IndustryTemplateDto>>> GetAll()
        {
            return Ok(await _templates.GetAllAsync());
        }

        [HttpGet("{key}")]
        [AllowAnonymous]
        public async Task<ActionResult<IndustryTemplateDto>> GetByKey(string key)
        {
            var (result, error, statusCode) = await _templates.GetByKeyAsync(key);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "PlatformAdmin")]
        public async Task<ActionResult<IndustryTemplateDto>> Create([FromBody] CreateIndustryTemplateDto dto)
        {
            var (result, error, statusCode) = await _templates.CreateAsync(dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [HttpPut("{key}")]
        [Authorize(Roles = "PlatformAdmin")]
        public async Task<ActionResult<IndustryTemplateDto>> Update(string key, [FromBody] UpdateIndustryTemplateDto dto)
        {
            var (result, error, statusCode) = await _templates.UpdateAsync(key, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("{key}")]
        [Authorize(Roles = "PlatformAdmin")]
        public async Task<ActionResult> Delete(string key)
        {
            var (error, statusCode) = await _templates.DeleteAsync(key);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [HttpPost("apply")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ApplyToOrg([FromBody] ApplyTemplateDto dto)
        {
            var (error, statusCode) = await _templates.ApplyToOrgAsync(_tenantContext.OrgId, dto.TemplateKey);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok();
        }
    }
}
