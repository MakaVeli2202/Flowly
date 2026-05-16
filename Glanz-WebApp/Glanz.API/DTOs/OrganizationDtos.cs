using System.ComponentModel.DataAnnotations;

namespace Glanz.API.DTOs
{
    public class RegisterOrganizationDto
    {
        [Required]
        [StringLength(200)]
        public string OrganizationName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [RegularExpression(@"^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$", ErrorMessage = "Slug must be lowercase alphanumeric with hyphens.")]
        public string Slug { get; set; } = string.Empty;

        [StringLength(100)]
        public string IndustryType { get; set; } = "automotive_detailing";

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string AdminEmail { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string AdminPassword { get; set; } = string.Empty;

        [StringLength(100)]
        public string AdminFirstName { get; set; } = "Admin";

        [StringLength(100)]
        public string AdminLastName { get; set; } = string.Empty;

        [StringLength(255)]
        public string? BillingEmail { get; set; }

        [StringLength(10)]
        public string DefaultLocale { get; set; } = "en";

        [StringLength(100)]
        public string DefaultTimezone { get; set; } = "UTC";

        [StringLength(10)]
        public string DefaultCurrency { get; set; } = "QAR";
    }

    public class UpdateOrganizationDto
    {
        [StringLength(200)]
        public string? Name { get; set; }

        [EmailAddress]
        [StringLength(255)]
        public string? BillingEmail { get; set; }

        [StringLength(10)]
        public string? DefaultLocale { get; set; }

        [StringLength(100)]
        public string? DefaultTimezone { get; set; }

        [StringLength(10)]
        public string? DefaultCurrency { get; set; }
    }

    public class OrganizationDto
    {
        public int Id { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string IndustryType { get; set; } = string.Empty;
        public string? BillingEmail { get; set; }
        public string DefaultLocale { get; set; } = "en";
        public string DefaultTimezone { get; set; } = "UTC";
        public string DefaultCurrency { get; set; } = "QAR";
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class OrganizationBrandingDto
    {
        public int OrgId { get; set; }
        public string? LogoUrl { get; set; }
        public string? FaviconUrl { get; set; }
        public string? PrimaryColor { get; set; }
        public string? SecondaryColor { get; set; }
        public string? CustomDomain { get; set; }
        public bool CustomDomainVerified { get; set; }
        public bool WhiteLabelEnabled { get; set; }
    }

    public class UpdateOrganizationBrandingDto
    {
        [StringLength(1000)]
        public string? LogoUrl { get; set; }

        [StringLength(1000)]
        public string? FaviconUrl { get; set; }

        [StringLength(20)]
        public string? PrimaryColor { get; set; }

        [StringLength(20)]
        public string? SecondaryColor { get; set; }

        [StringLength(255)]
        public string? CustomDomain { get; set; }
    }

    public class OrganizationOnboardingDto
    {
        public bool HasWorkers { get; set; }
        public bool HasServices { get; set; }
        public bool HasPackages { get; set; }
        public bool HasBusinessHours { get; set; }
        public bool HasBranding { get; set; }
        public int CompletedSteps { get; set; }
        public int TotalSteps { get; set; }
        public bool IsComplete => CompletedSteps >= TotalSteps;
    }

    public class OrganizationRegistrationResultDto
    {
        public OrganizationDto Organization { get; set; } = null!;
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}
