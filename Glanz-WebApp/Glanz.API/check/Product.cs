using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Product
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string Vendor { get; set; } = null!;

    public decimal CostPerUnit { get; set; }

    public string Unit { get; set; } = null!;

    public int StockQuantity { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<ServiceProduct> ServiceProducts { get; set; } = new List<ServiceProduct>();
}
