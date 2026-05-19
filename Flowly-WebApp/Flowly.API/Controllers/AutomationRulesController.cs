using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.Modules.Automation;
using Flowly.API.Platform.Tenancy;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AutomationRulesController : ControllerBase
    {
        private readonly IAutomationRuleService _rules;
        private readonly TenantContext _tenantContext;

        public AutomationRulesController(IAutomationRuleService rules, TenantContext tenantContext)
        {
            _rules = rules;
            _tenantContext = tenantContext;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AutomationRuleDto>>> GetAll()
        {
            return Ok(await _rules.GetRulesAsync(_tenantContext.OrgId));
        }

        [HttpPost]
        public async Task<ActionResult<AutomationRuleDto>> Create([FromBody] CreateAutomationRuleDto dto)
        {
            var (result, error, statusCode) = await _rules.CreateRuleAsync(_tenantContext.OrgId, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<AutomationRuleDto>> Update(int id, [FromBody] UpdateAutomationRuleDto dto)
        {
            var (result, error, statusCode) = await _rules.UpdateRuleAsync(_tenantContext.OrgId, id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var (error, statusCode) = await _rules.DeleteRuleAsync(_tenantContext.OrgId, id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }
}
