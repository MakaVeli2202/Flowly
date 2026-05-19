using Flowly.API.Data;
using Flowly.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Modules.Reseller
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ResellerController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public ResellerController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        // GET api/Reseller/profile
        [HttpGet("profile")]
        public async Task<ActionResult<ResellerProfileDto>> GetProfile()
        {
            var profile = await _db.ResellerProfiles.AsNoTracking()
                .FirstOrDefaultAsync(p => p.OrgId == _tenant.OrgId);

            if (profile == null) return NotFound("Not a reseller account.");
            return Ok(new ResellerProfileDto(profile.CompanyName, profile.BillingEmail, profile.RevenueSharePercent, profile.IsActive));
        }

        // PUT api/Reseller/profile
        [HttpPut("profile")]
        public async Task<IActionResult> SaveProfile([FromBody] ResellerProfileDto dto)
        {
            var profile = await _db.ResellerProfiles.FirstOrDefaultAsync(p => p.OrgId == _tenant.OrgId);

            if (profile == null)
            {
                _db.ResellerProfiles.Add(new ResellerProfile
                {
                    OrgId = _tenant.OrgId,
                    CompanyName = dto.CompanyName,
                    BillingEmail = dto.BillingEmail,
                    RevenueSharePercent = dto.RevenueSharePercent,
                    IsActive = true
                });
            }
            else
            {
                profile.CompanyName = dto.CompanyName;
                profile.BillingEmail = dto.BillingEmail;
                profile.RevenueSharePercent = dto.RevenueSharePercent;
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "Reseller profile saved." });
        }

        // GET api/Reseller/managed-orgs
        [HttpGet("managed-orgs")]
        public async Task<ActionResult<List<ManagedOrgDto>>> GetManagedOrgs()
        {
            var links = await _db.ResellerManagedOrgs.AsNoTracking()
                .Where(r => r.ResellerOrgId == _tenant.OrgId && r.IsActive)
                .ToListAsync();

            var orgIds = links.Select(l => l.ManagedOrgId).ToList();
            var orgs = await _db.Organizations.AsNoTracking()
                .IgnoreQueryFilters()
                .Where(o => orgIds.Contains(o.Id))
                .Select(o => new { o.Id, o.Name, o.Slug, o.IndustryType, o.IsActive, o.CreatedAt })
                .ToListAsync();

            var result = orgs.Select(o => new ManagedOrgDto(o.Id, o.Name, o.Slug, o.IndustryType, o.IsActive, o.CreatedAt)).ToList();
            return Ok(result);
        }

        // POST api/Reseller/managed-orgs
        // Creates a new organization under this reseller.
        [HttpPost("managed-orgs")]
        public async Task<ActionResult<ManagedOrgDto>> CreateManagedOrg([FromBody] CreateManagedOrgDto dto)
        {
            var isReseller = await _db.ResellerProfiles.AsNoTracking()
                .AnyAsync(p => p.OrgId == _tenant.OrgId && p.IsActive);
            if (!isReseller) return Forbid();

            if (await _db.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Slug == dto.Slug))
                return Conflict("An organization with this slug already exists.");

            var org = new Flowly.API.Models.Organization
            {
                Slug = dto.Slug,
                Name = dto.Name,
                IndustryType = dto.IndustryType ?? "service_business",
                BillingEmail = dto.BillingEmail,
                DefaultLocale = dto.DefaultLocale ?? "en",
                DefaultCurrency = dto.DefaultCurrency ?? "QAR",
                IsActive = true
            };
            _db.Organizations.Add(org);
            await _db.SaveChangesAsync();

            _db.ResellerManagedOrgs.Add(new ResellerManagedOrg
            {
                ResellerOrgId = _tenant.OrgId,
                ManagedOrgId = org.Id,
                IsActive = true
            });
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetManagedOrgs), new ManagedOrgDto(org.Id, org.Name, org.Slug, org.IndustryType, org.IsActive, org.CreatedAt));
        }

        // DELETE api/Reseller/managed-orgs/{orgId}
        // Unlinks a managed org (does not delete the org itself).
        [HttpDelete("managed-orgs/{orgId:int}")]
        public async Task<IActionResult> UnlinkManagedOrg(int orgId)
        {
            var link = await _db.ResellerManagedOrgs
                .FirstOrDefaultAsync(r => r.ResellerOrgId == _tenant.OrgId && r.ManagedOrgId == orgId);

            if (link == null) return NotFound();

            link.IsActive = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record ResellerProfileDto(string? CompanyName, string? BillingEmail, decimal RevenueSharePercent, bool IsActive);

    public record ManagedOrgDto(int Id, string Name, string Slug, string IndustryType, bool IsActive, DateTime CreatedAt);

    public record CreateManagedOrgDto(
        string Slug,
        string Name,
        string? IndustryType,
        string? BillingEmail,
        string? DefaultLocale,
        string? DefaultCurrency);
}
