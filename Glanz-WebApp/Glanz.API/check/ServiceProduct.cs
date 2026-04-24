using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class ServiceProduct
{
    public int Id { get; set; }

    public int ServiceId { get; set; }

    public int ProductId { get; set; }

    public decimal QuantityUsed { get; set; }

    public virtual Product Product { get; set; } = null!;

    public virtual Service Service { get; set; } = null!;
}
