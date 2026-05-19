using Flowly.API.DTOs;
using Flowly.API.Models;

namespace Flowly.API.Modules.CRM
{
    public interface ICrmService
    {
        Task<CrmDashboardDto> GetDashboardAsync();
        Task<CrmStatsDto> GetStatsAsync();
        Task<BookingSourceStatsDto> GetBookingSourceStatsAsync();
        Task<IEnumerable<CrmCustomerDto?>> GetCrmCustomersAsync(
            string? segment,
            decimal? minSpend = null, decimal? maxSpend = null,
            int? minBookings = null, int? maxBookings = null,
            DateTime? lastBookingBefore = null, DateTime? lastBookingAfter = null,
            string? tags = null);
        Task<(CustomerProfileDto? Result, string? Error)> GetCustomerProfileAsync(int id);
        Task<string?> UpdateCustomerAsync(int id, UpdateCustomerDto dto);
        Task<(string? Error, int Updated)> BulkUpdateTagsAsync(BulkTagDto dto);
        Task<(string? Error, int Sent)> BulkMessageAsync(BulkMessageDto dto);
        Task<IEnumerable<TimelineEventDto>> GetCommunicationTimelineAsync(int customerId);
        Task<IEnumerable<CrmCustomerDto>> GetAtRiskCustomersAsync();
        Task<FeedbackDto> SubmitFeedbackAsync(CreateFeedbackDto dto, int? userId);
        Task<(IEnumerable<FeedbackDto>? Result, string? Error)> GetMyFeedbackAsync(int userId);
        Task<IEnumerable<FeedbackDto>> GetAllFeedbackAsync(FeedbackType? type, bool? resolved);
        Task<string?> ResolveFeedbackAsync(int id, ResolveFeedbackDto dto);
        Task<(string Message, int Updated, int Total)> FixCustomerDataAsync();
    }
}
