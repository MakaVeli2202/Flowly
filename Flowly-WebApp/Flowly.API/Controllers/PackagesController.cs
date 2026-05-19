using Flowly.API.DTOs;
using Flowly.API.Modules.Packages;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PackagesController : ControllerBase
    {
        private readonly IPackageService _packageService;

        public PackagesController(IPackageService packageService)
        {
            _packageService = packageService;
        }

        private string ResolveRequestedLanguage()
        {
            var queryLang = Request.Query["lang"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(queryLang)) return queryLang;

            var header = Request.Headers["Accept-Language"].FirstOrDefault()
                         ?? Request.Headers["X-Language"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(header)) return "en";

            return header.Split(',')[0].Split('-')[0].Trim().ToLowerInvariant();
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PackageDto>>> GetPackages()
        {
            try
            {
                return Ok(await _packageService.GetPackagesAsync(ResolveRequestedLanguage(), HttpContext.RequestAborted));
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to retrieve packages" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PackageDto>> GetPackage(int id)
        {
            try
            {
                var (result, error) = await _packageService.GetPackageAsync(id, ResolveRequestedLanguage(), HttpContext.RequestAborted);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to retrieve package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<PackageDto>> CreatePackage(CreatePackageDto dto)
        {
            try
            {
                var (result, error, statusCode) = await _packageService.CreatePackageAsync(dto, HttpContext.RequestAborted);
                if (result == null) return StatusCode(statusCode, new { message = error });
                return CreatedAtAction(nameof(GetPackage), new { id = result.Id }, result);
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to create package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdatePackage(int id, UpdatePackageDto dto)
        {
            try
            {
                var (error, statusCode) = await _packageService.UpdatePackageAsync(id, dto, HttpContext.RequestAborted);
                if (error != null) return StatusCode(statusCode, new { message = error });
                return Ok(new { message = "Package updated successfully" });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to update package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPatch("{id}/toggle-active")]
        public async Task<ActionResult> TogglePackageActive(int id)
        {
            try
            {
                var (error, isActive) = await _packageService.ToggleActiveAsync(id);
                if (error != null) return NotFound(new { message = error });
                var action = isActive ? "activated" : "deactivated";
                return Ok(new { message = $"Package {action} successfully", isActive });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to update package status" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin/all")]
        public async Task<ActionResult<IEnumerable<PackageDto>>> GetAllPackagesAdmin()
        {
            try
            {
                return Ok(await _packageService.GetAllPackagesAdminAsync(ResolveRequestedLanguage(), HttpContext.RequestAborted));
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to retrieve packages" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeletePackage(int id)
        {
            try
            {
                var error = await _packageService.DeletePackageAsync(id);
                if (error != null) return NotFound(new { message = error });
                return Ok(new { message = "Package deactivated successfully" });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to delete package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("reorder")]
        public async Task<ActionResult> ReorderPackages([FromBody] List<ReorderItemDto> items)
        {
            try
            {
                await _packageService.ReorderPackagesAsync(items);
                return Ok(new { message = "Packages reordered." });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to reorder packages" });
            }
        }
    }
}
