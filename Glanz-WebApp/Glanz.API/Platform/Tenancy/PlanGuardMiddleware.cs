using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;

namespace Glanz.API.Platform.Tenancy
{
    /// <summary>
    /// Blocks requests that would exceed the org's plan limits.
    /// Runs after TenantMiddleware so TenantContext.OrgId is available.
    /// Only enforces on POST /api/Bookings (booking creation) for now.
    /// </summary>
    public class PlanGuardMiddleware
    {
        private readonly RequestDelegate _next;

        public PlanGuardMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext ctx, TenantContext tenant, AppDbContext db)
        {
            if (tenant.OrgId > 0 && IsBookingCreation(ctx))
            {
                var exceeded = await IsBookingQuotaExceededAsync(tenant.OrgId, db);
                if (exceeded)
                {
                    ctx.Response.StatusCode = 429;
                    ctx.Response.ContentType = "application/json";
                    await ctx.Response.WriteAsync("{\"message\":\"Monthly booking quota exceeded for your plan.\"}");
                    return;
                }
            }

            await _next(ctx);
        }

        private static bool IsBookingCreation(HttpContext ctx) =>
            ctx.Request.Method == HttpMethods.Post &&
            ctx.Request.Path.StartsWithSegments("/api/Bookings", StringComparison.OrdinalIgnoreCase) &&
            ctx.Request.Path.Value?.Split('/').Length == 3; // /api/Bookings only

        private static async Task<bool> IsBookingQuotaExceededAsync(int orgId, AppDbContext db)
        {
            var now = DateTime.UtcNow;

            // Get org's plan limit
            var sub = await db.OrganizationSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.OrgId == orgId && (s.Status == "active" || s.Status == "trialing"));

            if (sub?.Plan == null) return false; // no plan = no enforcement

            var limit = sub.Plan.MaxBookingsPerMonth;
            if (limit <= 0) return false; // 0 = unlimited

            // Count this month's bookings
            var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var monthEnd = monthStart.AddMonths(1);

            var count = await db.Bookings
                .CountAsync(b => b.OrgId == orgId && b.CreatedAt >= monthStart && b.CreatedAt < monthEnd
                    && b.Status != Models.BookingStatus.Cancelled);

            return count >= limit;
        }
    }

    public static class PlanGuardMiddlewareExtensions
    {
        public static IApplicationBuilder UsePlanGuard(this IApplicationBuilder app)
            => app.UseMiddleware<PlanGuardMiddleware>();
    }
}
