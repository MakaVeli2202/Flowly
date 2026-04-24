using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SubscriptionPlanBenefit
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public string BenefitText { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public virtual SubscriptionPlan Plan { get; set; } = null!;
}
