using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;

namespace Flowly.API.Platform.Tenancy
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
            if (tenant.OrgId > 0)
            {
                if (IsBookingCreation(ctx))
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
                else if (IsStaffCreation(ctx))
                {
                    var exceeded = await IsStaffLimitExceededAsync(tenant.OrgId, db);
                    if (exceeded)
                    {
                        ctx.Response.StatusCode = 429;
                        ctx.Response.ContentType = "application/json";
                        await ctx.Response.WriteAsync("{\"message\":\"Staff limit exceeded for your plan.\"}");
                        return;
                    }
                }
            }

            await _next(ctx);
        }

        private static bool IsBookingCreation(HttpContext ctx) =>
            ctx.Request.Method == HttpMethods.Post &&
            ctx.Request.Path.StartsWithSegments("/api/Bookings", StringComparison.OrdinalIgnoreCase) &&
            ctx.Request.Path.Value?.Split('/').Length == 3; // /api/Bookings only

        private static bool IsStaffCreation(HttpContext ctx) =>
            ctx.Request.Method == HttpMethods.Post &&
            ctx.Request.Path.StartsWithSegments("/api/Auth/register-worker", StringComparison.OrdinalIgnoreCase);

        private static async Task<bool> IsBookingQuotaExceededAsync(int orgId, AppDbContext db)
        {
            var now = DateTime.UtcNow;
            var sub = await db.OrganizationSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.OrgId == orgId && (s.Status == "active" || s.Status == "trialing"));

            if (sub?.Plan == null) return false;

            var limit = sub.Plan.MaxBookingsPerMonth;
            if (limit <= 0) return false;

            var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var monthEnd = monthStart.AddMonths(1);

            var count = await db.Bookings
                .CountAsync(b => b.OrgId == orgId && b.CreatedAt >= monthStart && b.CreatedAt < monthEnd
                    && b.Status != Models.BookingStatus.Cancelled);

            return count >= limit;
        }

        private static async Task<bool> IsStaffLimitExceededAsync(int orgId, AppDbContext db)
        {
            var sub = await db.OrganizationSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.OrgId == orgId && (s.Status == "active" || s.Status == "trialing"));

            if (sub?.Plan == null) return false;

            var limit = sub.Plan.MaxStaff;
            if (limit <= 0) return false;

            var count = await db.Users
                .CountAsync(u => u.OrgId == orgId && u.Role == "Worker" && u.IsActive);

            return count >= limit;
        }
    }

    public static class PlanGuardMiddlewareExtensions
    {
        public static IApplicationBuilder UsePlanGuard(this IApplicationBuilder app)
            => app.UseMiddleware<PlanGuardMiddleware>();
    }
}
