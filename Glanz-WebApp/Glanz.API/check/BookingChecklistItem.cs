using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class BookingChecklistItem
{
    public int Id { get; set; }

    public int BookingId { get; set; }

    public string Label { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletedAt { get; set; }

    public virtual Booking Booking { get; set; } = null!;
}
