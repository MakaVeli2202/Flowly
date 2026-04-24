using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SubscriptionPlan
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public int VehicleType { get; set; }

    public int BillingCycle { get; set; }

    public decimal Price { get; set; }

    public decimal DiscountPercent { get; set; }

    public bool IsActive { get; set; }

    public bool IsPopular { get; set; }

    public int DisplayOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<SubscriptionPlanBenefit> SubscriptionPlanBenefits { get; set; } = new List<SubscriptionPlanBenefit>();

    public virtual ICollection<SubscriptionPlanFeature> SubscriptionPlanFeatures { get; set; } = new List<SubscriptionPlanFeature>();

    public virtual ICollection<SubscriptionPlanPackage> SubscriptionPlanPackages { get; set; } = new List<SubscriptionPlanPackage>();

    public virtual ICollection<UserSubscription> UserSubscriptions { get; set; } = new List<UserSubscription>();
}
