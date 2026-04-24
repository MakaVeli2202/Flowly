using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class UserOffer
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public int OfferId { get; set; }

        [Required]
        [StringLength(80)]
        public string PersonalCode { get; set; } = string.Empty;

        [Range(0, 10000)]
        public int EarnedAtCompletedBookingsCount { get; set; }

        public bool IsRedeemed { get; set; } = false;
        public DateTime? GoogleReviewActivatedAt { get; set; }

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiresAt { get; set; }
        public DateTime? RedeemedAt { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [ForeignKey("OfferId")]
        public Offer Offer { get; set; } = null!;
    }
}
