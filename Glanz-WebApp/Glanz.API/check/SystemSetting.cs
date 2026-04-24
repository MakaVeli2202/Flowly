using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class SystemSetting
{
    public string Key { get; set; } = null!;

    public string Value { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
