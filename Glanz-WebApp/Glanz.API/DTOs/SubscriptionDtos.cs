using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;

namespace Glanz.API.DTOs
{
    public class SubscriptionPlanPackageDto
    {
        public int Id { get; set; }
        public int PackageId { get; set; }
        public string PackageName { get; set; } = string.Empty;
        public decimal PackagePrice { get; set; }
        public int EstimatedDurationMinutes { get; set; }
        public string? Description { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class SubscriptionPlanFeatureDto
    {
        public int Id { get; set; }
        public string FeatureText { get; set; } = string.Empty;
        public int DisplayOrder { get; set; }
    }

    public class SubscriptionPlanBenefitDto
    {
        public int Id { get; set; }
        public string BenefitText { get; set; } = string.Empty;
        public int DisplayOrder { get; set; }
    }

    public class SubscriptionPlanDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
        public string VehicleIcon { get; set; } = "car-outline";
        public SubscriptionBillingCycle BillingCycle { get; set; } = SubscriptionBillingCycle.Monthly;
        public decimal Price { get; set; }
        public decimal DiscountPercent { get; set; }
        public bool IsActive { get; set; }
        public bool IsPopular { get; set; }
        public int DisplayOrder { get; set; }
        public int SubscriberCount { get; set; }
        public List<SubscriptionPlanPackageDto> PlanPackages { get; set; } = new();
        public List<SubscriptionPlanFeatureDto> Features { get; set; } = new();
        public List<SubscriptionPlanBenefitDto> Benefits { get; set; } = new();
    }

    public class UpsertSubscriptionPlanDto
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        [Required]
        public SubscriptionBillingCycle BillingCycle { get; set; } = SubscriptionBillingCycle.Monthly;

        [Range(0, 999999)]
        public decimal Price { get; set; }

        [Range(0, 100)]
        public decimal? DiscountPercent { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsPopular { get; set; } = false;

        public int DisplayOrder { get; set; } = 0;

        public List<string> Features { get; set; } = new();

        public List<string> Benefits { get; set; } = new();

        /// <summary>Ordered list of Package IDs that make up this plan.</summary>
        public List<int> PackageIds { get; set; } = new();
    }

    public class SubscribeToPlanDto
    {
        [Required]
        public int PlanId { get; set; }
    }

    public class CustomerSubscriptionDto
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
        public string VehicleIcon { get; set; } = "car-outline";
        public SubscriptionBillingCycle BillingCycle { get; set; } = SubscriptionBillingCycle.Monthly;
        public decimal Price { get; set; }
        public decimal DiscountPercent { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime NextBillingDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public List<SubscriptionPlanFeatureDto> Features { get; set; } = new();
        public List<SubscriptionPlanBenefitDto> Benefits { get; set; } = new();
        public List<SubscriptionPlanPackageDto> PlanPackages { get; set; } = new();
    }

    public class UserSubscriptionAdminDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerEmail { get; set; } = string.Empty;
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
        public SubscriptionBillingCycle BillingCycle { get; set; } = SubscriptionBillingCycle.Monthly;
        public decimal Price { get; set; }
        public decimal DiscountPercent { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime NextBillingDate { get; set; }
        public string Status { get; set; } = string.Empty;
    }
}
