using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.Modules.Waitlist;
using Flowly.API.Platform.Tenancy;
using Flowly.API.Services;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WaitlistController : ControllerBase
    {
        private readonly IWaitlistService _service;
        private readonly TenantContext _tenant;

        public WaitlistController(IWaitlistService service, TenantContext tenant)
        {
            _service = service;
            _tenant  = tenant;
        }

        private int GetUserId() => User.GetCurrentUserId();

        // ---- Customer endpoints -------------------------------------------------------

        [HttpGet]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetMyEntries()
            => Ok(await _service.GetMyEntriesAsync(GetUserId()));

        [HttpPost]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> Join([FromBody] JoinWaitlistDto dto)
        {
            var (result, error, status) = await _service.JoinAsync(GetUserId(), _tenant.OrgId, dto);
            return status switch
            {
                201 => CreatedAtAction(nameof(GetMyEntries), result),
                400 => BadRequest(new { message = error }),
                409 => Conflict(new { message = error }),
                _   => StatusCode(status, new { message = error }),
            };
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> Leave(int id)
        {
            var (error, status) = await _service.LeaveAsync(GetUserId(), id);
            if (error != null) return StatusCode(status, new { message = error });
            return NoContent();
        }

        // ---- Admin endpoints ---------------------------------------------------------

        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll([FromQuery] string? date)
            => Ok(await _service.GetAllAdminAsync(_tenant.OrgId, date));

        [HttpPost("admin/notify")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Notify([FromQuery] string date, [FromQuery] string? timeSlot)
        {
            if (!DateTime.TryParse(date, out var parsedDate))
                return BadRequest(new { message = "Invalid date format." });
            var count = await _service.NotifyWaitlistAsync(_tenant.OrgId, parsedDate, timeSlot, HttpContext.RequestAborted);
            return Ok(new { notified = count });
        }
    }
}
