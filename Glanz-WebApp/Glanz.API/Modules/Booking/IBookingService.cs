using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Modules.Booking
{
    public interface IBookingService
    {
        // Scheduling config
        Task<BookingConstraintsDto> GetConstraintsAsync();

        // Customer operations
        Task<(BookingDto? Result, string? Error, int StatusCode)> CreateBookingAsync(
            CreateBookingDto dto, int? userId, string lang, CancellationToken ct = default);
        Task<IEnumerable<BookingDto>> GetMyBookingsAsync(int userId, string lang, CancellationToken ct = default);
        Task<(BookingDto? Result, string? Error, int StatusCode)> GetBookingAsync(
            string bookingNumber, int? userId, bool isCustomer, string lang);
        Task<(BookingQuoteDto? Result, string? Error)> GetBookingQuoteAsync(BookingQuoteRequestDto dto, int? userId);

        // Availability
        Task<IEnumerable<string>> GetAvailableSlotsAsync(
            DateTime date, int? durationMinutes, VehicleType? vehicleType,
            int? preferredWorkerId, int? excludeBookingId = null, CancellationToken ct = default);
        Task<IEnumerable<DayAvailabilityDto>> GetAvailabilityCalendarAsync(
            DateTime from, DateTime to, int? durationMinutes, CancellationToken ct = default);

        // Admin: scheduling views
        Task<(IEnumerable<WorkerScheduleDayDto>? Result, string? Error)> GetWorkersScheduleAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
        Task<(IEnumerable<WorkerDayTimelineDto>? Result, string? Error)> GetWorkersDayTimelineAsync(string date, CancellationToken ct = default);

        // Admin: assignment mode
        Task<AssignmentModeDto> GetAssignmentModeAsync();
        Task UpdateAssignmentModeAsync(bool enabled);

        // Admin: booking management
        Task<(PagedBookingsResult? Result, string? Error)> GetAllBookingsAsync(
            int page, int pageSize, string? search, string? status,
            DateTime? dateFrom, DateTime? dateTo, int? filteredWorkerId, string lang, CancellationToken ct = default);
        Task<(BookingDto? Result, string? Error, int StatusCode)> UpdateChecklistItemAsync(
            int bookingId, int checklistItemId, bool isCompleted, int adminId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> UpdateBookingStatusAsync(
            int id, string status, int adminId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> AssignWorkerAsync(
            int bookingId, int workerId, int adminId);
        Task<IEnumerable<WorkerAvailabilityDto>> GetAvailableWorkersForBookingAsync(int bookingId);
        Task<(string? Error, int StatusCode)> UpdatePaymentStatusAsync(
            int id, string paymentStatus, int adminId);
        Task<(string? Error, int StatusCode)> CancelBookingAsync(int id, int userId, bool isAdmin);
        Task<(AdminCancelRefundResultDto? Result, string? Error, int StatusCode)> AdminCancelAndRefundAsync(
            int id, AdminCancelRefundDto dto, int adminId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> AddPackagesToBookingAsync(
            int bookingId, AddBookingPackageDto dto, int adminId, string lang);
        Task<(BookingDto? Result, string? Error, int StatusCode)> AddServicesToBookingAsync(
            int bookingId, AddBookingServiceDto dto, int adminId, string lang);
        Task<(WorkerAbsenceResultDto? Result, string? Error, int StatusCode)> MarkWorkerAbsentAsync(
            WorkerAbsenceDto dto, int adminId);
        Task<(string? Error, int StatusCode)> RequestCancellationAsync(int bookingId, int userId, string? reason);
        Task<(string? Error, int StatusCode)> RequestRescheduleAsync(int bookingId, int userId, RequestRescheduleDto dto);
        Task<(string? Error, int StatusCode)> RejectCancellationRequestAsync(int bookingId, int adminId);
        Task<(string? Error, int StatusCode)> RejectRescheduleRequestAsync(int bookingId, int adminId);
        Task<(CancellationFeeInfoDto? Result, string? Error, int StatusCode)> GetCancellationFeeAsync(int bookingId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> AdminEditBookingAsync(
            int id, AdminEditBookingDto dto, int adminId, string lang);
        Task<(BookingDto? Result, string? Error, int StatusCode)> CustomerEditBookingAsync(
            int id, CustomerEditBookingDto dto, int userId, string lang);

        // Worker operations
        Task<IEnumerable<BookingDto>> GetWorkerBookingsAsync(int workerId, string lang, CancellationToken ct = default);
        Task<(string? Error, int StatusCode)> ClaimBookingAsync(int bookingId, int workerId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> StartJobAsync(int bookingId, int workerId);
        Task<(string? Error, int StatusCode)> MarkOnMyWayAsync(int bookingId, int workerId);
        Task<(string? Error, int StatusCode)> MarkArrivedAsync(int bookingId, int workerId);
        Task<(string? Error, int StatusCode)> MarkRunningLateAsync(int bookingId, int workerId, int minutes, string? reason);
        Task<(BookingDto? Result, string? Error, int StatusCode)> FinishJobAsync(int bookingId, int workerId, string lang);
        Task<(string? Error, int StatusCode)> PauseJobAsync(int bookingId, int workerId, string? reason);
        Task<(string? Error, int StatusCode)> ResumeJobAsync(int bookingId, int workerId);
        Task<(BookingDto? Result, string? Error, int StatusCode)> UploadBookingPhotoAsync(
            int bookingId, int workerId, IFormFile file, string photoType);
        Task<IEnumerable<object>> GetBookingPhotosAsync(int bookingId, int workerId);
    }
}
