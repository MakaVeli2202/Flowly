using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SlotReservation
{
    public int Id { get; set; }

    public string PaymentIntentId { get; set; } = null!;

    public DateTime ScheduledDate { get; set; }

    public string TimeSlot { get; set; } = null!;

    public int DurationMinutes { get; set; }

    public string? CustomerEmail { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
