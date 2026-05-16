using Glanz.API.DTOs;

namespace Glanz.API.Modules.Staff
{
    public interface IStaffService
    {
        // Worker CRUD
        Task<(UserDto? Result, string? Error)> RegisterWorkerAsync(CreateWorkerDto dto, string? adminEmail);
        Task<IEnumerable<UserDto>> GetWorkersAsync();
        Task<IEnumerable<object>> GetActiveWorkerNamesAsync();
        Task<(bool Available, string Normalized, List<string> Suggestions)> CheckShortCodeAsync(string code, int? excludeId);
        Task<string> SuggestShortCodeAsync(string firstName, string lastName);
        Task<(UserDto? Result, string? Error)> UpdateWorkerScheduleAsync(int id, UpdateWorkerScheduleDto dto);
        Task<(UserDto? Result, string? Error)> UpdateWorkerStatusAsync(int id, UpdateWorkerStatusDto dto);
        Task<(UserDto? Result, string? Error)> UpdateWorkerSalaryAsync(int id, UpdateWorkerSalaryDto dto);
        Task<(UserDto? Result, string? Error)> UpdateWorkerIbanAsync(int id, UpdateWorkerIbanDto dto);
        Task<(UserDto? Result, string? Error)> UpdateWorkerVanRoleAsync(int id, UpdateWorkerVanRoleDto dto);
        Task<(List<object>? Conflicts, string? Error)> GetScheduleConflictsAsync(int staffId, string workingDays, string shiftStart, string shiftEnd);
        Task<string?> DeleteWorkerAsync(int id);
        Task<string?> SetAllowPreferredWorkerAsync(int userId, bool allow);

        // Attendance
        Task<(string? Error, string? Message, DateTime? ClockIn)> ClockInAsync(int staffId);
        Task<(string? Error, DateTime? ClockIn, DateTime? ClockOut, int? DurationMinutes)> ClockOutAsync(int staffId, ClockOutDto dto);
        Task<object> GetTodayAttendanceAsync(int staffId);
        Task<IEnumerable<object>> GetAttendanceAsync(int? staffId, DateTime? from, DateTime? to);

        // Payroll
        Task<List<WorkerPayrollSummaryDto>> GetPayrollSummaryAsync(int? month, int? year);
        Task<string?> MarkWorkerPaidAsync(MarkWorkerPaidDto dto);
        Task<int> GetUnpaidCountAsync();
        Task<object> CheckPayrollDueAsync();
        Task<object> GetPaySlipSettingsAsync();
        Task UpdatePaySlipSettingsAsync(PaySlipSettingsDto dto);
    }
}
