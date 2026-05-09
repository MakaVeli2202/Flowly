using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum ReferralStatus
    {
        Pending = 0,    // Referred user registered but hasn't booked
        Active = 1,     // Referred user has made at least one booking
        Rewarded = 2,   // Referral completed and referrer got reward
        Expired = 3    // Referral expired (e.g., no booking within 30 days)
    }

    public class Referral
    {
        [Key]
        public int Id { get; set; }

        public int ReferrerId { get; set; } // The user who referred

        [ForeignKey(nameof(ReferrerId))]
        public User Referrer { get; set; } = null!;

        public int ReferredUserId { get; set; } // The user who was referred

        [ForeignKey(nameof(ReferredUserId))]
        public User ReferredUser { get; set; } = null!;

        public ReferralStatus Status { get; set; } = ReferralStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? FirstBookingAt { get; set; } // When referred user made first booking

        public int? RewardedBookingId { get; set; } // The booking that triggered reward

        public decimal RewardAmount { get; set; } // Amount credited to referrer (e.g., 50 QAR)

        public DateTime? RewardedAt { get; set; }
    }
}