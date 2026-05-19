using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.Modules.CustomFields;
using Flowly.API.Platform.Tenancy;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class CustomFieldsController : ControllerBase
    {
        private readonly ICustomFieldService _customFields;
        private readonly TenantContext _tenantContext;

        public CustomFieldsController(ICustomFieldService customFields, TenantContext tenantContext)
        {
            _customFields = customFields;
            _tenantContext = tenantContext;
        }

        // ---- Definitions --------------------------------------------------------

        [HttpGet("definitions")]
        public async Task<ActionResult<IEnumerable<CustomFieldDefinitionDto>>> GetDefinitions([FromQuery] string? entityType)
        {
            return Ok(await _customFields.GetDefinitionsAsync(_tenantContext.OrgId, entityType));
        }

        [HttpPost("definitions")]
        public async Task<ActionResult<CustomFieldDefinitionDto>> CreateDefinition([FromBody] CreateCustomFieldDto dto)
        {
            var (result, error, statusCode) = await _customFields.CreateDefinitionAsync(_tenantContext.OrgId, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [HttpPut("definitions/{id}")]
        public async Task<ActionResult<CustomFieldDefinitionDto>> UpdateDefinition(int id, [FromBody] UpdateCustomFieldDto dto)
        {
            var (result, error, statusCode) = await _customFields.UpdateDefinitionAsync(_tenantContext.OrgId, id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("definitions/{id}")]
        public async Task<ActionResult> DeleteDefinition(int id)
        {
            var (error, statusCode) = await _customFields.DeleteDefinitionAsync(_tenantContext.OrgId, id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        // ---- Values -------------------------------------------------------------

        [HttpGet("{entityType}/{entityId}/values")]
        [Authorize(Roles = "Admin,Employee")]
        public async Task<ActionResult<IEnumerable<CustomFieldValueDto>>> GetValues(string entityType, int entityId)
        {
            return Ok(await _customFields.GetValuesAsync(_tenantContext.OrgId, entityType, entityId));
        }

        [HttpPut("{entityType}/{entityId}/values")]
        [Authorize(Roles = "Admin,Employee")]
        public async Task<ActionResult> SetValue(string entityType, int entityId, [FromBody] SetCustomFieldValueDto dto)
        {
            var (error, statusCode) = await _customFields.SetValueAsync(_tenantContext.OrgId, entityType, entityId, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok();
        }

        [HttpDelete("{entityType}/{entityId}/values/{fieldDefinitionId}")]
        public async Task<ActionResult> DeleteValue(string entityType, int entityId, int fieldDefinitionId)
        {
            var (error, statusCode) = await _customFields.DeleteValueAsync(_tenantContext.OrgId, entityType, entityId, fieldDefinitionId);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }
}
