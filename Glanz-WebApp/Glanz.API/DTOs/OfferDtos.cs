using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;

namespace Glanz.API.DTOs
{
    public class OfferDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? Description { get; set; }
        public DiscountType DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal MinBookingAmount { get; set; }
        public bool IsLoyaltyProgram { get; set; }
        public int? TriggerCompletedBookings { get; set; }
        public int CouponValidityDays { get; set; }
        public int? MaxUsesPerUser { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateOfferDto
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(60)]
        public string? Code { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        public DiscountType DiscountType { get; set; }

        [Range(0, 100000)]
        public decimal DiscountValue { get; set; }

        [Range(0, 100000)]
        public decimal MinBookingAmount { get; set; }

        public bool IsLoyaltyProgram { get; set; }

        [Range(0, 365)]
        public int? TriggerCompletedBookings { get; set; }

        [Range(1, 365)]
        public int CouponValidityDays { get; set; } = 90;

        [Range(1, 1000)]
        public int? MaxUsesPerUser { get; set; }

        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }

        public bool IsActive { get; set; } = true;
    }

    public class UpdateOfferDto
    {
        [StringLength(120)]
        public string? Name { get; set; }

        [StringLength(60)]
        public string? Code { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        public DiscountType? DiscountType { get; set; }

        [Range(0, 100000)]
        public decimal? DiscountValue { get; set; }

        [Range(0, 100000)]
        public decimal? MinBookingAmount { get; set; }

        public bool? IsLoyaltyProgram { get; set; }

        [Range(0, 365)]
        public int? TriggerCompletedBookings { get; set; }

        [Range(1, 365)]
        public int? CouponValidityDays { get; set; }

        [Range(1, 1000)]
        public int? MaxUsesPerUser { get; set; }

        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }

        public bool? IsActive { get; set; }
    }

    public class UserOfferDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public int OfferId { get; set; }
        public string OfferName { get; set; } = string.Empty;
        public string PersonalCode { get; set; } = string.Empty;
        public bool IsRedeemed { get; set; }
        public DateTime AssignedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime? RedeemedAt { get; set; }
        public int EarnedAtCompletedBookingsCount { get; set; }
        public bool RequiresGoogleReviewActivation { get; set; }
        public bool IsActivationLocked { get; set; }
        public DateTime? GoogleReviewActivatedAt { get; set; }
    }

    public class LoyaltyProgressDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        /// <summary>Total all-time completed bookings (for reference).</summary>
        public int CompletedBookingsCount { get; set; }
        /// <summary>Bookings completed after Google review was approved — this is what counts toward rewards.</summary>
        public int EligibleBookingsCount { get; set; }
        public int AvailableCouponsCount { get; set; }
        public DateTime MemberSince { get; set; }
        public bool IsActivated { get; set; }
        public DateTime? ActivatedAt { get; set; }
    }

    public class CustomerLoyaltyProgramProgressDto
    {
        public int OfferId { get; set; }
        public string ProgramName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int TriggerBookings { get; set; }
        public int CompletedBookings { get; set; }
        public int BookingsToNext { get; set; }
        public decimal ProgressPercent { get; set; }
    }

    public class BulkAssignDto
    {
        [Required]
        public List<int> UserIds { get; set; } = new();
    }

    public class CustomerLoyaltyDto
    {
        public int TotalCompletedBookings { get; set; }
        public int EligibleCompletedBookings { get; set; }
        public bool IsGoogleReviewPending { get; set; }
        public bool IsGoogleReviewActivated { get; set; }
        public DateTime? GoogleReviewActivatedAt { get; set; }
        public List<CustomerLoyaltyProgramProgressDto> Programs { get; set; } = new();
        public List<UserOfferDto> AvailableCoupons { get; set; } = new();
        public List<UserOfferDto> PendingActivationCoupons { get; set; } = new();
        public string GoogleReviewUrl { get; set; } = string.Empty;
    }

    public class PendingReviewDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public DateTime PendingAt { get; set; }
        public int CompletedBookings { get; set; }
        public string? ScreenshotUrl { get; set; }
    }
}
