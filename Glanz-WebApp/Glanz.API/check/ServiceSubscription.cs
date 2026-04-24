using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class ServiceSubscription
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public int UserId { get; set; }

    public int PackageId { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public int Frequency { get; set; }

    public decimal PricePerCycle { get; set; }

    public decimal DiscountPercent { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Package Package { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
