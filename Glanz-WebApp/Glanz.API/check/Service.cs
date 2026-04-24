using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Service
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int DefaultDurationMinutes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<PackageService> PackageServices { get; set; } = new List<PackageService>();

    public virtual ICollection<ServiceProduct> ServiceProducts { get; set; } = new List<ServiceProduct>();
}
