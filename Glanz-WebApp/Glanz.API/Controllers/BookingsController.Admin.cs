using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Glanz.API.DTOs;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    public partial class BookingsController
    {
        [Authorize(Roles = "Admin,Employee")]
        [HttpGet("all")]
        public async Task<ActionResult<PagedBookingsResult>> GetAllBookings(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo = null,
            [FromQuery] int? workerId = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var lang = ResolveRequestedLanguage();

            // Employee role: auto-filter to own bookings unless workerId override provided
            int? filteredWorkerId = workerId;
            if (User.IsInRole("Employee") && !filteredWorkerId.HasValue)
            {
                var uid = GetUserId();
                if (!uid.HasValue) return Unauthorized();
                filteredWorkerId = uid.Value;
            }

            var (result, error) = await _bookingService.GetAllBookingsAsync(
                page, pageSize, search, status, dateFrom, dateTo, filteredWorkerId, lang, HttpContext.RequestAborted);
            if (result == null) return BadRequest(new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin,Employee")]
        [HttpPut("{bookingId}/checklist/{checklistItemId}")]
        public async Task<ActionResult<BookingChecklistItemDto>> UpdateChecklistItem(
            int bookingId, int checklistItemId, [FromBody] UpdateChecklistItemDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.UpdateChecklistItemAsync(bookingId, checklistItemId, dto.IsCompleted, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin,Employee")]
        [HttpPut("{id}/status")]
        public async Task<ActionResult> UpdateBookingStatus(int id, UpdateBookingStatusDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.UpdateBookingStatusAsync(id, dto.Status.ToString(), adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("assign-worker")]
        public async Task<ActionResult> AssignWorker([FromBody] AssignWorkerDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            if (!dto.WorkerId.HasValue) return BadRequest(new { message = "WorkerId is required." });
            var (result, error, statusCode) = await _bookingService.AssignWorkerAsync(dto.BookingId, dto.WorkerId.Value, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{id}/available-workers")]
        public async Task<ActionResult<IEnumerable<WorkerAvailabilityDto>>> GetAvailableWorkersForBooking(int id)
        {
            var result = await _bookingService.GetAvailableWorkersForBookingAsync(id);
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/payment-status")]
        public async Task<ActionResult> UpdatePaymentStatus(int id, UpdatePaymentStatusDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.UpdatePaymentStatusAsync(id, dto.PaymentStatus.ToString(), adminId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<ActionResult> CancelBooking(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var isAdmin = User.IsInRole("Admin");
            var (error, statusCode) = await _bookingService.CancelBookingAsync(id, userId.Value, isAdmin);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/admin-cancel-refund")]
        public async Task<ActionResult<AdminCancelRefundResultDto>> AdminCancelAndRefund(int id, [FromBody] AdminCancelRefundDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.AdminCancelAndRefundAsync(id, dto, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/add-package")]
        public async Task<ActionResult<BookingDto>> AddPackagesToBooking(int id, [FromBody] AddBookingPackageDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.AddPackagesToBookingAsync(id, dto, adminId.Value, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/add-service")]
        public async Task<ActionResult<BookingDto>> AddServicesToBooking(int id, [FromBody] AddBookingServiceDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.AddServicesToBookingAsync(id, dto, adminId.Value, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("worker-absence")]
        public async Task<ActionResult<WorkerAbsenceResultDto>> MarkWorkerAbsent([FromBody] WorkerAbsenceDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (result, error, statusCode) = await _bookingService.MarkWorkerAbsentAsync(dto, adminId.Value);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize]
        [HttpPost("{id}/request-cancellation")]
        public async Task<ActionResult> RequestCancellation(int id, [FromBody] RequestCancellationDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.RequestCancellationAsync(id, userId.Value, dto.Reason);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize]
        [HttpPost("{id}/request-reschedule")]
        public async Task<ActionResult> RequestReschedule(int id, [FromBody] RequestRescheduleDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.RequestRescheduleAsync(id, userId.Value, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/reject-cancellation-request")]
        public async Task<ActionResult> RejectCancellationRequest(int id)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.RejectCancellationRequestAsync(id, adminId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/reject-reschedule-request")]
        public async Task<ActionResult> RejectRescheduleRequest(int id)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var (error, statusCode) = await _bookingService.RejectRescheduleRequestAsync(id, adminId.Value);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [Authorize]
        [HttpGet("{id}/cancellation-fee")]
        public async Task<ActionResult<CancellationFeeInfoDto>> GetCancellationFee(int id)
        {
            var (result, error, statusCode) = await _bookingService.GetCancellationFeeAsync(id);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize]
        [HttpPut("{id}/admin-edit")]
        public async Task<ActionResult<BookingDto>> AdminEditBooking(int id, [FromBody] AdminEditBookingDto dto)
        {
            var adminId = GetUserId();
            if (!adminId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.AdminEditBookingAsync(id, dto, adminId.Value, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin,Customer")]
        [HttpGet("{id}/invoice/pdf")]
        public async Task<IActionResult> DownloadInvoice(int id, [FromServices] IInvoiceService invoiceService)
        {
            var lang = ResolveRequestedLanguage();
            var pdfBytes = await invoiceService.GeneratePdfAsync(id, lang);
            if (pdfBytes.Length == 0) return NotFound(new { message = "Booking not found" });
            return File(pdfBytes, "application/pdf", $"invoice-{id}.pdf");
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/invoice/store")]
        public async Task<IActionResult> StoreInvoice(int id, [FromServices] IInvoiceService invoiceService)
        {
            var lang = ResolveRequestedLanguage();
            var url = await invoiceService.GenerateAndStoreAsync(id, lang);
            if (url == null) return StatusCode(500, new { message = "PDF generation failed" });
            return Ok(new { invoicePdfUrl = url });
        }

        [Authorize]
        [HttpPut("{id}/customer-edit")]
        public async Task<ActionResult<BookingDto>> CustomerEditBooking(int id, [FromBody] CustomerEditBookingDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();
            var lang = ResolveRequestedLanguage();
            var (result, error, statusCode) = await _bookingService.CustomerEditBookingAsync(id, dto, userId.Value, lang);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }
    }
}
