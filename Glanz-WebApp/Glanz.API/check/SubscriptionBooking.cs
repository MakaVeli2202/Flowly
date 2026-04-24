using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SubscriptionBooking
{
    public int Id { get; set; }

    public string BookingNumber { get; set; } = null!;

    public int? UserId { get; set; }

    public int? UserSubscriptionId { get; set; }

    public int? PackageId { get; set; }

    public DateTime ScheduledDate { get; set; }

    public string TimeSlot { get; set; } = null!;

    public int Status { get; set; }

    public decimal OriginalAmount { get; set; }

    public decimal DiscountAmount { get; set; }

    public decimal FinalAmount { get; set; }

    public int? WorkerId { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Package? Package { get; set; }

    public virtual User? User { get; set; }

    public virtual UserSubscription? UserSubscription { get; set; }

    public virtual User? Worker { get; set; }
}
