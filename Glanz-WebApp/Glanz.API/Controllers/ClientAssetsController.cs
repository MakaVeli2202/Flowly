using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.DTOs;
using Glanz.API.Modules.ClientAssets;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClientAssetsController : ControllerBase
    {
        private readonly IClientAssetService _clientAssets;
        private readonly TenantContext _tenantContext;

        public ClientAssetsController(IClientAssetService clientAssets, TenantContext tenantContext)
        {
            _clientAssets = clientAssets;
            _tenantContext = tenantContext;
        }

        private int GetUserId() => User.GetCurrentUserId();

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClientAssetDto>>> GetMyAssets()
        {
            return Ok(await _clientAssets.GetAssetsAsync(_tenantContext.OrgId, GetUserId()));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<ClientAssetDto>> GetAsset(int id)
        {
            var (result, error, statusCode) = await _clientAssets.GetAssetAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult<ClientAssetDto>> CreateAsset([FromBody] CreateClientAssetDto dto)
        {
            var (result, error, statusCode) = await _clientAssets.CreateAssetAsync(_tenantContext.OrgId, GetUserId(), dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return CreatedAtAction(nameof(GetAsset), new { id = result!.Id }, result);
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<ClientAssetDto>> UpdateAsset(int id, [FromBody] UpdateClientAssetDto dto)
        {
            var (result, error, statusCode) = await _clientAssets.UpdateAssetAsync(_tenantContext.OrgId, GetUserId(), id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteAsset(int id)
        {
            var (error, statusCode) = await _clientAssets.DeleteAssetAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [HttpPut("{id:int}/default")]
        public async Task<ActionResult<ClientAssetDto>> SetDefault(int id)
        {
            var (result, error, statusCode) = await _clientAssets.SetDefaultAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }
    }
}
