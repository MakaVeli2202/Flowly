using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Modules.CRM;
using Glanz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CrmController : ControllerBase
    {
        private readonly ICrmService _crmService;

        public CrmController(ICrmService crmService)
        {
            _crmService = crmService;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        [Authorize(Roles = "Admin")]
        [HttpGet("dashboard")]
        public async Task<ActionResult<CrmDashboardDto>> GetCrmDashboard() =>
            Ok(await _crmService.GetDashboardAsync());

        [Authorize(Roles = "Admin")]
        [HttpGet("stats")]
        public async Task<ActionResult<CrmStatsDto>> GetCrmStats() =>
            Ok(await _crmService.GetStatsAsync());

        [Authorize(Roles = "Admin")]
        [HttpGet("booking-sources")]
        public async Task<ActionResult<BookingSourceStatsDto>> GetBookingSourceStats() =>
            Ok(await _crmService.GetBookingSourceStatsAsync());

        [Authorize(Roles = "Admin")]
        [HttpGet("customers")]
        public async Task<ActionResult<IEnumerable<CrmCustomerDto>>> GetCrmCustomers(
            [FromQuery] string? segment,
            [FromQuery] decimal? minSpend, [FromQuery] decimal? maxSpend,
            [FromQuery] int? minBookings, [FromQuery] int? maxBookings,
            [FromQuery] DateTime? lastBookingBefore, [FromQuery] DateTime? lastBookingAfter,
            [FromQuery] string? tags) =>
            Ok(await _crmService.GetCrmCustomersAsync(segment, minSpend, maxSpend, minBookings, maxBookings, lastBookingBefore, lastBookingAfter, tags));

        [Authorize(Roles = "Admin")]
        [HttpGet("customers/export")]
        public async Task<IActionResult> ExportCustomersCsv(
            [FromQuery] string? segment,
            [FromQuery] decimal? minSpend, [FromQuery] decimal? maxSpend,
            [FromQuery] int? minBookings, [FromQuery] int? maxBookings,
            [FromQuery] DateTime? lastBookingBefore, [FromQuery] DateTime? lastBookingAfter,
            [FromQuery] string? tags)
        {
            var customers = await _crmService.GetCrmCustomersAsync(segment, minSpend, maxSpend, minBookings, maxBookings, lastBookingBefore, lastBookingAfter, tags);
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("Id,Name,Email,Phone,Segment,TotalBookings,TotalSpent,LastBookedDate,Tags");
            foreach (var c in customers)
            {
                sb.AppendLine(
                    $"{c!.Id}," +
                    $"\"{c.Name.Replace("\"", "\"\"")}\"," +
                    $"\"{c.Email}\"," +
                    $"\"{c.Phone ?? ""}\"," +
                    $"{c.Segment}," +
                    $"{c.TotalBookings}," +
                    $"{c.TotalSpent}," +
                    $"\"{c.LastBookedDate?.ToString("yyyy-MM-dd") ?? ""}\"," +
                    $"\"{c.Tags ?? ""}\"");
            }
            var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", $"customers-{DateTime.UtcNow:yyyy-MM-dd}.csv");
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("customer/{id}")]
        public async Task<ActionResult<CustomerProfileDto>> GetCustomerProfile(int id)
        {
            var (result, error) = await _crmService.GetCustomerProfileAsync(id);
            if (result == null) return NotFound(new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("customer/{id}")]
        public async Task<ActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerDto dto)
        {
            var error = await _crmService.UpdateCustomerAsync(id, dto);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message = "Customer updated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("customers/bulk-tag")]
        public async Task<ActionResult> BulkUpdateTags([FromBody] BulkTagDto dto)
        {
            var (error, updated) = await _crmService.BulkUpdateTagsAsync(dto);
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = $"Updated {updated} customer(s).", updated });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("customers/bulk-message")]
        public async Task<ActionResult> BulkMessage([FromBody] BulkMessageDto dto)
        {
            var (error, sent) = await _crmService.BulkMessageAsync(dto);
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = $"Sent to {sent} customer(s).", sent });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("customers/{id}/timeline")]
        public async Task<ActionResult> GetCustomerTimeline(int id)
        {
            var timeline = await _crmService.GetCommunicationTimelineAsync(id);
            return Ok(timeline);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("at-risk")]
        public async Task<ActionResult<IEnumerable<CrmCustomerDto>>> GetAtRiskCustomers() =>
            Ok(await _crmService.GetAtRiskCustomersAsync());

        [HttpPost("feedback")]
        public async Task<ActionResult<FeedbackDto>> SubmitFeedback([FromBody] CreateFeedbackDto dto) =>
            Ok(await _crmService.SubmitFeedbackAsync(dto, GetUserId()));

        [Authorize]
        [HttpGet("feedback/my")]
        public async Task<ActionResult<IEnumerable<FeedbackDto>>> GetMyFeedback()
        {
            if (!GetUserId().HasValue) return Unauthorized();
            var (result, _) = await _crmService.GetMyFeedbackAsync(GetUserId()!.Value);
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("feedback")]
        public async Task<ActionResult<IEnumerable<FeedbackDto>>> GetAllFeedback([FromQuery] FeedbackType? type, [FromQuery] bool? resolved) =>
            Ok(await _crmService.GetAllFeedbackAsync(type, resolved));

        [Authorize(Roles = "Admin")]
        [HttpPut("feedback/{id}/resolve")]
        public async Task<ActionResult> ResolveFeedback(int id, [FromBody] ResolveFeedbackDto dto)
        {
            var error = await _crmService.ResolveFeedbackAsync(id, dto);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message = "Feedback resolved." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("fix-customer-data")]
        public async Task<ActionResult> FixCustomerData()
        {
            var (message, updated, total) = await _crmService.FixCustomerDataAsync();
            return Ok(new { message, updatedCustomers = updated, totalCustomers = total });
        }
    }
}
