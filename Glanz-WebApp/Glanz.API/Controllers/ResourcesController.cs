using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.Modules.Resources;
using Glanz.API.Platform.Tenancy;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ResourcesController : ControllerBase
    {
        private readonly IResourceService _resources;
        private readonly TenantContext _tenantContext;

        public ResourcesController(IResourceService resources, TenantContext tenantContext)
        {
            _resources = resources;
            _tenantContext = tenantContext;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResourceDto>>> GetAll()
        {
            var items = await _resources.GetResourcesAsync(_tenantContext.OrgId);
            return Ok(items);
        }

        [HttpGet("availability")]
        public async Task<ActionResult<IEnumerable<ResourceAvailabilityDto>>> GetAvailability(
            [FromQuery] DateTime startAt, [FromQuery] DateTime endAt)
        {
            if (endAt <= startAt) return BadRequest(new { message = "endAt must be after startAt." });
            var result = await _resources.GetAvailabilityAsync(_tenantContext.OrgId,
                startAt.ToUniversalTime(), endAt.ToUniversalTime());
            return Ok(result);
        }

        [HttpGet("bookings/{bookingId}")]
        public async Task<ActionResult<IEnumerable<ResourceDto>>> GetBookingResources(int bookingId)
        {
            var items = await _resources.GetBookingResourcesAsync(bookingId);
            return Ok(items);
        }

        [HttpPost("bookings/{bookingId}/attach")]
        public async Task<ActionResult> AttachToBooking(int bookingId, [FromBody] AttachResourceWithTimeDto dto)
        {
            var (error, statusCode) = await _resources.AttachToBookingAsync(
                _tenantContext.OrgId, bookingId, dto.ResourceId,
                dto.StartAt.ToUniversalTime(), dto.EndAt.ToUniversalTime());
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(new { message = "Resource attached." });
        }

        [HttpDelete("bookings/{bookingId}/detach/{resourceId}")]
        public async Task<ActionResult> DetachFromBooking(int bookingId, int resourceId)
        {
            var (error, statusCode) = await _resources.DetachFromBookingAsync(_tenantContext.OrgId, bookingId, resourceId);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [HttpPost]
        public async Task<ActionResult<ResourceDto>> Create([FromBody] CreateResourceDto dto)
        {
            var (result, error, statusCode) = await _resources.CreateResourceAsync(_tenantContext.OrgId, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ResourceDto>> Update(int id, [FromBody] UpdateResourceDto dto)
        {
            var (result, error, statusCode) = await _resources.UpdateResourceAsync(_tenantContext.OrgId, id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var (error, statusCode) = await _resources.DeleteResourceAsync(_tenantContext.OrgId, id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }

    public class AttachResourceWithTimeDto
    {
        public int ResourceId { get; set; }
        public DateTime StartAt { get; set; }
        public DateTime EndAt { get; set; }
    }
}
