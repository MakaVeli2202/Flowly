using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class PackageService
{
    public int Id { get; set; }

    public int PackageId { get; set; }

    public int ServiceId { get; set; }

    public virtual Package Package { get; set; } = null!;

    public virtual Service Service { get; set; } = null!;
}
