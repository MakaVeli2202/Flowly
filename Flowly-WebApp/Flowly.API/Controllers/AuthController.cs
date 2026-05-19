using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Flowly.API.DTOs;
using Flowly.API.Modules.Auth;
using Flowly.API.Modules.Staff;
using Flowly.API.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IStaffService _staffService;
        private readonly IConfiguration _configuration;
        private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;

        public AuthController(
            IAuthService authService,
            IStaffService staffService,
            IConfiguration configuration,
            Microsoft.AspNetCore.Hosting.IWebHostEnvironment env)
        {
            _authService  = authService;
            _staffService = staffService;
            _configuration = configuration;
            _env          = env;
        }

        private int? GetUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(value, out var id) ? id : null;
        }

        private bool IsWorkerRole() => User.IsInRole("Employee");

        private void SetRefreshTokenCookie(string refreshToken)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var isDev = _env.IsDevelopment();
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure   = !isDev,
                SameSite = isDev ? SameSiteMode.Lax : SameSiteMode.None,
                Expires  = DateTimeOffset.UtcNow.AddDays(days),
                Path     = "/",
            });
        }

        // ── External login ────────────────────────────────────────────────────────

        [HttpGet("external-login/{provider}")]
        public async Task ExternalLogin(string provider, [FromQuery] string? returnUrl = null)
        {
            var redirectUrl = Url.Action(nameof(ExternalLoginCallback), "Auth", null, Request.Scheme);
            var properties  = new AuthenticationProperties { RedirectUri = redirectUrl };
            if (provider.Equals("Google", StringComparison.OrdinalIgnoreCase))
                await HttpContext.ChallengeAsync(GoogleDefaults.AuthenticationScheme, properties);
            else
                BadRequest(new { message = "Unsupported provider" });
        }

        [HttpGet("external-login-callback")]
        public async Task<ActionResult<AuthResponseDto>> ExternalLoginCallback()
        {
            var result = await HttpContext.AuthenticateAsync();
            if (!result.Succeeded)
                return Unauthorized(new { message = "External authentication failed" });

            var email = result.Principal?.FindFirst(ClaimTypes.Email)?.Value;
            var name  = result.Principal?.FindFirst(ClaimTypes.Name)?.Value;

            var (dto, error, statusCode) = await _authService.ExternalLoginCallbackAsync(email, name);
            if (dto == null) return StatusCode(statusCode, new { message = error });

            SetRefreshTokenCookie(dto.RefreshToken!);
            return Ok(dto);
        }

        // ── Registration ──────────────────────────────────────────────────────────

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            try
            {
                var (error, statusCode, requiresEmailVerification, email) = await _authService.RegisterAsync(dto);
                if (error != null) return StatusCode(statusCode, new { message = error });
                return Ok(new
                {
                    message                   = "Registration successful. Please check your email for a verification code.",
                    requiresEmailVerification,
                    email
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Registration error: {ex.Message}");
                return StatusCode(500, new { message = "Registration failed" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("register-worker")]
        public async Task<ActionResult<UserDto>> RegisterWorker(CreateWorkerDto dto)
        {
            try
            {
                var adminEmail = User.FindFirst(ClaimTypes.Email)?.Value;
                var (result, error) = await _staffService.RegisterWorkerAsync(dto, adminEmail);
                if (result == null) return BadRequest(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Worker registration error: {ex.Message}");
                return StatusCode(500, new { message = "Worker registration failed" });
            }
        }

        // ── Login / session ───────────────────────────────────────────────────────

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
        {
            try
            {
                var (result, error, statusCode, requiresEmailVerification, email) = await _authService.LoginAsync(dto);

                if (requiresEmailVerification)
                    return StatusCode(403, new { message = error, requiresEmailVerification = true, email });

                if (result == null)
                    return StatusCode(statusCode, new { message = error, reasonCode = statusCode == 401 ? "password_mismatch" : null });

                SetRefreshTokenCookie(result.RefreshToken!);
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login error: {ex.Message}");
                return StatusCode(500, new { message = "Login failed" });
            }
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequestDto? dto = null)
        {
            var incomingToken = Request.Cookies["refreshToken"] ?? dto?.RefreshToken;
            if (string.IsNullOrWhiteSpace(incomingToken))
                return Unauthorized(new { message = "No refresh token." });

            var tokens = await _authService.RefreshTokenAsync(incomingToken);
            if (tokens == null)
                return Unauthorized(new { message = "Refresh token expired or invalid." });

            SetRefreshTokenCookie(tokens.Value.refreshToken);
            return Ok(new { token = tokens.Value.accessToken, refreshToken = tokens.Value.refreshToken });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await _authService.LogoutAsync(GetUserId()!.Value, IsWorkerRole());
            Response.Cookies.Delete("refreshToken", new CookieOptions { Path = "/" });
            return Ok(new { message = "Logged out." });
        }

        // ── Profile ───────────────────────────────────────────────────────────────

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> GetCurrentUser()
        {
            try
            {
                var (result, error) = await _authService.GetCurrentUserAsync(GetUserId()!.Value, IsWorkerRole());
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Get user error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get user info" });
            }
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<ActionResult<UserDto>> UpdateCurrentUserProfile(UpdateProfileDto dto)
        {
            try
            {
                var (result, error) = await _authService.UpdateProfileAsync(GetUserId()!.Value, IsWorkerRole(), dto);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update profile error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update profile" });
            }
        }

        [Authorize]
        [HttpPost("me/profile-image")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<ActionResult<UserDto>> UploadCurrentUserProfileImage([FromForm] UploadProfileImageDto dto)
        {
            try
            {
                var image = dto.Image ?? Request.Form?.Files?.FirstOrDefault();
                if (image == null || image.Length == 0)
                    return BadRequest(new { message = "Please select an image file." });
                if (image.Length > 5 * 1024 * 1024)
                    return BadRequest(new { message = "Image is too large. Maximum size is 5MB." });
                if (string.IsNullOrWhiteSpace(image.ContentType) || !image.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { message = "Only image files are allowed." });

                var (result, error) = await _authService.UploadProfileImageAsync(GetUserId()!.Value, IsWorkerRole(), image);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Upload profile image error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to upload profile image" });
            }
        }

        // ── Password management ───────────────────────────────────────────────────

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword(ChangePasswordDto dto)
        {
            try
            {
                if (dto.NewPassword != dto.ConfirmNewPassword)
                    return BadRequest(new { message = "New password and confirmation do not match" });

                var userId = GetUserId()!.Value;
                if (IsWorkerRole())
                {
                    // Workers don't go through AuthService - we need direct access for password verification
                    // Delegate to auth service via interface
                    var (result, error) = await _authService.GetCurrentUserAsync(userId, true);
                    if (result == null) return NotFound(new { message = "User not found" });
                }

                var changeError = await ChangePasswordInternalAsync(userId, IsWorkerRole(), dto.CurrentPassword, dto.NewPassword);
                if (changeError != null) return BadRequest(new { message = changeError });
                return Ok(new { message = "Password updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Change password error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to change password" });
            }
        }

        [Authorize]
        [HttpPost("force-change-password")]
        public async Task<ActionResult> ForceChangePassword(ForceChangePasswordDto dto)
        {
            if (dto.NewPassword != dto.ConfirmNewPassword)
                return BadRequest(new { message = "Passwords do not match" });

            var error = await ForceChangePasswordInternalAsync(GetUserId()!.Value, dto.NewPassword);
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = "Password updated. You can now continue." });
        }

        // ── Email verification & password reset ───────────────────────────────────

        [HttpPost("send-verification")]
        public async Task<IActionResult> SendVerification([FromBody] SendVerificationDto dto)
        {
            await _authService.SendVerificationAsync(dto.Email);
            return Ok(new { message = "If that address is registered and unverified, a new code has been sent." });
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
        {
            var error = await _authService.VerifyEmailAsync(dto.Email, dto.Token);
            if (error == "ALREADY_VERIFIED") return Ok(new { message = "Email already verified. Please log in." });
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = "Email verified successfully. You can now log in." });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            await _authService.ForgotPasswordAsync(dto.Email);
            return Ok(new { message = "If that email address is registered, you will receive password reset instructions shortly." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (dto.NewPassword != dto.ConfirmNewPassword)
                return BadRequest(new { message = "Passwords do not match." });

            var error = await _authService.ResetPasswordAsync(dto.Token, dto.NewPassword);
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = "Password reset successfully. Please log in with your new password." });
        }

        [AllowAnonymous]
        [HttpPost("dev-generate-reset-token")]
        public async Task<IActionResult> DevGenerateResetToken([FromBody] ForgotPasswordDto dto)
        {
            if (!_env.IsDevelopment()) return NotFound();
            var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:5173";
            var result = await _authService.DevGenerateResetTokenAsync(dto.Email, frontendUrl);
            if (result == null) return NotFound(new { message = "User not found." });
            return Ok(new { token = result.Value.token, resetUrl = result.Value.resetUrl });
        }

        // ── Workers ───────────────────────────────────────────────────────────────

        [Authorize]
        [HttpGet("workers/active-names")]
        public async Task<ActionResult> GetActiveWorkerNames() =>
            Ok(await _staffService.GetActiveWorkerNamesAsync());

        [Authorize(Roles = "Admin")]
        [HttpGet("workers")]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetWorkers()
        {
            try { return Ok(await _staffService.GetWorkersAsync()); }
            catch (Exception ex)
            {
                Console.WriteLine($"Get workers error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get workers" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/check-short-code")]
        public async Task<ActionResult> CheckShortCode([FromQuery] string code, [FromQuery] int? excludeId = null)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { message = "Code is required." });
            var (available, normalized, suggestions) = await _staffService.CheckShortCodeAsync(code, excludeId);
            return Ok(new { available, normalized, suggestions });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("workers/suggest-shortcode")]
        public async Task<ActionResult> SuggestShortCode([FromBody] SuggestShortCodeDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FirstName) || string.IsNullOrWhiteSpace(dto.LastName))
                return BadRequest(new { message = "firstName and lastName are required." });
            var suggested = await _staffService.SuggestShortCodeAsync(dto.FirstName, dto.LastName);
            return Ok(new { suggested });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/schedule")]
        public async Task<ActionResult<UserDto>> UpdateWorkerSchedule(int id, UpdateWorkerScheduleDto dto)
        {
            try
            {
                var (result, error) = await _staffService.UpdateWorkerScheduleAsync(id, dto);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker schedule error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update worker schedule" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/{id}/schedule-conflicts")]
        public async Task<IActionResult> GetScheduleConflicts(int id, [FromQuery] string workingDays, [FromQuery] string shiftStart, [FromQuery] string shiftEnd)
        {
            var (conflicts, error) = await _staffService.GetScheduleConflictsAsync(id, workingDays, shiftStart, shiftEnd);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { hasConflicts = conflicts!.Count > 0, conflicts });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/status")]
        public async Task<ActionResult<UserDto>> UpdateWorkerStatus(int id, UpdateWorkerStatusDto dto)
        {
            try
            {
                var (result, error) = await _staffService.UpdateWorkerStatusAsync(id, dto);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker status error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update worker status" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("users/{id}/allow-preferred-worker")]
        public async Task<IActionResult> SetAllowPreferredWorker(int id, [FromBody] AllowPreferredWorkerDto dto)
        {
            var error = await _staffService.SetAllowPreferredWorkerAsync(id, dto.Allow);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message = "Updated.", allowPreferredWorker = dto.Allow });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/van-role")]
        public async Task<ActionResult<UserDto>> UpdateWorkerVanRole(int id, [FromBody] UpdateWorkerVanRoleDto dto)
        {
            var (result, error) = await _staffService.UpdateWorkerVanRoleAsync(id, dto);
            if (result == null) return NotFound(new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("workers/{id}")]
        public async Task<ActionResult> DeleteWorker(int id)
        {
            try
            {
                var error = await _staffService.DeleteWorkerAsync(id);
                if (error != null) return NotFound(new { message = error });
                return Ok(new { message = "Worker deleted successfully and their jobs have been unassigned" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Delete worker error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete worker" });
            }
        }

        // ── Attendance ────────────────────────────────────────────────────────────

        [Authorize(Roles = "Employee")]
        [HttpPost("attendance/clock-in")]
        public async Task<IActionResult> ClockIn()
        {
            var staffId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var (error, message, clockIn) = await _staffService.ClockInAsync(staffId);
            if (error != null) return BadRequest(new { message = error, clockIn });
            return Ok(new { message, clockIn });
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("attendance/clock-out")]
        public async Task<IActionResult> ClockOut([FromBody] ClockOutDto dto)
        {
            var staffId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var (error, clockIn, clockOut, durationMinutes) = await _staffService.ClockOutAsync(staffId, dto);
            if (error != null) return BadRequest(new { message = error, clockOut });
            return Ok(new { message = "Clocked out.", clockIn, clockOut, durationMinutes });
        }

        [Authorize(Roles = "Employee")]
        [HttpGet("attendance/today")]
        public async Task<IActionResult> GetTodayAttendance()
        {
            var staffId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Ok(await _staffService.GetTodayAttendanceAsync(staffId));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("attendance")]
        public async Task<IActionResult> GetAttendance([FromQuery] int? staffId, [FromQuery] DateTime? from, [FromQuery] DateTime? to) =>
            Ok(await _staffService.GetAttendanceAsync(staffId, from, to));

        // ── Payroll ───────────────────────────────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/salary")]
        public async Task<ActionResult<UserDto>> UpdateWorkerSalary(int id, UpdateWorkerSalaryDto dto)
        {
            try
            {
                var (result, error) = await _staffService.UpdateWorkerSalaryAsync(id, dto);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker salary error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update salary" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/iban")]
        public async Task<ActionResult<UserDto>> UpdateWorkerIban(int id, [FromBody] UpdateWorkerIbanDto dto)
        {
            try
            {
                var (result, error) = await _staffService.UpdateWorkerIbanAsync(id, dto);
                if (result == null) return NotFound(new { message = error });
                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker IBAN error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update IBAN" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/payroll")]
        public async Task<ActionResult<List<WorkerPayrollSummaryDto>>> GetPayrollSummary([FromQuery] int? month, [FromQuery] int? year)
        {
            try { return Ok(await _staffService.GetPayrollSummaryAsync(month, year)); }
            catch (Exception ex)
            {
                Console.WriteLine($"Get payroll summary error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get payroll summary" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("workers/mark-paid")]
        public async Task<ActionResult> MarkWorkerPaid([FromBody] MarkWorkerPaidDto dto)
        {
            try
            {
                var error = await _staffService.MarkWorkerPaidAsync(dto);
                if (error != null) return NotFound(new { message = error });
                return Ok(new { message = "Payment recorded successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Mark worker paid error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to record payment" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/payroll/unpaid-count")]
        public async Task<ActionResult> GetUnpaidCount()
        {
            try { return Ok(new { unpaidCount = await _staffService.GetUnpaidCountAsync() }); }
            catch (Exception ex)
            {
                Console.WriteLine($"Get unpaid count error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get unpaid count" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("workers/payroll/check-due")]
        public async Task<ActionResult> CheckPayrollDue()
        {
            try { return Ok(await _staffService.CheckPayrollDueAsync()); }
            catch (Exception ex)
            {
                Console.WriteLine($"Check payroll due error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to check payroll" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/payroll/settings")]
        public async Task<ActionResult> GetPaySlipSettings()
        {
            try { return Ok(await _staffService.GetPaySlipSettingsAsync()); }
            catch (Exception ex)
            {
                Console.WriteLine($"Get payslip settings error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get payslip settings" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/payroll/settings")]
        public async Task<ActionResult> UpdatePaySlipSettings([FromBody] PaySlipSettingsDto dto)
        {
            try
            {
                await _staffService.UpdatePaySlipSettingsAsync(dto);
                return Ok(new { message = "Settings updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update payslip settings error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update payslip settings" });
            }
        }

        // ── Push tokens ───────────────────────────────────────────────────────────

        [HttpPut("push-token")]
        [Authorize]
        public async Task<IActionResult> RegisterPushTokenAsync([FromBody] RegisterPushTokenDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Token) || !dto.Token.StartsWith("ExponentPushToken"))
                return BadRequest(new { message = "Invalid Expo push token." });
            await _authService.RegisterPushTokenAsync(GetUserId()!.Value, IsWorkerRole(), dto.Token.Trim());
            return Ok(new { message = "Push token registered." });
        }

        [HttpDelete("push-token")]
        [Authorize]
        public async Task<IActionResult> ClearPushTokenAsync()
        {
            await _authService.ClearPushTokenAsync(GetUserId()!.Value, IsWorkerRole());
            return Ok(new { message = "Push token cleared." });
        }

        [HttpGet("customers")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetCustomers() =>
            Ok(await _authService.GetCustomersAsync());

        // ── Private helpers (thin controller helpers only) ────────────────────────

        private async Task<string?> ChangePasswordInternalAsync(int userId, bool isWorker, string currentPassword, string newPassword)
        {
            // Password change requires verifying current password - kept here as it needs BCrypt.Verify
            // and both User + Staff tables. A dedicated ChangePasswordService method could be added later.
            if (isWorker)
            {
                var staff = await GetStaffFromContextAsync(userId);
                if (staff == null) return "User not found";
                if (!BCrypt.Net.BCrypt.Verify(currentPassword, staff.PasswordHash))
                    return "Current password is incorrect";
                if (BCrypt.Net.BCrypt.Verify(newPassword, staff.PasswordHash))
                    return "New password must be different from your current password";
                staff.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
                staff.UpdatedAt    = DateTime.UtcNow;
                await SaveContextAsync();
                return null;
            }
            var user = await GetUserFromContextAsync(userId);
            if (user == null) return "User not found";
            if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
                return "Current password is incorrect";
            if (BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
                return "New password must be different from your current password";
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.UpdatedAt    = DateTime.UtcNow;
            await SaveContextAsync();
            return null;
        }

        private async Task<string?> ForceChangePasswordInternalAsync(int userId, string newPassword)
        {
            var staff = await GetStaffFromContextAsync(userId);
            if (staff == null) return "This endpoint is only for staff accounts.";
            if (!staff.MustChangePassword) return "No forced password change is required.";
            if (BCrypt.Net.BCrypt.Verify(newPassword, staff.PasswordHash))
                return "New password must differ from the current password.";
            staff.PasswordHash       = BCrypt.Net.BCrypt.HashPassword(newPassword);
            staff.MustChangePassword = false;
            staff.UpdatedAt          = DateTime.UtcNow;
            await SaveContextAsync();
            return null;
        }

        // These minimal DB accessors remain because change-password requires BCrypt which is a
        // security concern that should stay close to the controller or move to a PasswordService later.
        private Task<Flowly.API.Models.Staff?> GetStaffFromContextAsync(int id) =>
            HttpContext.RequestServices.GetRequiredService<Flowly.API.Data.AppDbContext>().Staff.FindAsync(id).AsTask();
        private Task<Flowly.API.Models.User?> GetUserFromContextAsync(int id) =>
            HttpContext.RequestServices.GetRequiredService<Flowly.API.Data.AppDbContext>().Users.FindAsync(id).AsTask();
        private Task SaveContextAsync() =>
            HttpContext.RequestServices.GetRequiredService<Flowly.API.Data.AppDbContext>().SaveChangesAsync();
    }
}
