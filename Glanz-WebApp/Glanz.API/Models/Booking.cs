using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum BookingStatus
    {
        Pending,
        Confirmed,
        InProgress,
        Completed,
        Cancelled,
        Paused
    }

    public enum PaymentStatus
    {
        PreAuthorized,
        Paid,
        Failed,
        Refunded
    }

    public enum VehicleType
    {
        Motorcycle = 0,
        Sedan = 1,
        SUV = 2,
        Pickup = 3
    }

    public enum LeadSource
    {
        Direct = 0,           // Typed URL or direct
        GoogleSearch = 1,     // Google search results
        GoogleMaps = 2,      // Google Maps listing
        GoogleLSA = 3,      // Google Local Services Ads
        Facebook = 4,       // Facebook ad/post
        Instagram = 5,      // Instagram ad/story
        WhatsApp = 6,       // WhatsApp forward
        Referral = 7,        // Friend/family referral
        Returning = 8,       // Returning customer
        Other = 9            // Other source
    }

    public class Booking
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string BookingNumber { get; set; } = string.Empty;

        public int? UserId { get; set; }

        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        [StringLength(20)]
        public string TimeSlot { get; set; } = string.Empty;

        [Required]
        public BookingStatus Status { get; set; } = BookingStatus.Pending;

        [Required]
        public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.PreAuthorized;

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal TotalAmount { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal DiscountAmount { get; set; } = 0;

        [StringLength(80)]
        public string? AppliedOfferCode { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal EstimatedCost { get; set; } = 0;

        [Column(TypeName = "decimal(10,2)")]
        public decimal EstimatedProfit { get; set; } = 0;

        [Required]
        [StringLength(200)]
        public string CustomerName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string CustomerEmail { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string CustomerPhone { get; set; } = string.Empty;

        [StringLength(500)]
        public string? CustomerAddress { get; set; }

        [StringLength(100)]
        public string? HouseNumber { get; set; } // "53", "Villa 12", "Apt 5B", etc.

        [StringLength(50)]
        public string? AddressType { get; set; } // "Home" or "Work"

        [StringLength(100)]
        public string? VehicleMake { get; set; }

        [StringLength(100)]
        public string? VehicleModel { get; set; }

        [StringLength(4)]
        public string? VehicleYear { get; set; }

        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        public string? SpecialInstructions { get; set; }

        public LeadSource LeadSource { get; set; } = LeadSource.Direct;

        [StringLength(500)]
        public string? LeadSourceDetails { get; set; } // For UTMs, campaign names, etc.

        [StringLength(30)]
        public string? ReferralCode { get; set; } // Referral code used for this booking

        [StringLength(255)]
        public string? StripePaymentIntentId { get; set; }

        // Idempotency key sent by the mobile client to prevent duplicate bookings on network retry.
        // If a booking already exists with this key for this customer, the server returns it instead
        // of creating a new one. Null for admin-created bookings and older bookings.
        [StringLength(100)]
        public string? IdempotencyKey { get; set; }

        // Worker assignment
        public int? AssignedWorkerId { get; set; }

        // Work tracking for analytics
        public DateTime? WorkStartedAt { get; set; }
        public DateTime? WorkerArrivedAt { get; set; }
        public DateTime? WorkerOnMyWayAt { get; set; }
        public DateTime? WorkerRunningLateAt { get; set; }
        public DateTime? WorkCompletedAt { get; set; }
        public int? WorkDurationSeconds { get; set; }
        public DateTime? StockDeductedAt { get; set; }

        // Customer change requests (replaces direct cancel)
        public bool CancellationRequested { get; set; } = false;
        public string? CancellationRequestReason { get; set; }
        public DateTime? CancellationRequestedAt { get; set; }
        public bool RescheduleRequested { get; set; } = false;
        public string? RescheduleRequestNote { get; set; }
        public string? ReschedulePreferredDate { get; set; }
        public DateTime? RescheduleRequestedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [ForeignKey("AssignedWorkerId")]
        public Staff? AssignedWorker { get; set; }

        public ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();
        public ICollection<BookingChecklistItem> ChecklistItems { get; set; } = new List<BookingChecklistItem>();
    }
}