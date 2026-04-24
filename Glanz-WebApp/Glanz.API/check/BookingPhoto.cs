using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class BookingPhoto
{
    public int Id { get; set; }

    public int BookingId { get; set; }

    public int PhotoType { get; set; }

    public string ImageUrl { get; set; } = null!;

    public string? Caption { get; set; }

    public int? UploadedByWorkerId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Booking Booking { get; set; } = null!;

    public virtual User? UploadedByWorker { get; set; }
}
