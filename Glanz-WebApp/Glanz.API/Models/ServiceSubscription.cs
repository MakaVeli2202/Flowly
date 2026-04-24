using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum SubscriptionFrequency
    {
        Weekly = 0,
        BiWeekly = 1,
        Monthly = 2,
    }

    public class ServiceSubscription
    {
        [Key]
        public int Id { get; set; }

        [StringLength(80)]
        public string Code { get; set; } = string.Empty;

        public int UserId { get; set; }

        public int PackageId { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        [Required]
        public SubscriptionFrequency Frequency { get; set; } = SubscriptionFrequency.Monthly;

        [Column(TypeName = "decimal(10,2)")]
        public decimal PricePerCycle { get; set; }

        // Discount percentage applied to each booking when this subscription is active.
        // E.g. 10 = 10% off. Defaults to 0 (no discount). Set by admin when creating the subscription.
        [Column(TypeName = "decimal(5,2)")]
        public decimal DiscountPercent { get; set; } = 0;

        [StringLength(500)]
        public string? Notes { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        [ForeignKey(nameof(PackageId))]
        public Package Package { get; set; } = null!;
    }
}