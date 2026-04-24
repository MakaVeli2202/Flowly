using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Offer
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Code { get; set; }

    public string? Description { get; set; }

    public int DiscountType { get; set; }

    public decimal DiscountValue { get; set; }

    public decimal MinBookingAmount { get; set; }

    public bool IsLoyaltyProgram { get; set; }

    public int? TriggerCompletedBookings { get; set; }

    public int CouponValidityDays { get; set; }

    public int? MaxUsesPerUser { get; set; }

    public DateTime? StartsAt { get; set; }

    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<UserOffer> UserOffers { get; set; } = new List<UserOffer>();
}
