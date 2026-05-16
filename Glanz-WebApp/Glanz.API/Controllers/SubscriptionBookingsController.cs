using Glanz.API.DTOs;
using Glanz.API.Modules.SubscriptionBookings;
using Glanz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SubscriptionBookingsController : ControllerBase
    {
        private readonly ISubscriptionBookingService _subscriptionService;

        public SubscriptionBookingsController(ISubscriptionBookingService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        [HttpGet("availability")]
        [Authorize]
        public async Task<IActionResult> GetAvailability(
            [FromQuery] int month,
            [FromQuery] int year,
            [FromQuery] int packageId = 0)
        {
            var (result, error) = await _subscriptionService.GetAvailabilityAsync(month, year, packageId);
            if (error != null) return BadRequest(error);
            return Ok(result);
        }

        [HttpGet("slots")]
        [Authorize]
        public async Task<IActionResult> GetSlots(
            [FromQuery] string date,
            [FromQuery] int packageId = 0)
        {
            var (result, error) = await _subscriptionService.GetSlotsAsync(date, packageId);
            if (error != null) return BadRequest(error);
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> CreateBookings([FromBody] CreateSubscriptionBookingsDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var (result, error) = await _subscriptionService.CreateBookingsAsync(dto, userId.Value);
            if (error != null) return BadRequest(new { message = error });
            return Ok(result);
        }

        [HttpGet("my")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetMyBookings()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            return Ok(await _subscriptionService.GetMyBookingsAsync(userId.Value));
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var (error, statusCode) = await _subscriptionService.CancelBookingAsync(id, userId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(new { message = "Booking cancelled." });
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllBookings([FromQuery] string? status) =>
            Ok(await _subscriptionService.GetAllBookingsAsync(status));

        [HttpPut("admin/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateSubscriptionBookingDto dto)
        {
            var (result, error) = await _subscriptionService.UpdateBookingAsync(id, dto);
            if (result == null) return NotFound();
            return Ok(result);
        }
    }
}
