using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;

namespace Glanz.API.Modules.Organization
{
    public class OrganizationService : IOrganizationService
    {
        private readonly AppDbContext _context;
        private readonly ITokenService _tokenService;

        public OrganizationService(AppDbContext context, ITokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        public async Task<(OrganizationDto? Result, string? Error, int StatusCode)> RegisterOrganizationAsync(RegisterOrganizationDto dto)
        {
            var slugNormalized = dto.Slug.Trim().ToLowerInvariant();

            var slugTaken = await _context.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Slug == slugNormalized);
            if (slugTaken) return (null, "This organization slug is already taken.", 409);

            var emailTaken = await _context.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == dto.AdminEmail.Trim().ToLowerInvariant());
            if (emailTaken) return (null, "An account with this email already exists.", 409);

            var org = new Models.Organization
            {
                Slug = slugNormalized,
                Name = dto.OrganizationName.Trim(),
                IndustryType = dto.IndustryType,
                BillingEmail = dto.BillingEmail?.Trim(),
                DefaultLocale = dto.DefaultLocale,
                DefaultTimezone = dto.DefaultTimezone,
                DefaultCurrency = dto.DefaultCurrency,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            _context.Organizations.Add(org);
            await _context.SaveChangesAsync();

            var adminUser = new User
            {
                OrgId = org.Id,
                Email = dto.AdminEmail.Trim().ToLowerInvariant(),
                FirstName = dto.AdminFirstName.Trim(),
                LastName = dto.AdminLastName.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.AdminPassword),
                Role = "Admin",
                IsEmailVerified = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();

            return (ToDto(org), null, 201);
        }

        public async Task<(OrganizationDto? Result, string? Error, int StatusCode)> GetOrganizationAsync(int orgId)
        {
            var org = await _context.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orgId);
            if (org == null) return (null, "Organization not found.", 404);
            return (ToDto(org), null, 200);
        }

        public async Task<(OrganizationDto? Result, string? Error, int StatusCode)> UpdateOrganizationAsync(int orgId, UpdateOrganizationDto dto, int adminId)
        {
            var org = await _context.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orgId);
            if (org == null) return (null, "Organization not found.", 404);

            if (dto.Name != null) org.Name = dto.Name.Trim();
            if (dto.BillingEmail != null) org.BillingEmail = dto.BillingEmail.Trim();
            if (dto.DefaultLocale != null) org.DefaultLocale = dto.DefaultLocale;
            if (dto.DefaultTimezone != null) org.DefaultTimezone = dto.DefaultTimezone;
            if (dto.DefaultCurrency != null) org.DefaultCurrency = dto.DefaultCurrency;

            await _context.SaveChangesAsync();
            return (ToDto(org), null, 200);
        }

        public async Task<(OrganizationBrandingDto? Result, string? Error, int StatusCode)> GetBrandingAsync(int orgId)
        {
            var branding = await _context.OrganizationBrandings.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.OrgId == orgId);
            if (branding == null)
                return (new OrganizationBrandingDto { OrgId = orgId }, null, 200);
            return (ToBrandingDto(branding), null, 200);
        }

        public async Task<(OrganizationBrandingDto? Result, string? Error, int StatusCode)> UpdateBrandingAsync(int orgId, UpdateOrganizationBrandingDto dto, int adminId)
        {
            var branding = await _context.OrganizationBrandings.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.OrgId == orgId);
            if (branding == null)
            {
                branding = new Models.OrganizationBranding { OrgId = orgId };
                _context.OrganizationBrandings.Add(branding);
            }

            if (dto.LogoUrl != null) branding.LogoUrl = dto.LogoUrl;
            if (dto.FaviconUrl != null) branding.FaviconUrl = dto.FaviconUrl;
            if (dto.PrimaryColor != null) branding.PrimaryColor = dto.PrimaryColor;
            if (dto.SecondaryColor != null) branding.SecondaryColor = dto.SecondaryColor;
            if (dto.CustomDomain != null) branding.CustomDomain = dto.CustomDomain;

            await _context.SaveChangesAsync();
            return (ToBrandingDto(branding), null, 200);
        }

        public async Task<OrganizationOnboardingDto> GetOnboardingStatusAsync(int orgId)
        {
            var hasWorkers = await _context.Staff.AnyAsync(s => s.IsActive);
            var hasServices = await _context.Services.AnyAsync(s => s.IsActive);
            var hasPackages = await _context.Packages.AnyAsync(p => p.IsActive);
            var hasBranding = await _context.OrganizationBrandings.IgnoreQueryFilters().AnyAsync(b => b.OrgId == orgId && (b.LogoUrl != null || b.PrimaryColor != null));
            const bool hasBusinessHours = true; // defaults always exist

            var steps = new[] { hasWorkers, hasServices, hasPackages, hasBusinessHours, hasBranding };

            return new OrganizationOnboardingDto
            {
                HasWorkers = hasWorkers,
                HasServices = hasServices,
                HasPackages = hasPackages,
                HasBusinessHours = hasBusinessHours,
                HasBranding = hasBranding,
                CompletedSteps = steps.Count(s => s),
                TotalSteps = steps.Length,
            };
        }

        private static OrganizationDto ToDto(Models.Organization org) => new()
        {
            Id = org.Id,
            Slug = org.Slug,
            Name = org.Name,
            IndustryType = org.IndustryType,
            BillingEmail = org.BillingEmail,
            DefaultLocale = org.DefaultLocale,
            DefaultTimezone = org.DefaultTimezone,
            DefaultCurrency = org.DefaultCurrency,
            IsActive = org.IsActive,
            CreatedAt = org.CreatedAt,
        };

        private static OrganizationBrandingDto ToBrandingDto(Models.OrganizationBranding b) => new()
        {
            OrgId = b.OrgId,
            LogoUrl = b.LogoUrl,
            FaviconUrl = b.FaviconUrl,
            PrimaryColor = b.PrimaryColor,
            SecondaryColor = b.SecondaryColor,
            CustomDomain = b.CustomDomain,
            CustomDomainVerified = b.CustomDomainVerified,
            WhiteLabelEnabled = b.WhiteLabelEnabled,
        };
    }
}
