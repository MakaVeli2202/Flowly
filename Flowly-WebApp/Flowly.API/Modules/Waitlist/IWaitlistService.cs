namespace Flowly.API.Modules.Waitlist
{
    public class WaitlistEntryDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? CustomerName { get; set; }
        public DateTime RequestedDate { get; set; }
        public string? PreferredTimeSlot { get; set; }
        public int? PackageId { get; set; }
        public string? PackageName { get; set; }
        public string Status { get; set; } = "Waiting";
        public DateTime CreatedAt { get; set; }
    }

    public class JoinWaitlistDto
    {
        public DateTime RequestedDate { get; set; }
        public string? PreferredTimeSlot { get; set; }
        public int? PackageId { get; set; }
    }

    public interface IWaitlistService
    {
        Task<IEnumerable<WaitlistEntryDto>> GetMyEntriesAsync(int userId);
        Task<(WaitlistEntryDto? Result, string? Error, int StatusCode)> JoinAsync(int userId, int orgId, JoinWaitlistDto dto);
        Task<(string? Error, int StatusCode)> LeaveAsync(int userId, int id);
        Task<IEnumerable<WaitlistEntryDto>> GetAllAdminAsync(int orgId, string? date);
        Task<int> NotifyWaitlistAsync(int orgId, DateTime date, string? timeSlot, CancellationToken ct);
    }
}
