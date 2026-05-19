using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public enum LeadStatus
    {
        New = 0,
        Contacted = 1,
        Interested = 2,
        Booked = 3,
        Lost = 4,
        Junk = 5
    }

    public class Lead
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Phone]
        [StringLength(20)]
        public string Phone { get; set; } = string.Empty;

        [EmailAddress]
        [StringLength(255)]
        public string? Email { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        public LeadSource Source { get; set; } = LeadSource.Other;

        [StringLength(500)]
        public string? SourceDetails { get; set; } // Campaign name, ad ID, etc.

        public LeadStatus Status { get; set; } = LeadStatus.New;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastContactedAt { get; set; }

        public int? AssignedToUserId { get; set; }

        [ForeignKey(nameof(AssignedToUserId))]
        public User? AssignedToUser { get; set; }

        public int? ConvertedToBookingId { get; set; }

        [ForeignKey(nameof(ConvertedToBookingId))]
        public Booking? ConvertedToBooking { get; set; }

        [StringLength(100)]
        public string? PreferredService { get; set; }

        public string? UtmCampaign { get; set; }
        public string? UtmContent { get; set; }
        public string? UtmTerm { get; set; }
        public string? Gclid { get; set; } // Google Click ID
        public string? Fbclid { get; set; } // Facebook Click ID
        public string? FbLeadId { get; set; } // Facebook Lead ID (for lead ads)
    }
}