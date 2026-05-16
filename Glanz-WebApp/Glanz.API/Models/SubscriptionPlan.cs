using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public enum SubscriptionBillingCycle
    {
        Monthly = 0,
        Quarterly = 1,
    }

    public enum UserSubscriptionStatus
    {
        Pending = 0,
        Active = 1,
        Cancelled = 2,
        Expired = 3,
    }

    public class SubscriptionPlan
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        [Required]
        public SubscriptionBillingCycle BillingCycle { get; set; } = SubscriptionBillingCycle.Monthly;

        [Column(TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal DiscountPercent { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public bool IsPopular { get; set; } = false;

        public int DisplayOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<SubscriptionPlanFeature> Features { get; set; } = new List<SubscriptionPlanFeature>();

        public ICollection<SubscriptionPlanBenefit> Benefits { get; set; } = new List<SubscriptionPlanBenefit>();

        public ICollection<UserSubscription> UserSubscriptions { get; set; } = new List<UserSubscription>();

        public ICollection<SubscriptionPlanPackage> PlanPackages { get; set; } = new List<SubscriptionPlanPackage>();
    }

    public class SubscriptionPlanFeature
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int PlanId { get; set; }

        [Required]
        [StringLength(200)]
        public string FeatureText { get; set; } = string.Empty;

        public int DisplayOrder { get; set; } = 0;

        [ForeignKey(nameof(PlanId))]
        public SubscriptionPlan Plan { get; set; } = null!;
    }

    public class SubscriptionPlanBenefit
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int PlanId { get; set; }

        [Required]
        [StringLength(200)]
        public string BenefitText { get; set; } = string.Empty;

        public int DisplayOrder { get; set; } = 0;

        [ForeignKey(nameof(PlanId))]
        public SubscriptionPlan Plan { get; set; } = null!;
    }

    public class UserSubscription
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int UserId { get; set; }

        public int PlanId { get; set; }

        [Required]
        public DateTime StartDate { get; set; } = DateTime.UtcNow;

        [Required]
        public DateTime NextBillingDate { get; set; } = DateTime.UtcNow;

        [Required]
        public UserSubscriptionStatus Status { get; set; } = UserSubscriptionStatus.Active;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        [ForeignKey(nameof(PlanId))]
        public SubscriptionPlan Plan { get; set; } = null!;

    }
}