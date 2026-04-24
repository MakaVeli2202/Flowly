using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

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

        [StringLength(500)]
        public string? HomeAddress { get; set; }

        [StringLength(100)]
        public string? HomeHouseNumber { get; set; }

        [StringLength(500)]
        public string? WorkAddress { get; set; }

        [StringLength(100)]
        public string? WorkHouseNumber { get; set; }

        [StringLength(500)]
        public string? OtherAddress { get; set; }

        [StringLength(100)]
        public string? OtherHouseNumber { get; set; }

        [StringLength(20)]
        public string PreferredAddressType { get; set; } = "Home";

        [Required]
        [StringLength(20)]
        public string Role { get; set; } = "Customer"; // Customer, Admin, or Worker

        // Worker schedule fields
        [StringLength(200)]
        public string WorkingDays { get; set; } = "Monday,Tuesday,Wednesday,Thursday,Friday";

        [StringLength(10)]
        public string ShiftStart { get; set; } = "09:00";

        [StringLength(10)]
        public string ShiftEnd { get; set; } = "18:00";

        /// <summary>
        /// Optional JSON array of per-day shift overrides, e.g.
        /// [{"day":"Friday","start":"09:00","end":"13:00"}].
        /// Days not listed fall back to ShiftStart/ShiftEnd.
        /// </summary>
        public string? DaySchedulesJson { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime? LoyaltyGoogleReviewActivatedAt { get; set; }

        // Payroll — workers only
        [Column(TypeName = "decimal(10,2)")]
        public decimal? MonthlySalary { get; set; }

        // Payroll payment tracking
        public int? LastPaidMonth { get; set; }
        public int? LastPaidYear { get; set; }
        public DateTime? LastPaidAt { get; set; }

        // Expo push notification token (set by mobile app on login)
        [StringLength(500)]
        public string? ExpoPushToken { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}