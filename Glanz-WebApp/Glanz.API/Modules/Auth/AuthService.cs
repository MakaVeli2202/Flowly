using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Helpers;
using Glanz.API.Models;
using Glanz.API.Services;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using StaffEntity = Glanz.API.Models.Staff;

namespace Glanz.API.Modules.Auth
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly ITokenService _tokenService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
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

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        public AuthService(
            AppDbContext context,
            ITokenService tokenService,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ICredentialVerifier credentialVerifier,
            IObjectStorageService objectStorage,
            IEmailService emailService)
        {
            _context = context;
            _tokenService = tokenService;
            _configuration = configuration;
            _env = env;
            _credentialVerifier = credentialVerifier;
            _objectStorage = objectStorage;
            _emailService = emailService;
        }

        public async Task<(string accessToken, string refreshToken)> IssueTokensAsync(User user)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var accessToken  = _tokenService.GenerateToken(user);
            var refreshToken = _tokenService.GenerateRefreshToken();
            user.RefreshToken       = refreshToken;
            user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(days);
            user.UpdatedAt          = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (accessToken, refreshToken);
        }

        public async Task<(string accessToken, string refreshToken)> IssueStaffTokensAsync(StaffEntity staff)
        {
            var days = int.TryParse(_configuration["JwtSettings:RefreshExpirationDays"], out var d) ? d : 30;
            var accessToken  = _tokenService.GenerateToken(staff);
            var refreshToken = _tokenService.GenerateRefreshToken();
            staff.RefreshToken       = refreshToken;
            staff.RefreshTokenExpiry = DateTime.UtcNow.AddDays(days);
            staff.UpdatedAt          = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (accessToken, refreshToken);
        }

        public async Task<UserDto> ToUserDtoAsync(User user)
        {
            var preferredAddressType = NormalizeAddressType(user.PreferredAddressType);

            if (string.IsNullOrWhiteSpace(GetAddressByType(user, preferredAddressType)))
            {
                preferredAddressType = !string.IsNullOrWhiteSpace(user.HomeAddress) ? "Home"
                    : !string.IsNullOrWhiteSpace(user.WorkAddress) ? "Work"
                    : !string.IsNullOrWhiteSpace(user.OtherAddress) ? "Other"
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
                HomeHouseNumber = user.HomeHouseNumber,
                WorkAddress = user.WorkAddress,
                WorkHouseNumber = user.WorkHouseNumber,
                OtherAddress = user.OtherAddress,
                OtherHouseNumber = user.OtherHouseNumber,
                PreferredAddressType = preferredAddressType,
                ReferralCode = user.ReferralCode,
                HasUsedReferralCode = user.HasUsedReferralCode,
                ReferredByName = user.ReferredByUserId != null
                    ? await GetReferredByNameAsync(user.ReferredByUserId)
                    : null,
                Role = user.Role,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                FirstWashCompletedAt = user.FirstWashCompletedAt,
                TotalBookingsCount = user.TotalBookingsCount,
                AllowPreferredWorker = user.AllowPreferredWorker,
            };
        }

        public UserDto ToUserDtoFromStaff(StaffEntity staff, IEnumerable<StaffEntity>? allStaff = null)
        {
            string? driverName = null;
            if (staff.VanRole == "Helper" && staff.DriverId.HasValue && allStaff != null)
            {
                var driver = allStaff.FirstOrDefault(s => s.Id == staff.DriverId.Value);
                if (driver != null) driverName = $"{driver.FirstName} {driver.LastName}";
            }

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
                ShortCode = staff.ShortCode,
                CompensationType = staff.CompensationType,
                PercentageRate = staff.PercentageRate,
                Skills = string.IsNullOrWhiteSpace(staff.SkillsJson)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(staff.SkillsJson),
                MustChangePassword = staff.MustChangePassword,
                VanRole = staff.VanRole,
                DriverId = staff.DriverId,
                DriverName = driverName,
            };
        }

        public async Task<(AuthResponseDto? Result, string? Error, int StatusCode, bool RequiresEmailVerification, string? Email)> LoginAsync(LoginDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

            if (user != null)
            {
                var verification = _credentialVerifier.Verify(dto.Password, user.PasswordHash);
                if (!verification.IsValid)
                    return (null, "Invalid email or password", 401, false, null);

                if (verification.RequiresUpgrade && !string.IsNullOrWhiteSpace(verification.UpgradedHash))
                {
                    user.PasswordHash = verification.UpgradedHash;
                    user.UpdatedAt = DateTime.UtcNow;
                }

                if (!user.IsActive)
                    return (null, "Account is disabled", 401, false, null);

                if (!user.IsEmailVerified && !string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                    return (null, "Please verify your email address before logging in.", 403, true, user.Email);

                var (accessToken, refreshToken) = await IssueTokensAsync(user);
                return (new AuthResponseDto { Token = accessToken, RefreshToken = refreshToken, User = await ToUserDtoAsync(user) }, null, 200, false, null);
            }

            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.Email == dto.Email);
            if (staff == null)
                return (null, "Invalid email or password", 401, false, null);

            var staffVerification = _credentialVerifier.Verify(dto.Password, staff.PasswordHash);
            if (!staffVerification.IsValid)
                return (null, "Invalid email or password", 401, false, null);

            if (staffVerification.RequiresUpgrade && !string.IsNullOrWhiteSpace(staffVerification.UpgradedHash))
            {
                staff.PasswordHash = staffVerification.UpgradedHash;
                staff.UpdatedAt = DateTime.UtcNow;
            }

            if (!staff.IsActive)
                return (null, "Account is disabled", 401, false, null);

            var (staffAccessToken, staffRefreshToken) = await IssueStaffTokensAsync(staff);
            return (new AuthResponseDto { Token = staffAccessToken, RefreshToken = staffRefreshToken, User = ToUserDtoFromStaff(staff) }, null, 200, false, null);
        }

        public async Task<(string? Error, int StatusCode, bool RequiresEmailVerification, string? Email)> RegisterAsync(RegisterDto dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();
            if (await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
                return ("Email already registered", 400, false, null);

            var firstName = dto.FirstName?.Trim() ?? string.Empty;
            var lastName  = dto.LastName?.Trim()  ?? string.Empty;
            if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                return ("First name and last name are required", 400, false, null);

            var user = new User
            {
                FirstName        = firstName,
                LastName         = lastName,
                Email            = normalizedEmail,
                PasswordHash     = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Phone            = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
                ProfileImageUrl  = GetRandomDefaultAvatarUrl(),
                HomeAddress      = string.IsNullOrWhiteSpace(dto.HomeAddress) ? null : dto.HomeAddress.Trim(),
                PreferredAddressType = "Home",
                Role             = "Customer",
                IsActive         = true,
                CreatedAt        = DateTime.UtcNow,
                UpdatedAt        = DateTime.UtcNow,
            };

            if (!string.IsNullOrWhiteSpace(dto.ReferralCode))
            {
                var code     = dto.ReferralCode.Trim().ToUpperInvariant();
                var referrer = await _context.Users.FirstOrDefaultAsync(u => u.ReferralCode != null && u.ReferralCode.ToUpper() == code);
                if (referrer != null && referrer.Id != user.Id)
                {
                    user.ReferredByUserId   = referrer.Id;
                    user.HasUsedReferralCode = true;
                }
            }

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var bookingEmail    = user.Email.Trim().ToLowerInvariant();
            var existingBookings = await _context.Bookings
                .Where(b => b.CustomerEmail.ToLower() == bookingEmail && b.UserId != user.Id)
                .ToListAsync();

            foreach (var booking in existingBookings)
                booking.UserId = user.Id;

            if (existingBookings.Count > 0)
                await _context.SaveChangesAsync();

            var otp = GenerateNumericOtp();
            user.EmailVerificationToken       = BCrypt.Net.BCrypt.HashPassword(otp);
            user.EmailVerificationTokenExpiry = DateTime.UtcNow.AddHours(24);
            user.IsEmailVerified              = false;
            await _context.SaveChangesAsync();

            try { await _emailService.SendEmailVerificationAsync(user.Email, user.FirstName, otp); }
            catch (Exception ex) { Console.WriteLine($"[Auth/Register] Email send failed (non-fatal): {ex.Message}"); }

            return (null, 200, true, user.Email);
        }

        public async Task<(string accessToken, string refreshToken)?> RefreshTokenAsync(string incomingToken)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == incomingToken);
            if (user != null)
            {
                if (user.RefreshTokenExpiry == null || user.RefreshTokenExpiry < DateTime.UtcNow)
                    return null;
                return await IssueTokensAsync(user);
            }

            var staff = await _context.Staff.FirstOrDefaultAsync(s => s.RefreshToken == incomingToken);
            if (staff == null || staff.RefreshTokenExpiry == null || staff.RefreshTokenExpiry < DateTime.UtcNow)
                return null;

            return await IssueStaffTokensAsync(staff);
        }

        public async Task LogoutAsync(int userId, bool isWorker)
        {
            if (isWorker)
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff != null)
                {
                    staff.RefreshToken       = null;
                    staff.RefreshTokenExpiry = null;
                    staff.UpdatedAt          = DateTime.UtcNow;
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

        public async Task<(UserDto? Result, string? Error)> GetCurrentUserAsync(int userId, bool isWorker)
        {
            if (isWorker)
            {
                var staff = await _context.Staff.FindAsync(userId);
                return staff == null ? (null, "User not found") : (ToUserDtoFromStaff(staff), null);
            }
            var user = await _context.Users.FindAsync(userId);
            return user == null ? (null, "User not found") : (await ToUserDtoAsync(user), null);
        }

        public async Task<(UserDto? Result, string? Error)> UpdateProfileAsync(int userId, bool isWorker, UpdateProfileDto dto)
        {
            if (isWorker)
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff == null) return (null, "User not found");

                staff.FirstName     = dto.FirstName.Trim();
                staff.LastName      = dto.LastName.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Phone)) staff.Phone = dto.Phone.Trim();
                staff.ProfileImageUrl = string.IsNullOrWhiteSpace(dto.ProfileImageUrl) ? null : dto.ProfileImageUrl.Trim();
                staff.UpdatedAt     = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return (ToUserDtoFromStaff(staff), null);
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (null, "User not found");

            var preferredAddressType = NormalizeAddressType(dto.PreferredAddressType);
            var homeAddress  = string.IsNullOrWhiteSpace(dto.HomeAddress)  ? null : dto.HomeAddress.Trim();
            var workAddress  = string.IsNullOrWhiteSpace(dto.WorkAddress)  ? null : dto.WorkAddress.Trim();
            var otherAddress = string.IsNullOrWhiteSpace(dto.OtherAddress) ? null : dto.OtherAddress.Trim();

            var preferredAddress = preferredAddressType switch
            {
                "Work"  => workAddress,
                "Other" => otherAddress,
                _       => homeAddress
            };

            var isAdmin = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase);
            if (!isAdmin && string.IsNullOrWhiteSpace(preferredAddress))
            {
                if      (!string.IsNullOrWhiteSpace(homeAddress))  preferredAddressType = "Home";
                else if (!string.IsNullOrWhiteSpace(workAddress))  preferredAddressType = "Work";
                else if (!string.IsNullOrWhiteSpace(otherAddress)) preferredAddressType = "Other";
            }

            user.FirstName           = dto.FirstName.Trim();
            user.LastName            = dto.LastName.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Phone)) user.Phone = dto.Phone.Trim();
            user.ProfileImageUrl     = string.IsNullOrWhiteSpace(dto.ProfileImageUrl) ? null : dto.ProfileImageUrl.Trim();
            user.HomeAddress         = homeAddress;
            user.WorkAddress         = workAddress;
            user.OtherAddress        = otherAddress;
            user.PreferredAddressType = preferredAddressType;
            user.UpdatedAt           = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (await ToUserDtoAsync(user), null);
        }

        public async Task<(UserDto? Result, string? Error)> UploadProfileImageAsync(int userId, bool isWorker, IFormFile image)
        {
            var extension = Path.GetExtension(image.FileName)?.ToLowerInvariant();
            var allowed   = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
            if (string.IsNullOrWhiteSpace(extension) || !allowed.Contains(extension))
                extension = ".jpg";

            var fileName    = $"user-{userId}-{Guid.NewGuid():N}{extension}";
            var storedImage = await _objectStorage.UploadAsync(image, "profiles", fileName);

            if (isWorker)
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff == null) return (null, "User not found");
                await _objectStorage.DeleteAsync(staff.ProfileImageUrl);
                staff.ProfileImageUrl = storedImage.PublicUrl;
                staff.UpdatedAt       = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return (ToUserDtoFromStaff(staff), null);
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (null, "User not found");
            await _objectStorage.DeleteAsync(user.ProfileImageUrl);
            user.ProfileImageUrl = storedImage.PublicUrl;
            user.UpdatedAt       = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (await ToUserDtoAsync(user), null);
        }

        public async Task<(AuthResponseDto? Result, string? Error, int StatusCode)> ExternalLoginCallbackAsync(string? email, string? name)
        {
            if (string.IsNullOrWhiteSpace(email))
                return (null, "Email not provided by external provider", 400);

            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

            if (user == null)
            {
                var nameParts = (name ?? "Google User").Split(' ', 2);
                user = new User
                {
                    FirstName       = nameParts.Length > 0 ? nameParts[0] : "User",
                    LastName        = nameParts.Length > 1 ? nameParts[1] : "",
                    Email           = normalizedEmail,
                    PasswordHash    = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                    ProfileImageUrl = GetRandomDefaultAvatarUrl(),
                    Role            = "Customer",
                    IsActive        = true,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            if (!user.IsActive)
                return (null, "Account is disabled", 401);

            var (accessToken, refreshToken) = await IssueTokensAsync(user);
            return (new AuthResponseDto { Token = accessToken, RefreshToken = refreshToken, User = await ToUserDtoAsync(user) }, null, 200);
        }

        public async Task SendVerificationAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
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
        }

        public async Task<string?> VerifyEmailAsync(string email, string token)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user == null) return "Invalid verification code.";
            if (user.IsEmailVerified) return "ALREADY_VERIFIED";
            if (user.EmailVerificationToken == null || user.EmailVerificationTokenExpiry < DateTime.UtcNow)
                return "Verification code has expired. Please request a new one.";
            if (!BCrypt.Net.BCrypt.Verify(token, user.EmailVerificationToken))
                return "Invalid verification code.";

            user.IsEmailVerified              = true;
            user.EmailVerificationToken       = null;
            user.EmailVerificationTokenExpiry = null;
            user.UpdatedAt                    = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task ForgotPasswordAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
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
        }

        public async Task<string?> ResetPasswordAsync(string token, string newPassword)
        {
            var candidates = await _context.Users
                .Where(u => u.PasswordResetToken != null && u.PasswordResetTokenExpiry > DateTime.UtcNow)
                .ToListAsync();

            var user = candidates.FirstOrDefault(u => BCrypt.Net.BCrypt.Verify(token, u.PasswordResetToken!));
            if (user == null) return "Invalid or expired reset token.";

            user.PasswordHash             = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.PasswordResetToken       = null;
            user.PasswordResetTokenExpiry = null;
            user.RefreshToken             = null;
            user.RefreshTokenExpiry       = null;
            user.UpdatedAt                = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<(string token, string resetUrl)?> DevGenerateResetTokenAsync(string email, string frontendUrl)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
            if (user == null) return null;

            var token = GenerateSecureToken();
            user.PasswordResetToken       = BCrypt.Net.BCrypt.HashPassword(token);
            user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(6);
            user.UpdatedAt                = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var resetUrl = $"{frontendUrl}/reset-password?token={Uri.EscapeDataString(token)}";
            return (token, resetUrl);
        }

        public async Task RegisterPushTokenAsync(int userId, bool isWorker, string token)
        {
            if (isWorker)
            {
                var staleStaff = await _context.Staff
                    .Where(s => s.Id != userId && s.ExpoPushToken == token)
                    .ToListAsync();
                foreach (var stale in staleStaff) { stale.ExpoPushToken = null; stale.UpdatedAt = DateTime.UtcNow; }

                var staff = await _context.Staff.FindAsync(userId);
                if (staff != null) { staff.ExpoPushToken = token; staff.UpdatedAt = DateTime.UtcNow; }
            }
            else
            {
                var staleUsers = await _context.Users
                    .Where(u => u.Id != userId && u.ExpoPushToken == token)
                    .ToListAsync();
                foreach (var stale in staleUsers) { stale.ExpoPushToken = null; stale.UpdatedAt = DateTime.UtcNow; }

                var user = await _context.Users.FindAsync(userId);
                if (user != null) { user.ExpoPushToken = token; user.UpdatedAt = DateTime.UtcNow; }
            }
            await _context.SaveChangesAsync();
        }

        public async Task ClearPushTokenAsync(int userId, bool isWorker)
        {
            if (isWorker)
            {
                var staff = await _context.Staff.FindAsync(userId);
                if (staff != null) { staff.ExpoPushToken = null; staff.UpdatedAt = DateTime.UtcNow; }
            }
            else
            {
                var user = await _context.Users.FindAsync(userId);
                if (user != null) { user.ExpoPushToken = null; user.UpdatedAt = DateTime.UtcNow; }
            }
            await _context.SaveChangesAsync();
        }

        public async Task<IEnumerable<object>> GetCustomersAsync()
        {
            return await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .OrderBy(u => u.FirstName)
                .Select(u => new
                {
                    id           = u.Id,
                    firstName    = u.FirstName,
                    lastName     = u.LastName,
                    email        = u.Email,
                    hasPushToken = !string.IsNullOrWhiteSpace(u.ExpoPushToken),
                })
                .ToListAsync<object>();
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private static string GetRandomDefaultAvatarUrl() =>
            DefaultAvatarUrls[Random.Shared.Next(DefaultAvatarUrls.Length)];

        private static string NormalizeAddressType(string? addressType) =>
            addressType?.Trim().ToLowerInvariant() switch
            {
                "work"  => "Work",
                "other" => "Other",
                _       => "Home"
            };

        private static string? GetAddressByType(User user, string addressType) =>
            addressType switch
            {
                "Work"  => user.WorkAddress,
                "Other" => user.OtherAddress,
                _       => user.HomeAddress
            };

        private static List<WorkerDayScheduleEntry>? ParseDaySchedules(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<WorkerDayScheduleEntry>>(json, _jsonOpts); }
            catch { return null; }
        }

        private async Task<string?> GetReferredByNameAsync(int? referredByUserId)
        {
            if (referredByUserId == null) return null;
            var referrer = await _context.Users.FindAsync(referredByUserId.Value);
            return referrer != null ? $"{referrer.FirstName} {referrer.LastName}" : null;
        }

        private static string GenerateNumericOtp()
        {
            var bytes = RandomNumberGenerator.GetBytes(4);
            var value = BitConverter.ToUInt32(bytes) % 1_000_000;
            return value.ToString("D6");
        }

        private static string GenerateSecureToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
