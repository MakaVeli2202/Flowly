using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class UserSubscription
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int PlanId { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime NextBillingDate { get; set; }

    public int Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual SubscriptionPlan Plan { get; set; } = null!;

    public virtual ICollection<SubscriptionBooking> SubscriptionBookings { get; set; } = new List<SubscriptionBooking>();

    public virtual User User { get; set; } = null!;
}
