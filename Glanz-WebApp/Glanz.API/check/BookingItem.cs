using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class BookingItem
{
    public int Id { get; set; }

    public int BookingId { get; set; }

    public int PackageId { get; set; }

    public decimal Price { get; set; }

    public int Quantity { get; set; }

    public int SnapshotDurationMinutes { get; set; }

    public decimal ItemCost { get; set; }

    public virtual Booking Booking { get; set; } = null!;

    public virtual Package Package { get; set; } = null!;
}
