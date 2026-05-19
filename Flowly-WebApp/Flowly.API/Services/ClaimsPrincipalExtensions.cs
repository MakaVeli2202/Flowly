using System.Security.Claims;

namespace Flowly.API.Services;

public static class ClaimsPrincipalExtensions
{
    public static int GetCurrentUserId(this ClaimsPrincipal user)
        => int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
