using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum SubscriptionBookingStatus
    {
        Pending = 0,
        Confirmed = 1,
        InProgress = 2,
        Completed = 3,
        Cancelled = 4,
    }

    public class SubscriptionBooking
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(50)]
        public string BookingNumber { get; set; } = string.Empty;

        public int? UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        public int? UserSubscriptionId { get; set; }

        [ForeignKey("UserSubscriptionId")]
        public UserSubscription? UserSubscription { get; set; }

        public int? PackageId { get; set; }

        [ForeignKey("PackageId")]
        public Package? Package { get; set; }

        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        [StringLength(20)]
        public string TimeSlot { get; set; } = string.Empty;

        public SubscriptionBookingStatus Status { get; set; } = SubscriptionBookingStatus.Pending;

        [Column(TypeName = "decimal(10,2)")]
        public decimal OriginalAmount { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal DiscountAmount { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal FinalAmount { get; set; }

        public int? WorkerId { get; set; }

        [ForeignKey("WorkerId")]
        public Staff? Worker { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
