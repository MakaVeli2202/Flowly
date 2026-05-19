using System.Security.Claims;
using Flowly.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Platform.Tenancy
{
    public class TenantMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, TenantContext tenantContext, AppDbContext db)
        {
            // Resolution priority:
            // 1. X-Org-Id header (explicit API clients)
            // 2. JWT claim org_id
            // 3. Subdomain (future: acme.platform.com)
            // 4. Default org 1 (single-tenant backwards compat)

            if (context.Request.Headers.TryGetValue("X-Org-Id", out var orgIdHeader)
                && int.TryParse(orgIdHeader.FirstOrDefault(), out var headerOrgId))
            {
                tenantContext.OrgId = headerOrgId;
                tenantContext.IsResolved = true;
            }
            else if (context.User.Identity?.IsAuthenticated == true)
            {
                var orgIdClaim = context.User.FindFirst("org_id")?.Value;
                if (int.TryParse(orgIdClaim, out var claimOrgId))
                {
                    tenantContext.OrgId = claimOrgId;
                    tenantContext.IsResolved = true;
                }

                tenantContext.IsPlatformAdmin = context.User.IsInRole("platform_admin");
            }

            // Resolve slug lazily (only if OrgId was set and slug is needed)
            if (tenantContext.IsResolved && tenantContext.OrgSlug == null)
            {
                var org = await db.Organizations
                    .AsNoTracking()
                    .Where(o => o.Id == tenantContext.OrgId)
                    .Select(o => new { o.Slug })
                    .FirstOrDefaultAsync();

                tenantContext.OrgSlug = org?.Slug;
            }

            await _next(context);
        }
    }
}
