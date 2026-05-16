using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.Modules.RecurringBookings;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RecurringBookingsController : ControllerBase
    {
        private readonly IRecurringBookingService _service;
        private readonly TenantContext _tenant;

        public RecurringBookingsController(IRecurringBookingService service, TenantContext tenant)
        {
            _service = service;
            _tenant  = tenant;
        }

        private int GetUserId() => User.GetCurrentUserId();

        // ---- Customer endpoints -------------------------------------------------------

        [HttpGet]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetMyRules()
            => Ok(await _service.GetMyRulesAsync(GetUserId()));

        [HttpPost]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> CreateRule([FromBody] CreateRecurringRuleDto dto)
        {
            var (result, error, status) = await _service.CreateRuleAsync(GetUserId(), _tenant.OrgId, dto);
            return status switch
            {
                201 => CreatedAtAction(nameof(GetMyRules), result),
                400 => BadRequest(new { message = error }),
                _   => StatusCode(status, new { message = error }),
            };
        }

        [HttpPut("{id}/pause")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> PauseRule(int id)
        {
            var (error, status) = await _service.PauseRuleAsync(GetUserId(), id);
            if (error != null) return StatusCode(status, new { message = error });
            return NoContent();
        }

        [HttpPut("{id}/resume")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> ResumeRule(int id)
        {
            var (error, status) = await _service.ResumeRuleAsync(GetUserId(), id);
            if (error != null) return StatusCode(status, new { message = error });
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> DeleteRule(int id)
        {
            var (error, status) = await _service.DeleteRuleAsync(GetUserId(), id);
            if (error != null) return StatusCode(status, new { message = error });
            return NoContent();
        }

        // ---- Admin endpoints ---------------------------------------------------------

        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllRulesAdmin()
            => Ok(await _service.GetAllRulesAdminAsync(_tenant.OrgId));
    }
}
