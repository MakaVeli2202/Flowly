using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.Modules.Permissions;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,PlatformAdmin")]
    public class PermissionsController : ControllerBase
    {
        private readonly IPermissionsService _permissions;

        public PermissionsController(IPermissionsService permissions)
        {
            _permissions = permissions;
        }

        [HttpGet("{role}")]
        public async Task<ActionResult<IEnumerable<string>>> GetRolePermissions(string role)
        {
            var perms = await _permissions.GetPermissionsForRoleAsync(role);
            return Ok(perms);
        }

        [HttpPost("{role}/{permissionKey}")]
        [Authorize(Roles = "PlatformAdmin")]
        public async Task<ActionResult> Grant(string role, string permissionKey)
        {
            var (error, statusCode) = await _permissions.GrantPermissionAsync(role, permissionKey);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode);
        }

        [HttpDelete("{role}/{permissionKey}")]
        [Authorize(Roles = "PlatformAdmin")]
        public async Task<ActionResult> Revoke(string role, string permissionKey)
        {
            var (error, statusCode) = await _permissions.RevokePermissionAsync(role, permissionKey);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }
}
