using Flowly.API.DTOs;
using Flowly.API.Modules.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ServicesController : ControllerBase
    {
        private readonly IServicesService _servicesService;

        public ServicesController(IServicesService servicesService)
        {
            _servicesService = servicesService;
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
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<ServiceDto>>> GetServices()
        {
            try
            {
                return Ok(await _servicesService.GetServicesAsync(ResolveRequestedLanguage(), HttpContext.RequestAborted));
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to retrieve services" });
            }
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<ServiceDto>> GetService(int id)
        {
            try
            {
                var (result, error) = await _servicesService.GetServiceAsync(id, ResolveRequestedLanguage(), HttpContext.RequestAborted);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to retrieve service" });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ServiceDto>> CreateService(CreateServiceDto dto)
        {
            try
            {
                var (result, error, statusCode) = await _servicesService.CreateServiceAsync(dto, HttpContext.RequestAborted);
                if (result == null) return StatusCode(statusCode, new { message = error });
                return CreatedAtAction(nameof(GetService), new { id = result.Id }, result);
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to create service" });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateService(int id, UpdateServiceDto dto)
        {
            try
            {
                var (error, statusCode) = await _servicesService.UpdateServiceAsync(id, dto, HttpContext.RequestAborted);
                if (error != null) return StatusCode(statusCode, new { message = error });
                return Ok(new { message = "Service updated successfully" });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to update service" });
            }
        }

        [HttpPut("reorder")]
        public async Task<ActionResult> ReorderServices([FromBody] List<ReorderItemDto> items)
        {
            try
            {
                await _servicesService.ReorderServicesAsync(items);
                return Ok(new { message = "Services reordered." });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to reorder services" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteService(int id)
        {
            try
            {
                var error = await _servicesService.DeleteServiceAsync(id);
                if (error != null) return NotFound(new { message = error });
                return Ok(new { message = "Service deactivated successfully" });
            }
            catch
            {
                return StatusCode(500, new { message = "Failed to delete service" });
            }
        }
    }
}
