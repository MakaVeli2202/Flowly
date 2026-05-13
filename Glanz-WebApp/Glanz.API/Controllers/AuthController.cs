using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ITokenService _tokenService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly IAuditService _audit;
        private readonly ICredentialVerifier _credentialVerifier;
        private readonly IObjectStorageService _objectStorage;
        private readonly IEmailService _emailService;
        private static readonly string[] DefaultAvatarUrls =
        {
            "/assets/avatars/default-gulf-male-1.svg",
            "/assets/avatars/default-gulf-male-2.svg",
            "/assets/avatars/default-gulf-female-1.svg",
            "/assets/avatars/default-gulf-female-2.svg",
            "/assets/avatars/default-expat-male-1.svg",
            "/assets/avatars/default-expat-female-1.svg"
        };

        public AuthController(AppDbContext context, ITokenService tokenService, IConfiguration configuration, IWebHostEnvironment env, IAuditService audit, ICredentialVerifier credentialVerifier, IObjectStorageService objectStorage, IEmailService emailService)
        {
            _context = context;
            _audit = audit;
            _tokenService = tokenService;
            _configuration = configuration;
            _env = env;
            _credentialVerifier = credentialVerifier;
            _objectStorage = objectStorage;
            _emailService = emailService;
        }

        private void SetRefreshTokenCookie(string refreshToken)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var isDev = _env.IsDevelopment();
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure   = !isDev,
                // None is required for cross-origin requests with credentials in most browsers;
                // fallback to Lax for older clients that reject SameSite=None without Secure.
                SameSite = isDev ? SameSiteMode.Lax : SameSiteMode.None,
                Expires  = DateTimeOffset.UtcNow.AddDays(days),
                Path     = "/",
            });
        }

        private async Task<(string accessToken, string refreshToken)> IssueTokensAsync(User user)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var accessToken   = _tokenService.GenerateToken(user);
            var refreshToken  = _tokenService.GenerateRefreshToken();
            user.RefreshToken  = refreshToken;
            user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(days);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (accessToken, refreshToken);
        }

        private async Task<(string accessToken, string refreshToken)> IssueStaffTokensAsync(Staff staff)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var accessToken   = _tokenService.GenerateToken(staff);
            var refreshToken  = _tokenService.GenerateRefreshToken();
            staff.RefreshToken  = refreshToken;
            staff.RefreshTokenExpiry = DateTime.UtcNow.AddDays(days);
            staff.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (accessToken, refreshToken);
        }

        private static string GetRandomDefaultAvatarUrl()
        {
            return DefaultAvatarUrls[Random.Shared.Next(DefaultAvatarUrls.Length)];
        }

        private static string NormalizeAddressType(string? addressType)
        {
            return addressType?.Trim().ToLowerInvariant() switch
            {
                "work" => "Work",
                "other" => "Other",
                _ => "Home"
            };
        }

        private static string? GetAddressByType(User user, string addressType)
        {
            return addressType switch
            {
                "Work" => user.WorkAddress,
                "Other" => user.OtherAddress,
                _ => user.HomeAddress
            };
        }

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        private static List<WorkerDayScheduleEntry>? ParseDaySchedules(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<WorkerDayScheduleEntry>>(json, _jsonOpts); }
            catch { return null; }
        }

        private static UserDto ToUserDto(User user)
        {
            var preferredAddressType = NormalizeAddressType(user.PreferredAddressType);

            if (string.IsNullOrWhiteSpace(GetAddressByType(user, preferredAddressType)))
            {
                preferredAddressType = !string.IsNullOrWhiteSpace(user.HomeAddress)
                    ? "Home"
                    : !string.IsNullOrWhiteSpace(user.WorkAddress)
                        ? "Work"
                        : !string.IsNullOrWhiteSpace(user.OtherAddress)
                            ? "Other"
                            : "Home";
            }

            return new UserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                Phone = user.Phone,
                ProfileImageUrl = user.ProfileImageUrl,
                HomeAddress = user.HomeAddress,
                WorkAddress = user.WorkAddress,
                OtherAddress = user.OtherAddress,
                PreferredAddressType = preferredAddressType,
                Role = user.Role,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                FirstWashCompletedAt = user.FirstWashCompletedAt,
                TotalBookingsCount = user.TotalBookingsCount,
            };
        }

        private static UserDto ToUserDtoFromStaff(Staff staff)
        {
            return new UserDto
            {
                Id = staff.Id,
                FirstName = staff.FirstName,
                LastName = staff.LastName,
                Email = staff.Email,
                Phone = staff.Phone,
                ProfileImageUrl = staff.ProfileImageUrl,
                Role = staff.Role,
                IsActive = staff.IsActive,
                CreatedAt = staff.CreatedAt,
                WorkingDays = staff.WorkingDays,
                ShiftStart = staff.ShiftStart,
                ShiftEnd = staff.ShiftEnd,
                DaySchedules = ParseDaySchedules(staff.DaySchedulesJson),
                MonthlySalary = staff.MonthlySalary,
                IBAN = staff.IBAN,
                StaffType = staff.StaffType,
            };
        }

        private bool IsWorkerRole() => User.IsInRole("Employee");

        [HttpGet("external-login/{provider}")]
        public async Task ExternalLogin(string provider, [FromQuery] string? returnUrl = null)
        {
            var redirectUrl = Url.Action(nameof(ExternalLoginCallback), "Auth", null, Request.Scheme);
            var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
            
            if (provider.Equals("Google", StringComparison.OrdinalIgnoreCase))
            {
                await HttpContext.ChallengeAsync(GoogleDefaults.AuthenticationScheme, properties);
            }
            else
            {
                BadRequest(new { message = "Unsupported provider" });
            }
        }

        [HttpGet("external-login-callback")]
        public async Task<ActionResult<AuthResponseDto>> ExternalLoginCallback()
        {
            var authenticateResult = await HttpContext.AuthenticateAsync();
            if (!authenticateResult.Succeeded)
            {
                return Unauthorized(new { message = "External authentication failed" });
            }

            var externalEmail = authenticateResult.Principal?.FindFirst(ClaimTypes.Email)?.Value;
            var externalName = authenticateResult.Principal?.FindFirst(ClaimTypes.Name)?.Value;
            var provider = authenticateResult.Properties?.Items?.ContainsKey(".AuthScheme") == true
                ? authenticateResult.Properties.Items[".AuthScheme"] 
                : "Unknown";

            if (string.IsNullOrWhiteSpace(externalEmail))
            {
                return BadRequest(new { message = "Email not provided by external provider" });
            }

            var normalizedEmail = externalEmail.Trim().ToLowerInvariant();

            // Check if user exists in Users table
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            
            if (existingUser == null)
            {
                // Create new user from external login
                var nameParts = (externalName ?? "Google User").Split(' ', 2);
                existingUser = new User
                {
                    FirstName = nameParts.Length > 0 ? nameParts[0] : "User",
                    LastName = nameParts.Length > 1 ? nameParts[1] : "",
                    Email = normalizedEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")), // Random password for external login
                    ProfileImageUrl = GetRandomDefaultAvatarUrl(),
                    Role = "Customer",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Users.Add(existingUser);
                await _context.SaveChangesAsync();
            }

            if (!existingUser.IsActive)
            {
                return Unauthorized(new { message = "Account is disabled" });
            }

            var (accessToken, refreshToken) = await IssueTokensAsync(existingUser);
            SetRefreshTokenCookie(refreshToken);

            return Ok(new AuthResponseDto
            {
                Token = accessToken,
                RefreshToken = refreshToken,
                User = ToUserDto(existingUser)
            });
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto)
        {
            try
            {
                var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
                if (await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
                {
                    return BadRequest(new { message = "Email already registered" });
                }

                var firstName = dto.FirstName?.Trim() ?? string.Empty;
                var lastName = dto.LastName?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                {
                    return BadRequest(new { message = "First name and last name are required" });
                }

                var user = new User
                {
                    FirstName = firstName,
                    LastName = lastName,
                    Email = normalizedEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
                    ProfileImageUrl = GetRandomDefaultAvatarUrl(),
                    HomeAddress = string.IsNullOrWhiteSpace(dto.HomeAddress) ? null : dto.HomeAddress.Trim(),
                    PreferredAddressType = "Home",
                    Role = "Customer",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                };

                // Process referral code if provided
                if (!string.IsNullOrWhiteSpace(dto.ReferralCode))
                {
                    // Check if this email already has used a referral code in the past
                    var existingUserWithReferral = await _context.Users
                        .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail && u.HasUsedReferralCode);
                    
                    if (existingUserWithReferral != null)
                    {
                        return BadRequest(new { message = "You have already used a referral code. Each customer can only use one referral code." });
                    }

                    var code = dto.ReferralCode.Trim().ToUpperInvariant();
                    var referrer = await _context.Users
                        .FirstOrDefaultAsync(u => u.ReferralCode != null && u.ReferralCode.ToUpper() == code);
                    
                    if (referrer != null && referrer.Id != user.Id)
                    {
                        user.ReferredByUserId = referrer.Id;
                        user.HasUsedReferralCode = true; // Mark as used - cannot use another code
                    }
                }

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                var bookingEmail = user.Email.Trim().ToLowerInvariant();
                var existingBookings = await _context.Bookings
                    .Where(b => b.CustomerEmail.ToLower() == bookingEmail && b.UserId != user.Id)
                    .ToListAsync();

                if (existingBookings.Count > 0)
                {
                    foreach (var booking in existingBookings)
                    {
                        booking.UserId = user.Id;
                    }

                    await _context.SaveChangesAsync();
                }

                // Generate and send email verification OTP.
                // The user cannot log in until they verify their email.
                var otp = GenerateNumericOtp();
                user.EmailVerificationToken       = BCrypt.Net.BCrypt.HashPassword(otp);
                user.EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24);
                user.IsEmailVerified              = false;
                await _context.SaveChangesAsync();

                try
                {
                    await _emailService.SendEmailVerificationAsync(user.Email, user.FirstName, otp);
                }
                catch (Exception emailEx)
                {
                    Console.WriteLine($"[Auth/Register] Email send failed (non-fatal): {emailEx.Message}");
                }

                return Ok(new
                {
                    message                  = "Registration successful. Please check your email for a verification code.",
                    requiresEmailVerification = true,
                    email                    = user.Email
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
                if (await _context.Staff.AnyAsync(s => s.Email == dto.Email) ||
                    await _context.Users.AnyAsync(u => u.Email == dto.Email))
                {
                    return BadRequest(new { message = "Email already registered" });
                }

                var staff = new Staff
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    Phone = dto.Phone,
                    ProfileImageUrl = GetRandomDefaultAvatarUrl(),
                    Role = "Employee",
                    StaffType = string.IsNullOrWhiteSpace(dto.StaffType) ? "Detailer" : dto.StaffType,
                    IBAN = string.IsNullOrWhiteSpace(dto.IBAN) ? null : dto.IBAN.Trim(),
                    IsActive = true,
                    WorkingDays = _configuration["BusinessSettings:DefaultWorkerWorkingDays"]
                        ?? "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    ShiftStart = _configuration["BusinessSettings:DefaultWorkerShiftStart"] ?? "08:00",
                    ShiftEnd   = _configuration["BusinessSettings:DefaultWorkerShiftEnd"]   ?? "17:00",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Staff.Add(staff);
                await _context.SaveChangesAsync();

                var adminEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
                await _audit.LogAsync(
                    action:     "WorkerCreated",
                    userEmail:  adminEmail,
                    entityType: "Staff",
                    entityId:   staff.Id.ToString(),
                    metadata: new { staffEmail = staff.Email, staffType = staff.StaffType });

                return Ok(ToUserDtoFromStaff(staff));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Worker registration error: {ex.Message}");
                return StatusCode(500, new { message = "Worker registration failed" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers")]
        public async Task<ActionResult<IEnumerable<UserDto>>> GetWorkers()
        {
            try
            {
                var workers = await _context.Staff
                    .OrderBy(s => s.FirstName)
                    .ThenBy(s => s.LastName)
                    .ToListAsync();

                return Ok(workers.Select(ToUserDtoFromStaff));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Get workers error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to get workers" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/schedule")]
        public async Task<ActionResult<UserDto>> UpdateWorkerSchedule(int id, UpdateWorkerScheduleDto dto)
        {
            try
            {
                var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
                if (staff == null)
                    return NotFound(new { message = "Worker not found" });

                staff.WorkingDays = dto.WorkingDays.Trim();
                staff.ShiftStart = dto.ShiftStart.Trim();
                staff.ShiftEnd = dto.ShiftEnd.Trim();
                staff.DaySchedulesJson = (dto.DaySchedules != null && dto.DaySchedules.Count > 0)
                    ? JsonSerializer.Serialize(dto.DaySchedules)
                    : null;
                staff.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(ToUserDtoFromStaff(staff));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker schedule error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update worker schedule" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/status")]
        public async Task<ActionResult<UserDto>> UpdateWorkerStatus(int id, UpdateWorkerStatusDto dto)
        {
            try
            {
                var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
                if (staff == null)
                {
                    return NotFound(new { message = "Worker not found" });
                }

                staff.IsActive = dto.IsActive;
                staff.UpdatedAt = DateTime.UtcNow;

                if (!dto.IsActive)
                {
                    var assignedBookings = await _context.Bookings
                        .Where(b =>
                            b.AssignedWorkerId == staff.Id
                            && b.Status != BookingStatus.Completed
                            && b.Status != BookingStatus.Cancelled)
                        .ToListAsync();

                    foreach (var booking in assignedBookings)
                    {
                        booking.AssignedWorkerId = null;
                        booking.UpdatedAt = DateTime.UtcNow;
                        if (booking.Status == BookingStatus.Confirmed)
                        {
                            booking.Status = BookingStatus.Pending;
                        }
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(ToUserDtoFromStaff(staff));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker status error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update worker status" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("workers/{id}")]
        public async Task<ActionResult> DeleteWorker(int id)
        {
            try
            {
                var staff = await _context.Staff.FindAsync(id);

                if (staff == null)
                {
                    return NotFound(new { message = "Worker not found" });
                }

                var workerBookings = await _context.Bookings
                    .Where(b => b.AssignedWorkerId == id)
                    .ToListAsync();

                foreach (var booking in workerBookings)
                {
                    booking.AssignedWorkerId = null;
                }

                await _context.SaveChangesAsync();

                _context.Staff.Remove(staff);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Worker deleted successfully and their jobs have been unassigned" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Delete worker error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete worker" });
            }
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
        {
            try
            {
                // Check Users table (Admin/Customer) first
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email == dto.Email);

                if (user != null)
                {
                    var userVerification = _credentialVerifier.Verify(dto.Password, user.PasswordHash);
                    if (!userVerification.IsValid)
                        return Unauthorized(new { message = "Invalid email or password", reasonCode = "password_mismatch" });

                    if (userVerification.RequiresUpgrade && !string.IsNullOrWhiteSpace(userVerification.UpgradedHash))
                    {
                        user.PasswordHash = userVerification.UpgradedHash;
                        user.UpdatedAt = DateTime.UtcNow;
                    }

                    if (!user.IsActive)
                        return Unauthorized(new { message = "Account is disabled" });

                    if (!user.IsEmailVerified && !string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                        return StatusCode(403, new { message = "Please verify your email address before logging in.", requiresEmailVerification = true, email = user.Email });

                    var (accessToken, refreshToken) = await IssueTokensAsync(user);
                    SetRefreshTokenCookie(refreshToken);

                    return Ok(new AuthResponseDto
                    {
                        Token        = accessToken,
                        RefreshToken = refreshToken,
                        User         = ToUserDto(user)
                    });
                }

                // Check Staff table (Workers)
                var staff = await _context.Staff
                    .FirstOrDefaultAsync(s => s.Email == dto.Email);

                if (staff == null)
                    return Unauthorized(new { message = "Invalid email or password", reasonCode = "user_not_found" });

                var staffVerification = _credentialVerifier.Verify(dto.Password, staff.PasswordHash);
                if (!staffVerification.IsValid)
                    return Unauthorized(new { message = "Invalid email or password", reasonCode = "password_mismatch" });

                if (staffVerification.RequiresUpgrade && !string.IsNullOrWhiteSpace(staffVerification.UpgradedHash))
                {
                    staff.PasswordHash = staffVerification.UpgradedHash;
                    staff.UpdatedAt = DateTime.UtcNow;
                }

                if (!staff.IsActive)
                    return Unauthorized(new { message = "Account is disabled" });

                var (staffAccessToken, staffRefreshToken) = await IssueStaffTokensAsync(staff);
                SetRefreshTokenCookie(staffRefreshToken);

                return Ok(new AuthResponseDto
                {
                    Token        = staffAccessToken,
                    RefreshToken = staffRefreshToken,
                    User         = ToUserDtoFromStaff(staff)
                });
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
            var incomingToken = Request.Cookies["refreshToken"]
                             ?? dto?.RefreshToken;
            if (string.IsNullOrWhiteSpace(incomingToken))
                return Unauthorized(new { message = "No refresh token." });

            // Check Users table
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.RefreshToken == incomingToken);

            if (user != null)
            {
                if (user.RefreshTokenExpiry == null || user.RefreshTokenExpiry < DateTime.UtcNow)
                    return Unauthorized(new { message = "Refresh token expired or invalid." });

                var (accessToken, newRefreshToken) = await IssueTokensAsync(user);
                SetRefreshTokenCookie(newRefreshToken);
                return Ok(new { token = accessToken, refreshToken = newRefreshToken });
            }

            // Check Staff table
            var staff = await _context.Staff
                .FirstOrDefaultAsync(s => s.RefreshToken == incomingToken);

            if (staff == null || staff.RefreshTokenExpiry == null || staff.RefreshTokenExpiry < DateTime.UtcNow)
                return Unauthorized(new { message = "Refresh token expired or invalid." });

            var (staffAccessToken, newStaffRefreshToken) = await IssueStaffTokensAsync(staff);
            SetRefreshTokenCookie(newStaffRefreshToken);
            return Ok(new { token = staffAccessToken, refreshToken = newStaffRefreshToken });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var userId = User.GetCurrentUserId();
            if (IsWorkerRole())
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff != null)
                {
                    staff.RefreshToken = null;
                    staff.RefreshTokenExpiry = null;
                    staff.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }
            else
            {
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    user.RefreshToken       = null;
                    user.RefreshTokenExpiry = null;
                    user.UpdatedAt          = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            Response.Cookies.Delete("refreshToken", new CookieOptions { Path = "/" });
            return Ok(new { message = "Logged out." });
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> GetCurrentUser()
        {
            try
            {
                var userId = User.GetCurrentUserId();

                if (IsWorkerRole())
                {
                    var staff = await _context.Staff.FindAsync(userId);
                    if (staff == null) return NotFound(new { message = "User not found" });
                    return Ok(ToUserDtoFromStaff(staff));
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound(new { message = "User not found" });
                return Ok(ToUserDto(user));
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
                var userId = User.GetCurrentUserId();

                if (IsWorkerRole())
                {
                    var staff = await _context.Staff.FindAsync(userId);
                    if (staff == null) return NotFound(new { message = "User not found" });

                    staff.FirstName = dto.FirstName.Trim();
                    staff.LastName = dto.LastName.Trim();
                    if (!string.IsNullOrWhiteSpace(dto.Phone))
                        staff.Phone = dto.Phone.Trim();
                    staff.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl) ? null : dto.ProfileImageUrl.Trim();
                    staff.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Ok(ToUserDtoFromStaff(staff));
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound(new { message = "User not found" });

                var preferredAddressType = NormalizeAddressType(dto.PreferredAddressType);
                var homeAddress = string.IsNullOrWhiteSpace(dto.HomeAddress) ? null : dto.HomeAddress.Trim();
                var workAddress = string.IsNullOrWhiteSpace(dto.WorkAddress) ? null : dto.WorkAddress.Trim();
                var otherAddress = string.IsNullOrWhiteSpace(dto.OtherAddress) ? null : dto.OtherAddress.Trim();

                var preferredAddress = preferredAddressType switch
                {
                    "Work" => workAddress,
                    "Other" => otherAddress,
                    _ => homeAddress
                };

                var isAdminUser = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
                if (!isAdminUser && string.IsNullOrWhiteSpace(preferredAddress))
                {
                    if (!string.IsNullOrWhiteSpace(homeAddress))
                        preferredAddressType = "Home";
                    else if (!string.IsNullOrWhiteSpace(workAddress))
                        preferredAddressType = "Work";
                    else if (!string.IsNullOrWhiteSpace(otherAddress))
                        preferredAddressType = "Other";
                }

                user.FirstName = dto.FirstName.Trim();
                user.LastName = dto.LastName.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Phone))
                    user.Phone = dto.Phone.Trim();
                user.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl) ? null : dto.ProfileImageUrl.Trim();
                user.HomeAddress = homeAddress;
                user.WorkAddress = workAddress;
                user.OtherAddress = otherAddress;
                user.PreferredAddressType = preferredAddressType;
                user.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Ok(ToUserDto(user));
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
                var userId = User.GetCurrentUserId();

                var image = dto.Image ?? Request.Form?.Files?.FirstOrDefault();
                if (image == null || image.Length == 0)
                    return BadRequest(new { message = "Please select an image file." });

                if (image.Length > 5 * 1024 * 1024)
                    return BadRequest(new { message = "Image is too large. Maximum size is 5MB." });

                if (string.IsNullOrWhiteSpace(image.ContentType) || !image.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { message = "Only image files are allowed." });

                var extension = Path.GetExtension(image.FileName)?.ToLowerInvariant();
                var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
                if (string.IsNullOrWhiteSpace(extension) || !allowedExtensions.Contains(extension))
                    extension = ".jpg";

                var fileName = $"user-{userId}-{Guid.NewGuid():N}{extension}";
                var storedImage = await _objectStorage.UploadAsync(image, "profiles", fileName);

                if (IsWorkerRole())
                {
                    var staff = await _context.Staff.FindAsync(userId);
                    if (staff == null) return NotFound(new { message = "User not found" });

                    await DeleteOldProfileImageAsync(staff.ProfileImageUrl);
                    staff.ProfileImageUrl = storedImage.PublicUrl;
                    staff.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Ok(ToUserDtoFromStaff(staff));
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound(new { message = "User not found" });

                await DeleteOldProfileImageAsync(user.ProfileImageUrl);
                user.ProfileImageUrl = storedImage.PublicUrl;
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(ToUserDto(user));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Upload profile image error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to upload profile image" });
            }
        }

        private Task DeleteOldProfileImageAsync(string? profileImageUrl)
        {
            return _objectStorage.DeleteAsync(profileImageUrl);
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword(ChangePasswordDto dto)
        {
            try
            {
                if (dto.NewPassword != dto.ConfirmNewPassword)
                    return BadRequest(new { message = "New password and confirmation do not match" });

                var userId = User.GetCurrentUserId();

                if (IsWorkerRole())
                {
                    var staff = await _context.Staff.FindAsync(userId);
                    if (staff == null) return NotFound(new { message = "User not found" });

                    if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, staff.PasswordHash))
                        return BadRequest(new { message = "Current password is incorrect" });

                    if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, staff.PasswordHash))
                        return BadRequest(new { message = "New password must be different from your current password" });

                    staff.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
                    staff.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Ok(new { message = "Password updated successfully" });
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound(new { message = "User not found" });

                if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                    return BadRequest(new { message = "Current password is incorrect" });

                if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
                    return BadRequest(new { message = "New password must be different from your current password" });

                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Password updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Change password error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to change password" });
            }
        }

        [HttpGet("customers")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetCustomers()
        {
            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .OrderBy(u => u.FirstName)
                .Select(u => new {
                    id           = u.Id,
                    firstName    = u.FirstName,
                    lastName     = u.LastName,
                    email        = u.Email,
                    hasPushToken = !string.IsNullOrWhiteSpace(u.ExpoPushToken),
                })
                .ToListAsync();
            return Ok(customers);
        }

        [HttpPut("push-token")]
        [Authorize]
        public async Task<IActionResult> RegisterPushTokenAsync([FromBody] RegisterPushTokenDto dto)
        {
            var userId = User.GetCurrentUserId();

            if (string.IsNullOrWhiteSpace(dto.Token) || !dto.Token.StartsWith("ExponentPushToken"))
                return BadRequest(new { message = "Invalid Expo push token." });

            var token = dto.Token.Trim();

            if (IsWorkerRole())
            {
                // Clear from other staff
                var staleStaff = await _context.Staff
                    .Where(s => s.Id != userId && s.ExpoPushToken == token)
                    .ToListAsync();
                foreach (var stale in staleStaff)
                {
                    stale.ExpoPushToken = null;
                    stale.UpdatedAt = DateTime.UtcNow;
                }

                var staff = await _context.Staff.FindAsync(userId);
                if (staff == null) return NotFound();
                staff.ExpoPushToken = token;
                staff.UpdatedAt    = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Push token registered." });
            }

            // Clear from other users
            var staleUsers = await _context.Users
                .Where(u => u.Id != userId && u.ExpoPushToken == token)
                .ToListAsync();
            foreach (var stale in staleUsers)
            {
                stale.ExpoPushToken = null;
                stale.UpdatedAt = DateTime.UtcNow;
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            user.ExpoPushToken = token;
            user.UpdatedAt    = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Push token registered." });
        }

        [HttpDelete("push-token")]
        [Authorize]
        public async Task<IActionResult> ClearPushTokenAsync()
        {
            var userId = User.GetCurrentUserId();

            if (IsWorkerRole())
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff == null) return NotFound();
                staff.ExpoPushToken = null;
                staff.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Push token cleared." });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            user.ExpoPushToken = null;
            user.UpdatedAt     = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Push token cleared." });
        }

        // â”€â”€ Payroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/salary")]
        public async Task<ActionResult<UserDto>> UpdateWorkerSalary(int id, UpdateWorkerSalaryDto dto)
        {
            try
            {
                var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
                if (staff == null)
                    return NotFound(new { message = "Worker not found" });

                staff.MonthlySalary = dto.MonthlySalary;
                staff.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(ToUserDtoFromStaff(staff));
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
                var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Id == id);
                if (staff == null)
                    return NotFound(new { message = "Worker not found" });

                staff.IBAN = string.IsNullOrWhiteSpace(dto.IBAN) ? null : dto.IBAN.Trim();
                staff.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(ToUserDtoFromStaff(staff));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker IBAN error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update IBAN" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/payroll")]
        public async Task<ActionResult<List<WorkerPayrollSummaryDto>>> GetPayrollSummary(
            [FromQuery] int? month,
            [FromQuery] int? year)
        {
            try
            {
                var targetMonth = month ?? DateTime.UtcNow.Month;
                var targetYear  = year  ?? DateTime.UtcNow.Year;

                var periodStart = new DateTime(targetYear, targetMonth, 1, 0, 0, 0, DateTimeKind.Utc);
                var periodEnd   = periodStart.AddMonths(1);

                var workers = await _context.Staff
                    .Where(s => s.IsActive)
                    .ToListAsync();

                var completedBookings = await _context.Bookings
                    .Where(b => b.AssignedWorkerId != null
                             && b.Status == BookingStatus.Completed
                             && b.WorkCompletedAt >= periodStart
                             && b.WorkCompletedAt < periodEnd)
                    .Select(b => new { b.AssignedWorkerId, b.TotalAmount })
                    .ToListAsync();

                var summaries = workers.Select(w =>
                {
                    var jobs     = completedBookings.Where(b => b.AssignedWorkerId == w.Id).ToList();
                    var revenue  = jobs.Sum(b => b.TotalAmount);
                    var salary   = w.MonthlySalary ?? 0m;
                    var isPaid  = w.LastPaidMonth == targetMonth && w.LastPaidYear == targetYear;

                    return new WorkerPayrollSummaryDto
                    {
                        WorkerId        = w.Id,
                        WorkerName      = $"{w.FirstName} {w.LastName}",
                        MonthlySalary   = w.MonthlySalary,
                        Month           = targetMonth,
                        Year            = targetYear,
                        JobsCompleted   = jobs.Count,
                        TotalRevenue    = revenue,
                        EstimatedSalary = salary,
                        IsPaid         = isPaid,
                        PaidAt         = isPaid ? w.LastPaidAt : null,
                    };
                }).ToList();

                return Ok(summaries);
            }
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
                var staff = await _context.Staff.FindAsync(dto.WorkerId);
                if (staff == null)
                    return NotFound(new { message = "Worker not found" });

                staff.LastPaidMonth = dto.Month;
                staff.LastPaidYear = dto.Year;
                staff.LastPaidAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
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
            try
            {
                var currentMonth = DateTime.UtcNow.Month;
                var currentYear = DateTime.UtcNow.Year;

                var unpaidCount = await _context.Staff
                    .Where(s => s.IsActive && s.MonthlySalary != null)
                    .Where(s => !(s.LastPaidMonth == currentMonth && s.LastPaidYear == currentYear))
                    .CountAsync();

                return Ok(new { unpaidCount });
            }
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
            try
            {
                var currentMonth = DateTime.UtcNow.Month;
                var currentYear = DateTime.UtcNow.Year;
                var today = DateTime.UtcNow.Day;

                var unpaidWorkers = await _context.Staff
                    .Where(s => s.IsActive && s.MonthlySalary != null)
                    .Where(s => !(s.LastPaidMonth == currentMonth && s.LastPaidYear == currentYear))
                    .Select(s => new { s.FirstName, s.LastName, s.MonthlySalary })
                    .ToListAsync();

                if (unpaidWorkers.Count == 0)
                    return Ok(new { message = "All workers are paid", hasUnpaid = false });

                var dueDate = 25;
                if (today >= dueDate)
                {
                    var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Role == "Admin");
                    if (adminUser != null)
                    {
                        var totalDue = unpaidWorkers.Sum(w => w.MonthlySalary ?? 0);
                        var existingNotif = await _context.Notifications
                            .Where(n => n.AdminId == adminUser.Id && n.Type == NotificationType.PayrollDue && n.CreatedAt >= new DateTime(currentYear, currentMonth, 1))
                            .FirstOrDefaultAsync();

                        if (existingNotif == null)
                        {
                            var notification = new Notification
                            {
                                AdminId = adminUser.Id,
                                Type = NotificationType.PayrollDue,
                                Message = $"Payroll due: {unpaidWorkers.Count} worker(s) unpaid. Total: QAR {totalDue:N0}. Please process payments by end of month.",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.Notifications.Add(notification);
                            await _context.SaveChangesAsync();
                        }
                    }
                }

                return Ok(new {
                    hasUnpaid = true,
                    unpaidCount = unpaidWorkers.Count,
                    totalAmount = unpaidWorkers.Sum(w => w.MonthlySalary ?? 0)
                });
            }
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
            try
            {
                var keys = new[] { "payslip.companyName", "payslip.companyLogo", "payslip.companyAddress", "payslip.companyPhone", "payslip.companyEmail", "payslip.footerText" };
                var rows = await _context.SystemSettings
                    .Where(s => keys.Contains(s.Key))
                    .ToListAsync();

                var settings = new Dictionary<string, string?>();
                foreach (var key in keys)
                    settings[key] = rows.FirstOrDefault(r => r.Key == key)?.Value;

                return Ok(new
                {
                    companyName = settings["payslip.companyName"] ?? "Glanz",
                    companyLogo = settings["payslip.companyLogo"] ?? "",
                    companyAddress = settings["payslip.companyAddress"] ?? "",
                    companyPhone = settings["payslip.companyPhone"] ?? "",
                    companyEmail = settings["payslip.companyEmail"] ?? "",
                    footerText = settings["payslip.footerText"] ?? ""
                });
            }
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
                var updates = new List<(string Key, string Value)>();
                if (dto.CompanyName != null)
                    updates.Add(("payslip.companyName", dto.CompanyName.Trim()));
                if (dto.CompanyLogo != null)
                    updates.Add(("payslip.companyLogo", dto.CompanyLogo ?? ""));
                if (dto.CompanyAddress != null)
                    updates.Add(("payslip.companyAddress", dto.CompanyAddress.Trim()));
                if (dto.CompanyPhone != null)
                    updates.Add(("payslip.companyPhone", dto.CompanyPhone.Trim()));
                if (dto.CompanyEmail != null)
                    updates.Add(("payslip.companyEmail", dto.CompanyEmail.Trim()));
                if (dto.FooterText != null)
                    updates.Add(("payslip.footerText", dto.FooterText.Trim()));

                foreach (var (key, value) in updates)
                {
                    var existing = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
                    if (existing != null)
                    {
                        existing.Value = value;
                        existing.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.SystemSettings.Add(new SystemSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Settings updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update payslip settings error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update payslip settings" });
            }
        }

        // ── Email Verification & Password Reset ──────────────────────────────────

        [HttpPost("send-verification")]
        public async Task<IActionResult> SendVerification([FromBody] SendVerificationDto dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            // Return same response regardless to prevent email enumeration
            if (user != null && !user.IsEmailVerified)
            {
                var otp = GenerateNumericOtp();
                user.EmailVerificationToken       = BCrypt.Net.BCrypt.HashPassword(otp);
                user.EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24);
                user.UpdatedAt                    = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                try { await _emailService.SendEmailVerificationAsync(user.Email, user.FirstName, otp); }
                catch (Exception ex) { Console.WriteLine($"[Auth/SendVerification] Email send failed: {ex.Message}"); }
            }

            return Ok(new { message = "If that address is registered and unverified, a new code has been sent." });
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            if (user == null)
                return BadRequest(new { message = "Invalid verification code." });

            if (user.IsEmailVerified)
                return Ok(new { message = "Email already verified. Please log in." });

            if (user.EmailVerificationToken == null || user.EmailVerificationTokenExpiry < DateTime.UtcNow)
                return BadRequest(new { message = "Verification code has expired. Please request a new one." });

            if (!BCrypt.Net.BCrypt.Verify(dto.Token, user.EmailVerificationToken))
                return BadRequest(new { message = "Invalid verification code." });

            user.IsEmailVerified              = true;
            user.EmailVerificationToken       = null;
            user.EmailVerificationTokenExpiry = null;
            user.UpdatedAt                    = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email verified successfully. You can now log in." });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

            // Return same response regardless to prevent email enumeration
            if (user != null)
            {
                var token = GenerateSecureToken();
                user.PasswordResetToken       = BCrypt.Net.BCrypt.HashPassword(token);
                user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(6);
                user.UpdatedAt                = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:5173";
                var resetUrl    = $"{frontendUrl}/reset-password?token={Uri.EscapeDataString(token)}";

                try { await _emailService.SendPasswordResetAsync(user.Email, user.FirstName, resetUrl); }
                catch (Exception ex) { Console.WriteLine($"[Auth/ForgotPassword] Email send failed: {ex.Message}"); }
            }

            return Ok(new { message = "If that email address is registered, you will receive password reset instructions shortly." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (dto.NewPassword != dto.ConfirmNewPassword)
                return BadRequest(new { message = "Passwords do not match." });

            // Load only candidates with a non-expired token to limit BCrypt calls
            var candidates = await _context.Users
                .Where(u => u.PasswordResetToken != null && u.PasswordResetTokenExpiry > DateTime.UtcNow)
                .ToListAsync();

            var user = candidates.FirstOrDefault(u => BCrypt.Net.BCrypt.Verify(dto.Token, u.PasswordResetToken!));
            if (user == null)
                return BadRequest(new { message = "Invalid or expired reset token." });

            user.PasswordHash             = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.PasswordResetToken       = null;
            user.PasswordResetTokenExpiry = null;
            user.RefreshToken             = null; // Invalidate all existing sessions
            user.RefreshTokenExpiry       = null;
            user.UpdatedAt                = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successfully. Please log in with your new password." });
        }

        private static string GenerateNumericOtp()
        {
            var bytes = RandomNumberGenerator.GetBytes(4);
            var value = BitConverter.ToUInt32(bytes) % 1_000_000;
            return value.ToString("D6");
        }

        private static string GenerateSecureToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }
    }
}

