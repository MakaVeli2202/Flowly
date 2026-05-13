using System.Text.Json;

namespace Glanz.API.Services;

internal static class AppJsonOptions
{
    internal static readonly JsonSerializerOptions CaseInsensitive = new()
    {
        PropertyNameCaseInsensitive = true,
    };
}
