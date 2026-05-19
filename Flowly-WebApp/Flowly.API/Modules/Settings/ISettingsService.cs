using Flowly.API.DTOs;

namespace Flowly.API.Modules.Settings
{
    public interface ISettingsService
    {
        Task<object> GetSettingsAsync();
        Task<(string? Error, string? Message)> UpdateSettingsAsync(UpdateSettingsDto dto);
        Task<(string? Token, string? Error, string? ReasonCode, int StatusCode)> VerifyGateAccessAsync(string email, string password);
        Task<(string? Error, string? ReasonCode, int StatusCode)> RecoverAdminPasswordAsync(string email, string newPassword, string recoveryToken);
    }
}
