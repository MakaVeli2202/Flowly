using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Package
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public decimal Price { get; set; }

    public string Tier { get; set; } = null!;

    public int EstimatedDurationMinutes { get; set; }

    public string? ImageUrl { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<PackageService> PackageServices { get; set; } = new List<PackageService>();

    public virtual ICollection<ServiceSubscription> ServiceSubscriptions { get; set; } = new List<ServiceSubscription>();

    public virtual ICollection<SubscriptionBooking> SubscriptionBookings { get; set; } = new List<SubscriptionBooking>();

    public virtual ICollection<SubscriptionPlanPackage> SubscriptionPlanPackages { get; set; } = new List<SubscriptionPlanPackage>();
}
