namespace Flowly.API.Modules.RecurringBookings
{
    public class RecurringRuleDto
    {
        public int Id { get; set; }
        public string Frequency { get; set; } = string.Empty;
        public int? DayOfWeek { get; set; }
        public int? DayOfMonth { get; set; }
        public string PreferredTimeSlot { get; set; } = string.Empty;
        public List<int> PackageIds { get; set; } = new();
        public int? PreferredWorkerId { get; set; }
        public string VehicleType { get; set; } = "Sedan";
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleYear { get; set; }
        public string? CustomerAddress { get; set; }
        public DateTime NextScheduledDate { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateRecurringRuleDto
    {
        public string Frequency { get; set; } = "Weekly"; // Weekly | Monthly
        public int? DayOfWeek { get; set; }   // 0-6
        public int? DayOfMonth { get; set; }  // 1-28
        public string PreferredTimeSlot { get; set; } = "09:00";
        public List<int> PackageIds { get; set; } = new();
        public int? PreferredWorkerId { get; set; }
        public string VehicleType { get; set; } = "Sedan";
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleYear { get; set; }
        public string? CustomerAddress { get; set; }
    }

    public interface IRecurringBookingService
    {
        Task<IEnumerable<RecurringRuleDto>> GetMyRulesAsync(int userId);
        Task<(RecurringRuleDto? Result, string? Error, int StatusCode)> CreateRuleAsync(int userId, int orgId, CreateRecurringRuleDto dto);
        Task<(string? Error, int StatusCode)> PauseRuleAsync(int userId, int id);
        Task<(string? Error, int StatusCode)> ResumeRuleAsync(int userId, int id);
        Task<(string? Error, int StatusCode)> DeleteRuleAsync(int userId, int id);
        Task<IEnumerable<RecurringRuleDto>> GetAllRulesAdminAsync(int orgId);
        Task ProcessDueRulesAsync(CancellationToken ct);
    }
}
