using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class DomainEvent
    {
        [Key]
        public long Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string EventType { get; set; } = string.Empty; // BookingCreated, BookingCompleted, etc.

        [StringLength(50)]
        public string? EntityType { get; set; }

        public int? EntityId { get; set; }

        // JSON payload of the event
        public string? PayloadJson { get; set; }

        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public DateTime? ProcessedAt { get; set; }

        [StringLength(100)]
        public string? CorrelationId { get; set; }

        public Organization Organization { get; set; } = null!;
    }
}
