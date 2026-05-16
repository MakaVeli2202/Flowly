using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/public")]
    [AllowAnonymous]
    public class PublicController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PublicController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/public/orgs/{slug} - returns org info + branding for the public portal
        [HttpGet("orgs/{slug}")]
        public async Task<IActionResult> GetOrgBySlug(string slug)
        {
            var org = await _context.Organizations
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(o => o.Slug == slug.ToLowerInvariant() && o.IsActive)
                .Select(o => new
                {
                    o.Id,
                    o.Slug,
                    o.Name,
                    o.IndustryType,
                    o.DefaultLocale,
                    o.DefaultCurrency,
                })
                .FirstOrDefaultAsync();

            if (org == null) return NotFound(new { message = "Organization not found." });

            var branding = await _context.OrganizationBrandings
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(b => b.OrgId == org.Id)
                .Select(b => new
                {
                    b.LogoUrl,
                    b.PrimaryColor,
                    b.SecondaryColor,
                })
                .FirstOrDefaultAsync();

            return Ok(new
            {
                org.Id,
                org.Slug,
                org.Name,
                org.IndustryType,
                org.DefaultLocale,
                org.DefaultCurrency,
                Branding = branding,
            });
        }

        // GET /api/public/orgs/{slug}/packages - returns active packages for the org
        [HttpGet("orgs/{slug}/packages")]
        public async Task<IActionResult> GetPackagesBySlug(string slug)
        {
            var org = await _context.Organizations
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(o => o.Slug == slug.ToLowerInvariant() && o.IsActive)
                .Select(o => new { o.Id })
                .FirstOrDefaultAsync();

            if (org == null) return NotFound(new { message = "Organization not found." });

            var packages = await _context.Packages
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(p => p.OrgId == org.Id && p.IsActive)
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.Id)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    p.Price,
                    p.EstimatedDurationMinutes,
                    p.ImageUrl,
                })
                .ToListAsync();

            return Ok(packages);
        }
    }
}
