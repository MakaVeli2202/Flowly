using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Availability
{
    public int Id { get; set; }

    public DateTime Date { get; set; }

    public string TimeSlot { get; set; } = null!;

    public int MaxBookings { get; set; }

    public int CurrentBookings { get; set; }

    public bool IsAvailable { get; set; }
}
