using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;

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
        private static readonly string[] DefaultAvatarUrls =
        {
            "/assets/avatars/default-gulf-male-1.svg",
            "/assets/avatars/default-gulf-male-2.svg",
            "/assets/avatars/default-gulf-female-1.svg",
            "/assets/avatars/default-gulf-female-2.svg",
            "/assets/avatars/default-expat-male-1.svg",
            "/assets/avatars/default-expat-female-1.svg"
        };

        public AuthController(AppDbContext context, ITokenService tokenService, IConfiguration configuration, IWebHostEnvironment env)
        {
            _context = context;
            _tokenService = tokenService;
            _configuration = configuration;
            _env = env;
        }

        private void SetRefreshTokenCookie(string refreshToken)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure   = !_env.IsDevelopment(),
                SameSite = SameSiteMode.Lax,
                Expires  = DateTimeOffset.UtcNow.AddDays(days),
                Path     = "/api/auth",
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

        private static readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

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
                    UpdatedAt = DateTime.UtcNow
                };

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

                var (accessToken, refreshToken) = await IssueTokensAsync(user);
                SetRefreshTokenCookie(refreshToken);

                return Ok(new AuthResponseDto
                {
                    Token        = accessToken,
                    RefreshToken = refreshToken,
                    User         = ToUserDto(user)
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
                    if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                        return Unauthorized(new { message = "Invalid email or password" });

                    if (!user.IsActive)
                        return Unauthorized(new { message = "Account is disabled" });

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

                if (staff == null || !BCrypt.Net.BCrypt.Verify(dto.Password, staff.PasswordHash))
                    return Unauthorized(new { message = "Invalid email or password" });

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
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var userId))
            {
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
            }

            Response.Cookies.Delete("refreshToken", new CookieOptions { Path = "/api/auth" });
            return Ok(new { message = "Logged out." });
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> GetCurrentUser()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

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

                var uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "profiles");
                Directory.CreateDirectory(uploadsRoot);

                var fileName = $"user-{userId}-{Guid.NewGuid():N}{extension}";
                var destinationPath = Path.Combine(uploadsRoot, fileName);

                await using (var stream = new FileStream(destinationPath, FileMode.Create))
                {
                    await image.CopyToAsync(stream);
                }

                if (IsWorkerRole())
                {
                    var staff = await _context.Staff.FindAsync(userId);
                    if (staff == null) return NotFound(new { message = "User not found" });

                    DeleteOldProfileImage(uploadsRoot, staff.ProfileImageUrl);
                    staff.ProfileImageUrl = $"/uploads/profiles/{fileName}";
                    staff.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Ok(ToUserDtoFromStaff(staff));
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound(new { message = "User not found" });

                DeleteOldProfileImage(uploadsRoot, user.ProfileImageUrl);
                user.ProfileImageUrl = $"/uploads/profiles/{fileName}";
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

        private static void DeleteOldProfileImage(string uploadsRoot, string? profileImageUrl)
        {
            if (!string.IsNullOrWhiteSpace(profileImageUrl)
                && profileImageUrl.StartsWith("/uploads/profiles/", StringComparison.OrdinalIgnoreCase))
            {
                var oldFileName = Path.GetFileName(profileImageUrl);
                var oldPath = Path.Combine(uploadsRoot, oldFileName);
                if (System.IO.File.Exists(oldPath))
                    System.IO.File.Delete(oldPath);
            }
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword(ChangePasswordDto dto)
        {
            try
            {
                if (dto.NewPassword != dto.ConfirmNewPassword)
                    return BadRequest(new { message = "New password and confirmation do not match" });

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

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
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

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
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized();

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
                if (!string.IsNullOrWhiteSpace(dto.CompanyName))
                    updates.Add(("payslip.companyName", dto.CompanyName));
                if (dto.CompanyLogo != null)
                    updates.Add(("payslip.companyLogo", dto.CompanyLogo ?? ""));
                if (!string.IsNullOrWhiteSpace(dto.CompanyAddress))
                    updates.Add(("payslip.companyAddress", dto.CompanyAddress));
                if (!string.IsNullOrWhiteSpace(dto.CompanyPhone))
                    updates.Add(("payslip.companyPhone", dto.CompanyPhone));
                if (!string.IsNullOrWhiteSpace(dto.CompanyEmail))
                    updates.Add(("payslip.companyEmail", dto.CompanyEmail));
                if (!string.IsNullOrWhiteSpace(dto.FooterText))
                    updates.Add(("payslip.footerText", dto.FooterText));

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
    }
}

