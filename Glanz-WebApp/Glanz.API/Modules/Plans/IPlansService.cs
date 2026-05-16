using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Modules.Plans
{
    public interface IPlansService
    {
        Task<IEnumerable<SubscriptionPlanDto>> GetPlansAsync(VehicleType? vehicleType);
        Task<IEnumerable<SubscriptionPlanDto>> GetAdminPlansAsync();
        Task<IEnumerable<UserSubscriptionAdminDto>> GetSubscribersAsync(UserSubscriptionStatus? status);
        Task<SubscriptionPlanDto> CreatePlanAsync(UpsertSubscriptionPlanDto dto);
        Task<(SubscriptionPlanDto? Result, string? Error)> UpdatePlanAsync(int id, UpsertSubscriptionPlanDto dto);
        Task<(string? Error, string Message)> DeletePlanAsync(int id);
        Task<(CustomerSubscriptionDto? Result, string? Error)> SubscribeAsync(int planId, int? userId);
        Task<(CustomerSubscriptionDto? Result, string? Error)> GetMySubscriptionAsync(int? userId);
        Task<(string? Error, string Message)> CancelMySubscriptionAsync(int? userId);
    }
}
