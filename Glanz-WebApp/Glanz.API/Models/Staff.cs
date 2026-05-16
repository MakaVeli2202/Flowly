using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class Staff
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Phone]
        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(1000)]
        public string? ProfileImageUrl { get; set; }

        [Required]
        [StringLength(20)]
        public string Role { get; set; } = "Employee";

        // "Detailer" | "Staff" â€” distinguishes role type within the staff table
        [StringLength(50)]
        public string StaffType { get; set; } = "Detailer";

        /// <summary>Unique 2–4 char admin-defined identifier, e.g. "MOMA". Must be unique across all Staff.</summary>
        [StringLength(10)]
        public string? ShortCode { get; set; }

        /// <summary>"Salary" or "Percentage"</summary>
        [StringLength(20)]
        public string CompensationType { get; set; } = "Salary";

        /// <summary>Percentage rate per completed job (0–100). Only used when CompensationType = "Percentage".</summary>
        [Column(TypeName = "decimal(5,2)")]
        public decimal? PercentageRate { get; set; }

        /// <summary>JSON array of skill names, e.g. ["Polish","Ceramic Coat","Interior"]</summary>
        public string? SkillsJson { get; set; }

        [StringLength(200)]
        public string WorkingDays { get; set; } = "Monday,Tuesday,Wednesday,Thursday,Friday";

        [StringLength(10)]
        public string ShiftStart { get; set; } = "09:00";

        [StringLength(10)]
        public string ShiftEnd { get; set; } = "18:00";

        public string? DaySchedulesJson { get; set; }

        public bool IsActive { get; set; } = true;

        /// <summary>Set to true when admin creates the account; cleared after first successful password change.</summary>
        public bool MustChangePassword { get; set; } = false;

        [Column(TypeName = "decimal(10,2)")]
        public decimal? MonthlySalary { get; set; }

        public int? LastPaidMonth { get; set; }
        public int? LastPaidYear { get; set; }
        public DateTime? LastPaidAt { get; set; }

        [StringLength(100)]
        public string? IBAN { get; set; }

        [StringLength(500)]
        public string? ExpoPushToken { get; set; }

        [StringLength(200)]
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiry { get; set; }

        /// <summary>"Driver" | "Helper" | null (no van role assigned)</summary>
        [StringLength(20)]
        public string? VanRole { get; set; }

        /// <summary>FK to Staff.Id of the Driver this helper is linked to. Only set when VanRole == "Helper".</summary>
        public int? DriverId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

