using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Glanz.API.DTOs;

namespace Glanz.API.Controllers
{
    public partial class BookingsController
    {
        [Authorize(Roles = "Employee")]
        [HttpGet("Employee")]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetWorkerBookings()
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var result = await _bookingService.GetWorkerBookingsAsync(workerId.Value, lang, HttpContext.RequestAborted);
            return Ok(result);
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/claim")]
        public async Task<ActionResult> ClaimBooking(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.ClaimBookingAsync(id, workerId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/start")]
        public async Task<ActionResult> StartJob(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.StartJobAsync(id, workerId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/on-my-way")]
        public async Task<ActionResult> MarkOnMyWay(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.MarkOnMyWayAsync(id, workerId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/arrived")]
        public async Task<ActionResult> MarkArrived(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.MarkArrivedAsync(id, workerId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/running-late")]
        public async Task<ActionResult> MarkRunningLate(int id, [FromBody] MarkRunningLateDto? dto)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.MarkRunningLateAsync(id, workerId.Value, dto?.DelayMinutes ?? 15, dto?.Reason);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/finish")]
        public async Task<ActionResult> FinishJob(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.FinishJobAsync(id, workerId.Value, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/pause")]
        public async Task<ActionResult> PauseJob(int id, [FromBody] PauseJobDto dto)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.PauseJobAsync(id, workerId.Value, dto.Reason);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/resume")]
        public async Task<ActionResult> ResumeJob(int id)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.ResumeJobAsync(id, workerId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/photos")]
        public async Task<IActionResult> UploadBookingPhoto(int id, [FromForm] UploadBookingPhotoDto dto)
        {
            var workerId = GetUserId();
            if (!workerId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.UploadBookingPhotoAsync(id, workerId.Value, dto.Photo, dto.PhotoType);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize]
        [HttpGet("{id}/photos")]
        public async Task<IActionResult> GetBookingPhotos(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var result = await _bookingService.GetBookingPhotosAsync(id, userId.Value);
            return Ok(result);
        }
    }
}
