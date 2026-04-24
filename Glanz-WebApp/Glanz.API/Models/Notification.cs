using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum NotificationType
    {
        NewBooking = 0,
        BookingStatusChanged = 1,
        BookingAssigned = 2,
        BookingReassigned = 3,
        BookingCancelled = 4,
        LowStock = 5,
        JobStarted = 6,
        WorkerArrived = 7,
        WorkerRunningLate = 8,
        JobCompleted = 9,
        JobPaused = 10,
        SpecialOffer = 11,
        LoyaltyReward = 12,
        JobResumed = 13,
        ServiceAdded = 14,
        PayrollDue = 15
    }

    public class Notification
    {
        [Key]
        public int Id { get; set; }

        public int? AdminId { get; set; }

        public int? UserId { get; set; }

        [Required]
        public NotificationType Type { get; set; }

        public int? BookingId { get; set; }

        [StringLength(500)]
        public string Message { get; set; } = string.Empty;

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("AdminId")]
        public User? Admin { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [ForeignKey("BookingId")]
        public Booking? Booking { get; set; }
    }
}
