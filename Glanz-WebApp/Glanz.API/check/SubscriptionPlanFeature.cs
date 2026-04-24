using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SubscriptionPlanFeature
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public string FeatureText { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public virtual SubscriptionPlan Plan { get; set; } = null!;
}
