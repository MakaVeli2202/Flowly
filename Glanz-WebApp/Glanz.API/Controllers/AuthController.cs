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

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ITokenService _tokenService;
        private readonly IConfiguration _configuration;
        private static readonly string[] DefaultAvatarUrls =
        {
            "/assets/avatars/default-gulf-male-1.svg",
            "/assets/avatars/default-gulf-male-2.svg",
            "/assets/avatars/default-gulf-female-1.svg",
            "/assets/avatars/default-gulf-female-2.svg",
            "/assets/avatars/default-expat-male-1.svg",
            "/assets/avatars/default-expat-female-1.svg"
        };

        public AuthController(AppDbContext context, ITokenService tokenService, IConfiguration configuration)
        {
            _context = context;
            _tokenService = tokenService;
            _configuration = configuration;
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
                WorkingDays = user.WorkingDays,
                ShiftStart = user.ShiftStart,
                ShiftEnd = user.ShiftEnd,
                DaySchedules = ParseDaySchedules(user.DaySchedulesJson),
                MonthlySalary = user.MonthlySalary
            };
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

                var token = _tokenService.GenerateToken(user);

                return Ok(new AuthResponseDto
                {
                    Token = token,
                    User = ToUserDto(user)
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
                if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
                {
                    return BadRequest(new { message = "Email already registered" });
                }

                var worker = new User
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    Phone = dto.Phone,
                    ProfileImageUrl = GetRandomDefaultAvatarUrl(),
                    Role = "Worker",
                    IsActive = true,
                    WorkingDays = _configuration["BusinessSettings:DefaultWorkerWorkingDays"]
                        ?? "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    ShiftStart = _configuration["BusinessSettings:DefaultWorkerShiftStart"] ?? "08:00",
                    ShiftEnd   = _configuration["BusinessSettings:DefaultWorkerShiftEnd"]   ?? "17:00",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Users.Add(worker);
                await _context.SaveChangesAsync();

                return Ok(ToUserDto(worker));
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
                var workers = await _context.Users
                    .Where(u => u.Role == "Worker")
                    .OrderBy(u => u.FirstName)
                    .ThenBy(u => u.LastName)
                    .ToListAsync();

                return Ok(workers.Select(ToUserDto));
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
                var worker = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == "Worker");
                if (worker == null)
                    return NotFound(new { message = "Worker not found" });

                worker.WorkingDays = dto.WorkingDays.Trim();
                worker.ShiftStart = dto.ShiftStart.Trim();
                worker.ShiftEnd = dto.ShiftEnd.Trim();
                // Persist per-day overrides (null list = clear all overrides)
                worker.DaySchedulesJson = (dto.DaySchedules != null && dto.DaySchedules.Count > 0)
                    ? JsonSerializer.Serialize(dto.DaySchedules)
                    : null;
                worker.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(ToUserDto(worker));
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
                var worker = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == "Worker");
                if (worker == null)
                {
                    return NotFound(new { message = "Worker not found" });
                }

                worker.IsActive = dto.IsActive;
                worker.UpdatedAt = DateTime.UtcNow;

                if (!dto.IsActive)
                {
                    var assignedBookings = await _context.Bookings
                        .Where(b =>
                            b.AssignedWorkerId == worker.Id
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

                return Ok(ToUserDto(worker));
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
                var worker = await _context.Users.FindAsync(id);

                if (worker == null)
                {
                    return NotFound(new { message = "Worker not found" });
                }

                if (worker.Role != "Worker")
                {
                    return BadRequest(new { message = "Can only delete workers" });
                }

                // Unassign all bookings from this worker
                var workerBookings = await _context.Bookings
                    .Where(b => b.AssignedWorkerId == id)
                    .ToListAsync();

                foreach (var booking in workerBookings)
                {
                    booking.AssignedWorkerId = null;
                }

                await _context.SaveChangesAsync();

                // Now delete the worker
                _context.Users.Remove(worker);
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
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email == dto.Email);

                if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                if (!user.IsActive)
                {
                    return Unauthorized(new { message = "Account is disabled" });
                }

                var token = _tokenService.GenerateToken(user);

                return Ok(new AuthResponseDto
                {
                    Token = token,
                    User = ToUserDto(user)
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login error: {ex.Message}");
                return StatusCode(500, new { message = "Login failed" });
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> GetCurrentUser()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var user = await _context.Users.FindAsync(userId);

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

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
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var user = await _context.Users.FindAsync(userId);

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

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

                // Workers and admins are not required to maintain booking addresses.
                var isWorker = string.Equals(user.Role, "Worker", StringComparison.OrdinalIgnoreCase);
                var isAdminUser = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
                if (!isWorker && !isAdminUser && string.IsNullOrWhiteSpace(preferredAddress))
                {
                    // If user picked an empty default bucket, auto-select the first available address.
                    // If they have no addresses at all (e.g. updating just avatar), keep "Home" as default — no error.
                    if (!string.IsNullOrWhiteSpace(homeAddress))
                        preferredAddressType = "Home";
                    else if (!string.IsNullOrWhiteSpace(workAddress))
                        preferredAddressType = "Work";
                    else if (!string.IsNullOrWhiteSpace(otherAddress))
                        preferredAddressType = "Other";
                    // else: no addresses yet — that's fine; stays as whatever was passed (defaults to "Home")
                }

                user.FirstName = dto.FirstName.Trim();
                user.LastName = dto.LastName.Trim();
                // Phone is optional for admin/worker — keep existing value if not provided
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
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var user = await _context.Users.FindAsync(userId);

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                var image = dto.Image ?? Request.Form?.Files?.FirstOrDefault();
                if (image == null || image.Length == 0)
                {
                    return BadRequest(new { message = "Please select an image file." });
                }

                if (image.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { message = "Image is too large. Maximum size is 5MB." });
                }

                if (string.IsNullOrWhiteSpace(image.ContentType) || !image.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { message = "Only image files are allowed." });
                }

                var extension = Path.GetExtension(image.FileName)?.ToLowerInvariant();
                var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
                if (string.IsNullOrWhiteSpace(extension) || !allowedExtensions.Contains(extension))
                {
                    extension = ".jpg";
                }

                var uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "profiles");
                Directory.CreateDirectory(uploadsRoot);

                var fileName = $"user-{user.Id}-{Guid.NewGuid():N}{extension}";
                var destinationPath = Path.Combine(uploadsRoot, fileName);

                await using (var stream = new FileStream(destinationPath, FileMode.Create))
                {
                    await image.CopyToAsync(stream);
                }

                if (!string.IsNullOrWhiteSpace(user.ProfileImageUrl)
                    && user.ProfileImageUrl.StartsWith("/uploads/profiles/", StringComparison.OrdinalIgnoreCase))
                {
                    var oldFileName = Path.GetFileName(user.ProfileImageUrl);
                    var oldPath = Path.Combine(uploadsRoot, oldFileName);
                    if (System.IO.File.Exists(oldPath))
                    {
                        System.IO.File.Delete(oldPath);
                    }
                }

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

        [Authorize]
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword(ChangePasswordDto dto)
        {
            try
            {
                if (dto.NewPassword != dto.ConfirmNewPassword)
                {
                    return BadRequest(new { message = "New password and confirmation do not match" });
                }

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var user = await _context.Users.FindAsync(userId);

                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                {
                    return BadRequest(new { message = "Current password is incorrect" });
                }

                if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
                {
                    return BadRequest(new { message = "New password must be different from your current password" });
                }

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

            // Clear this token from any other user — one device = one user
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

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.ExpoPushToken = null;
            user.UpdatedAt     = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Push token cleared." });
        }

        // ── Payroll ─────────────────────────────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPut("workers/{id}/salary")]
        public async Task<ActionResult<UserDto>> UpdateWorkerSalary(int id, UpdateWorkerSalaryDto dto)
        {
            try
            {
                var worker = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == "Worker");
                if (worker == null)
                    return NotFound(new { message = "Worker not found" });

                worker.MonthlySalary = dto.MonthlySalary;
                worker.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(ToUserDto(worker));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update worker salary error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update salary" });
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

                var workers = await _context.Users
                    .Where(u => u.Role == "Worker" && u.IsActive)
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
                var worker = await _context.Users.FindAsync(dto.WorkerId);
                if (worker == null || worker.Role != "Worker")
                    return NotFound(new { message = "Worker not found" });

                worker.LastPaidMonth = dto.Month;
                worker.LastPaidYear = dto.Year;
                worker.LastPaidAt = DateTime.UtcNow;

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

                var unpaidCount = await _context.Users
                    .Where(u => u.Role == "Worker" && u.IsActive && u.MonthlySalary != null)
                    .Where(u => !(u.LastPaidMonth == currentMonth && u.LastPaidYear == currentYear))
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

                var unpaidWorkers = await _context.Users
                    .Where(u => u.Role == "Worker" && u.IsActive && u.MonthlySalary != null)
                    .Where(u => !(u.LastPaidMonth == currentMonth && u.LastPaidYear == currentYear))
                    .Select(u => new { u.FirstName, u.LastName, u.MonthlySalary })
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