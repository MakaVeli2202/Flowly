using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Vehicle
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string? Nickname { get; set; }

    public string? Make { get; set; }

    public string? Model { get; set; }

    public string? Year { get; set; }

    public string? Color { get; set; }

    public string? PlateNumber { get; set; }

    public int VehicleType { get; set; }

    public string? ImageUrl { get; set; }

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
