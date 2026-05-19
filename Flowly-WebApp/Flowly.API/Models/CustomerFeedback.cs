using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class CustomerFeedback
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int? UserId { get; set; }

        public int? BookingId { get; set; }

        public int? WorkerId { get; set; }

        public FeedbackType Type { get; set; }

        public int Rating { get; set; }

        public string? Comment { get; set; }

        public bool IsAnonymous { get; set; }

        public bool IsResolved { get; set; }

        public string? ResolutionNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ResolvedAt { get; set; }

        public User? User { get; set; }

        public Booking? Booking { get; set; }

        public User? Worker { get; set; }
    }

    public enum FeedbackType
    {
        Review,
        Complaint,
        Suggestion,
        Compliment
    }
}