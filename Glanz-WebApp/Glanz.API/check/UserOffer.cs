using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class UserOffer
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int OfferId { get; set; }

    public string PersonalCode { get; set; } = null!;

    public int EarnedAtCompletedBookingsCount { get; set; }

    public bool IsRedeemed { get; set; }

    public DateTime? GoogleReviewActivatedAt { get; set; }

    public DateTime AssignedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime? RedeemedAt { get; set; }

    public virtual Offer Offer { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
