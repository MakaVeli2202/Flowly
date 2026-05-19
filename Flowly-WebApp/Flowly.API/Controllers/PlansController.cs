using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Modules.Plans;
using Flowly.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlansController : ControllerBase
    {
        private readonly IPlansService _plansService;

        public PlansController(IPlansService plansService)
        {
            _plansService = plansService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SubscriptionPlanDto>>> GetPlans([FromQuery] VehicleType? vehicleType = null) =>
            Ok(await _plansService.GetPlansAsync(vehicleType));

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<SubscriptionPlanDto>>> GetAdminPlans() =>
            Ok(await _plansService.GetAdminPlansAsync());

        [HttpGet("subscribers")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<UserSubscriptionAdminDto>>> GetSubscribers([FromQuery] UserSubscriptionStatus? status = null) =>
            Ok(await _plansService.GetSubscribersAsync(status));

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SubscriptionPlanDto>> CreatePlan([FromBody] UpsertSubscriptionPlanDto dto) =>
            Ok(await _plansService.CreatePlanAsync(dto));

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SubscriptionPlanDto>> UpdatePlan(int id, [FromBody] UpsertSubscriptionPlanDto dto)
        {
            var (result, error) = await _plansService.UpdatePlanAsync(id, dto);
            if (result == null) return NotFound(new { message = error });
            return Ok(result);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeletePlan(int id)
        {
            var (error, message) = await _plansService.DeletePlanAsync(id);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message });
        }

        [HttpPost("{planId:int}/subscribe")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> Subscribe(int planId)
        {
            var (result, error) = await _plansService.SubscribeAsync(planId, User.GetCurrentUserId());
            if (result == null) return NotFound(new { message = error });
            return Ok(result);
        }

        [HttpGet("my")]
        [Authorize]
        public async Task<ActionResult<CustomerSubscriptionDto>> GetMy()
        {
            var (result, error) = await _plansService.GetMySubscriptionAsync(User.GetCurrentUserId());
            if (result == null) return NotFound(new { message = error });
            return Ok(result);
        }

        [HttpPost("cancel")]
        [Authorize]
        public async Task<ActionResult> CancelMySubscription()
        {
            var (error, message) = await _plansService.CancelMySubscriptionAsync(User.GetCurrentUserId());
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message });
        }
    }
}
