using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Phone]
        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(1000)]
        public string? ProfileImageUrl { get; set; }

        [StringLength(500)]
        public string? HomeAddress { get; set; }

        [StringLength(100)]
        public string? HomeHouseNumber { get; set; }

        [StringLength(500)]
        public string? WorkAddress { get; set; }

        [StringLength(100)]
        public string? WorkHouseNumber { get; set; }

        [StringLength(500)]
        public string? OtherAddress { get; set; }

        [StringLength(100)]
        public string? OtherHouseNumber { get; set; }

        [StringLength(20)]
        public string PreferredAddressType { get; set; } = "Home";

        [Required]
        [StringLength(20)]
        public string Role { get; set; } = "Customer";

        public bool IsActive { get; set; } = true;
        public DateTime? LoyaltyReviewPendingAt { get; set; }
        public DateTime? LoyaltyGoogleReviewActivatedAt { get; set; }

        [StringLength(500)]
        public string? LoyaltyReviewScreenshotUrl { get; set; }

        [StringLength(1000)]
        public string? Tags { get; set; }

        public string? Notes { get; set; }

        public decimal TotalSpent { get; set; }

        public DateTime? LastBookedDate { get; set; }

        public int TotalBookingsCount { get; set; }

        [StringLength(500)]
        public string? ExpoPushToken { get; set; }

        [StringLength(200)]
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiry { get; set; }

        // ── Email verification ────────────────────────────────────────────────
        // IsEmailVerified is false for new registrations; set true after OTP confirmation.
        // Existing users are grandfathered via the AddEmailVerification migration.
        public bool IsEmailVerified { get; set; } = false;

        [StringLength(200)]
        public string? EmailVerificationToken { get; set; }
        public DateTime? EmailVerificationTokenExpiry { get; set; }

        // ── Password reset ────────────────────────────────────────────────────
        [StringLength(200)]
        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetTokenExpiry { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Set when customer requests account deletion (GDPR right to erasure). Hard delete after 30 days.</summary>
        public DateTime? DeletionRequestedAt { get; set; }

        // Referral Program
        [StringLength(20)]
        public string? ReferralCode { get; set; } // Unique code like "AHMED8K2"

        public decimal ReferralPoints { get; set; } // Credits earned from referrals (1 point = 1 QAR)

        public int? ReferredByUserId { get; set; } // Who referred this user

        [ForeignKey(nameof(ReferredByUserId))]
        public User? ReferredByUser { get; set; }

        /// <summary>
        /// The date and time when the user completed their first wash/detail.
        /// Used to determine eligibility for referral program.
        /// </summary>
        public DateTime? FirstWashCompletedAt { get; set; }

        /// <summary>
        /// Whether this user has already used a referral code.
        /// Once used, they cannot use any other referral codes.
        /// </summary>
        public bool HasUsedReferralCode { get; set; }

        /// <summary>
        /// When true, this customer can select a preferred detailer during booking.
        /// Enabled per-user by admin (e.g. for VIP customers).
        /// </summary>
        public bool AllowPreferredWorker { get; set; } = false;

        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}
