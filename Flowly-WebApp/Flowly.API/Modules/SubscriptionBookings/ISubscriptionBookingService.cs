using Flowly.API.DTOs;
using Flowly.API.Models;

namespace Flowly.API.Modules.SubscriptionBookings
{
    public interface ISubscriptionBookingService
    {
        Task<(IEnumerable<SubBookingDayAvailabilityDto> Result, string? Error)> GetAvailabilityAsync(int month, int year, int packageId);
        Task<(IEnumerable<SubBookingSlotDto>? Result, string? Error)> GetSlotsAsync(string date, int packageId);
        Task<(IEnumerable<SubscriptionBookingDto>? Result, string? Error)> CreateBookingsAsync(CreateSubscriptionBookingsDto dto, int userId);
        Task<IEnumerable<SubscriptionBookingDto>> GetMyBookingsAsync(int userId);
        Task<(string? Error, int StatusCode)> CancelBookingAsync(int id, int userId);
        Task<IEnumerable<SubscriptionBookingDto>> GetAllBookingsAsync(string? status);
        Task<(SubscriptionBookingDto? Result, string? Error)> UpdateBookingAsync(int id, UpdateSubscriptionBookingDto dto);
    }
}
