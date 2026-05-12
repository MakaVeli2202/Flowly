using System.Security.Claims;

namespace Glanz.API.Services;

public static class ClaimsPrincipalExtensions
{
    public static int GetCurrentUserId(this ClaimsPrincipal user)
        => int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
