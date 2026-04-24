using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SubscriptionPlanPackage
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public int PackageId { get; set; }

    public int DisplayOrder { get; set; }

    public virtual Package Package { get; set; } = null!;

    public virtual SubscriptionPlan Plan { get; set; } = null!;
}
