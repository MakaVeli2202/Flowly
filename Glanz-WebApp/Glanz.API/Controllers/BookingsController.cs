using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Modules.Booking;
using Glanz.API.Services;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;

        public BookingsController(IBookingService bookingService)
        {
            _bookingService = bookingService;
        }

        private string ResolveRequestedLanguage()
        {
            var queryLang = Request.Query["lang"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(queryLang))
                return queryLang;

            var header = Request.Headers["Accept-Language"].FirstOrDefault()
                         ?? Request.Headers["X-Language"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(header)) return "en";

            return header.Split(',')[0].Split('-')[0].Trim().ToLowerInvariant();
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // ---- Scheduling constraints -----------------------------------------------

        [HttpGet("constraints")]
        public async Task<ActionResult<BookingConstraintsDto>> GetBookingConstraints()
        {
            var result = await _bookingService.GetConstraintsAsync();
            return Ok(result);
        }

        // ---- Workers schedule / timeline ------------------------------------------

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/schedule")]
        public async Task<ActionResult<IEnumerable<WorkerScheduleDayDto>>> GetWorkersSchedule(
            [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var (result, error) = await _bookingService.GetWorkersScheduleAsync(from, to, HttpContext.RequestAborted);
            if (result == null) return BadRequest(new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/day-timeline")]
        public async Task<ActionResult<IEnumerable<WorkerDayTimelineDto>>> GetWorkersDayTimeline([FromQuery] string date)
        {
            var (result, error) = await _bookingService.GetWorkersDayTimelineAsync(date, HttpContext.RequestAborted);
            if (result == null) return BadRequest(new { message = error });
            return Ok(result);
        }

        // ---- Availability ---------------------------------------------------------

        [HttpGet("availability-calendar")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<DayAvailabilityDto>>> GetAvailabilityCalendar(
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] int? durationMinutes)
        {
            var result = await _bookingService.GetAvailabilityCalendarAsync(from, to, durationMinutes, HttpContext.RequestAborted);
            return Ok(result);
        }

        [HttpGet("available-slots")]
        public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots(
            [FromQuery] string date,
            [FromQuery] int? durationMinutes,
            [FromQuery] VehicleType? vehicleType,
            [FromQuery] int? preferredWorkerId)
        {
            if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

            var dateTime = DateTime.SpecifyKind(parsedDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var slots = await _bookingService.GetAvailableSlotsAsync(
                dateTime, durationMinutes, vehicleType, preferredWorkerId, null, HttpContext.RequestAborted);
            return Ok(slots);
        }

        // ---- Assignment mode ------------------------------------------------------

        [Authorize(Roles = "Admin")]
        [HttpGet("assignment-mode")]
        public async Task<ActionResult<AssignmentModeDto>> GetAssignmentMode()
        {
            var result = await _bookingService.GetAssignmentModeAsync();
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("assignment-mode")]
        public async Task<ActionResult<AssignmentModeDto>> UpdateAssignmentMode([FromBody] UpdateAssignmentModeDto dto)
        {
            await _bookingService.UpdateAssignmentModeAsync(dto.AutoAssignEnabled);
            return Ok(new AssignmentModeDto { AutoAssignEnabled = dto.AutoAssignEnabled });
        }

        // ---- Quote ----------------------------------------------------------------

        [HttpPost("quote")]
        public async Task<ActionResult<BookingQuoteDto>> GetBookingQuote([FromBody] BookingQuoteRequestDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var (result, error) = await _bookingService.GetBookingQuoteAsync(dto, GetUserId());
            if (result == null) return BadRequest(new { message = error });
            return Ok(result);
        }

        // ---- Create / read --------------------------------------------------------

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<BookingDto>> CreateBooking([FromBody] CreateBookingDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.CreateBookingAsync(dto, GetUserId(), lang, HttpContext.RequestAborted);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return StatusCode(statusCode, result);
        }

        [Authorize]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetMyBookings()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var result = await _bookingService.GetMyBookingsAsync(userId.Value, lang, HttpContext.RequestAborted);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("{bookingNumber}")]
        public async Task<ActionResult<BookingDto>> GetBooking(string bookingNumber)
        {
            var lang = ResolveRequestedLanguage();
            var isCustomer = !User.IsInRole("Admin") && !User.IsInRole("Employee");
            var (result, error, statusCode) = await _bookingService.GetBookingAsync(bookingNumber, GetUserId(), isCustomer, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Customer")]
        [HttpPost("{id}/tip")]
        public async Task<IActionResult> AddTip(int id, [FromBody] AddTipDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.AddTipAsync(id, userId.Value, dto.Amount);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }
    }
}
