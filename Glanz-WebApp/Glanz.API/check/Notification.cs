using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Notification
{
    public int Id { get; set; }

    public int? AdminId { get; set; }

    public int? UserId { get; set; }

    public int Type { get; set; }

    public int? BookingId { get; set; }

    public string Message { get; set; } = null!;

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User? Admin { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual User? User { get; set; }
}
