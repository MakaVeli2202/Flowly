using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public enum RecurringFrequency
    {
        Weekly  = 0,
        Monthly = 1,
    }

    /// <summary>
    /// Defines a rule that auto-creates bookings on a schedule.
    /// A background job reads active rules and creates Booking rows ahead of time.
    /// </summary>
    public class RecurringBookingRule
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int UserId { get; set; }

        public RecurringFrequency Frequency { get; set; }

        /// <summary>0=Sun … 6=Sat. Used when Frequency=Weekly.</summary>
        public int? DayOfWeek { get; set; }

        /// <summary>1-28. Used when Frequency=Monthly.</summary>
        public int? DayOfMonth { get; set; }

        [Required]
        [StringLength(10)]
        public string PreferredTimeSlot { get; set; } = "09:00";

        /// <summary>JSON array of package IDs, e.g. [1,3]</summary>
        [Required]
        public string PackageIdsJson { get; set; } = "[]";

        public int? PreferredWorkerId { get; set; }

        [StringLength(20)]
        public string VehicleType { get; set; } = "Sedan";

        [StringLength(100)]
        public string? VehicleMake { get; set; }

        [StringLength(100)]
        public string? VehicleModel { get; set; }

        [StringLength(10)]
        public string? VehicleYear { get; set; }

        [StringLength(500)]
        public string? CustomerAddress { get; set; }

        /// <summary>Next date the background job should create a booking for this rule.</summary>
        public DateTime NextScheduledDate { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public User? User { get; set; }
    }

    public class WaitlistEntry
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int UserId { get; set; }

        public DateTime RequestedDate { get; set; }

        [StringLength(10)]
        public string? PreferredTimeSlot { get; set; }

        public int? PackageId { get; set; }

        [StringLength(50)]
        public string Status { get; set; } = "Waiting"; // Waiting | Notified | Booked | Expired

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public User? User { get; set; }
        public Package? Package { get; set; }
    }
}
