using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Glanz.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Phone]
        public string? Phone { get; set; }

        [StringLength(500)]
        public string? HomeAddress { get; set; }

        [StringLength(50)]
        public string? ReferralCode { get; set; }
    }

    public class CreateWorkerDto
    {
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [Phone]
        public string Phone { get; set; } = string.Empty;

        // "Detailer" | "Staff"
        [StringLength(50)]
        public string StaffType { get; set; } = "Detailer";

        [StringLength(100)]
        public string? IBAN { get; set; }
    }

    public class LoginDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        /// <summary>Returned so mobile clients can store it in AsyncStorage. Web uses the HttpOnly cookie instead.</summary>
        public string? RefreshToken { get; set; }
        public UserDto User { get; set; } = null!;
    }

    public class UserDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? HomeAddress { get; set; }
        public string? WorkAddress { get; set; }
        public string? OtherAddress { get; set; }
        public string PreferredAddressType { get; set; } = "Home";
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        /// <summary>
        /// The date and time when the user completed their first wash/detail.
        /// Used to determine eligibility for referral program.
        /// </summary>
        public DateTime? FirstWashCompletedAt { get; set; }
        /// <summary>
        /// Total completed bookings count - used to determine if referral code should be unlocked
        /// </summary>
        public int TotalBookingsCount { get; set; }
        // Worker schedule
        public string WorkingDays { get; set; } = "Monday,Tuesday,Wednesday,Thursday,Friday";
        public string ShiftStart { get; set; } = "09:00";
        public string ShiftEnd { get; set; } = "18:00";
        /// <summary>Per-day shift overrides; null means no overrides (use ShiftStart/ShiftEnd for all days).</summary>
        public List<WorkerDayScheduleEntry>? DaySchedules { get; set; }
        public decimal? MonthlySalary { get; set; }
        public string? IBAN { get; set; }
        public string? StaffType { get; set; }
    }

    /// <summary>Per-day shift override for a single day of week.</summary>
    public class WorkerDayScheduleEntry
    {
        /// <summary>Full day name, e.g. "Monday" or short "Mon".</summary>
        [Required]
        [StringLength(20)]
        public string Day { get; set; } = string.Empty;

        [Required]
        [StringLength(10)]
        public string ShiftStart { get; set; } = string.Empty;

        [Required]
        [StringLength(10)]
        public string ShiftEnd { get; set; } = string.Empty;
    }

    public class UpdateWorkerScheduleDto
    {
        [Required]
        [StringLength(200)]
        public string WorkingDays { get; set; } = string.Empty;

        [Required]
        [StringLength(10)]
        public string ShiftStart { get; set; } = string.Empty;

        [Required]
        [StringLength(10)]
        public string ShiftEnd { get; set; } = string.Empty;

        /// <summary>
        /// Optional per-day overrides. Only listed days have custom hours;
        /// other working days use the global ShiftStart/ShiftEnd above.
        /// Send an empty list (or omit) to clear all overrides.
        /// </summary>
        public List<WorkerDayScheduleEntry>? DaySchedules { get; set; }
    }

    public class UpdateWorkerStatusDto
    {
        [Required]
        public bool IsActive { get; set; }
    }

    public class UpdateWorkerSalaryDto
    {
        [Required]
        [Range(0, 999999.99)]
        public decimal MonthlySalary { get; set; }
    }

    public class UpdateWorkerIbanDto
    {
        [StringLength(100)]
        public string? IBAN { get; set; }
    }

    public class WorkerPayrollSummaryDto
    {
        public int WorkerId { get; set; }
        public string WorkerName { get; set; } = string.Empty;
        public decimal? MonthlySalary { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public int JobsCompleted { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal EstimatedSalary { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? PaidAt { get; set; }
    }

    public class MarkWorkerPaidDto
    {
        [Required]
        public int WorkerId { get; set; }
        [Required]
        public int Month { get; set; }
        [Required]
        public int Year { get; set; }
    }

    public class PaySlipSettingsDto
    {
        [StringLength(200)]
        public string? CompanyName { get; set; }
        [StringLength(500)]
        public string? CompanyLogo { get; set; }
        [StringLength(300)]
        public string? CompanyAddress { get; set; }
        [StringLength(50)]
        public string? CompanyPhone { get; set; }
        [StringLength(100)]
        public string? CompanyEmail { get; set; }
        [StringLength(500)]
        public string? FooterText { get; set; }
    }

    public class UpdateProfileDto
    {
        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        /// <summary>Optional for admin/worker accounts; required for customers.</summary>
        [Phone]
        public string? Phone { get; set; }

        [StringLength(1000)]
        public string? ProfileImageUrl { get; set; }

        [StringLength(500)]
        public string? HomeAddress { get; set; }

        [StringLength(500)]
        public string? WorkAddress { get; set; }

        [StringLength(500)]
        public string? OtherAddress { get; set; }

        [StringLength(20)]
        public string PreferredAddressType { get; set; } = "Home";
    }

    public class UploadProfileImageDto
    {
        [Required]
        public IFormFile Image { get; set; } = null!;
    }

    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string ConfirmNewPassword { get; set; } = string.Empty;
    }

    public class RegisterPushTokenDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;
    }

    public class SendTestNotificationDto
    {
        [Required]
        public int UserId { get; set; }
        [Required]
        public string Message { get; set; } = string.Empty;
    }

    public class RefreshTokenRequestDto
    {
        public string? RefreshToken { get; set; }
    }
}