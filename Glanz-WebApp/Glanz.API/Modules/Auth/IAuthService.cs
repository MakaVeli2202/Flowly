using Glanz.API.DTOs;
using Glanz.API.Models;
using Microsoft.AspNetCore.Http;
using StaffEntity = Glanz.API.Models.Staff;

namespace Glanz.API.Modules.Auth
{
    public interface IAuthService
    {
        Task<(AuthResponseDto? Result, string? Error, int StatusCode, bool RequiresEmailVerification, string? Email)> LoginAsync(LoginDto dto);
        Task<(string? Error, int StatusCode, bool RequiresEmailVerification, string? Email)> RegisterAsync(RegisterDto dto);
        Task<(string accessToken, string refreshToken)?> RefreshTokenAsync(string incomingToken);
        Task LogoutAsync(int userId, bool isWorker);

        Task<(UserDto? Result, string? Error)> GetCurrentUserAsync(int userId, bool isWorker);
        Task<(UserDto? Result, string? Error)> UpdateProfileAsync(int userId, bool isWorker, UpdateProfileDto dto);
        Task<(UserDto? Result, string? Error)> UploadProfileImageAsync(int userId, bool isWorker, IFormFile image);

        Task<(AuthResponseDto? Result, string? Error, int StatusCode)> ExternalLoginCallbackAsync(
            string? email, string? name);

        Task SendVerificationAsync(string email);
        Task<string?> VerifyEmailAsync(string email, string token);
        Task ForgotPasswordAsync(string email);
        Task<string?> ResetPasswordAsync(string token, string newPassword);
        Task<(string token, string resetUrl)?> DevGenerateResetTokenAsync(string email, string frontendUrl);

        Task RegisterPushTokenAsync(int userId, bool isWorker, string token);
        Task ClearPushTokenAsync(int userId, bool isWorker);

        Task<IEnumerable<object>> GetCustomersAsync();

        Task<(string accessToken, string refreshToken)> IssueTokensAsync(User user);
        Task<(string accessToken, string refreshToken)> IssueStaffTokensAsync(StaffEntity staff);
        Task<UserDto> ToUserDtoAsync(User user);
        UserDto ToUserDtoFromStaff(StaffEntity staff, IEnumerable<StaffEntity>? allStaff = null);
    }
}
