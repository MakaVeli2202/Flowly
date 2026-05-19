using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class BookingRule
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string RuleType { get; set; } = string.Empty; // SlotDuration, BufferBetweenBookings, MaxBookingsPerSlot

        // JSON config: {"minutes":60}
        public string? ConfigJson { get; set; }

        public bool IsActive { get; set; } = true;

        public Organization Organization { get; set; } = null!;
    }

    public class AutomationRule
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string TriggerEvent { get; set; } = string.Empty; // BookingCompleted, CustomerInactive

        public int DelayMinutes { get; set; } = 0;

        [Required]
        [StringLength(100)]
        public string ActionType { get; set; } = string.Empty; // SendReviewRequest, SendReminderPush

        // JSON config for the action
        public string? ConfigJson { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;
    }
}
