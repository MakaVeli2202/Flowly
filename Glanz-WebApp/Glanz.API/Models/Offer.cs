using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public enum DiscountType
    {
        Percentage,
        FixedAmount,
        FreeBooking
    }

    public class Offer
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(60)]
        public string? Code { get; set; }

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        public DiscountType DiscountType { get; set; } = DiscountType.Percentage;

        [Range(0, 100000)]
        public decimal DiscountValue { get; set; } = 0;

        [Range(0, 100000)]
        public decimal MinBookingAmount { get; set; } = 0;

        public bool IsLoyaltyProgram { get; set; } = false;

        [Range(0, 365)]
        public int? TriggerCompletedBookings { get; set; }

        [Range(0, 365)]
        public int CouponValidityDays { get; set; } = 90;

        [Range(0, 1000)]
        public int? MaxUsesPerUser { get; set; }

        public DateTime? StartsAt { get; set; }
        public DateTime? EndsAt { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<UserOffer> UserOffers { get; set; } = new List<UserOffer>();
    }
}
