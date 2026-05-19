using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class Organization
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Slug { get; set; } = string.Empty; // subdomain-safe, e.g. "acme-detailing"

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(100)]
        public string IndustryType { get; set; } = "automotive_detailing";

        [StringLength(255)]
        public string? BillingEmail { get; set; }

        [StringLength(10)]
        public string DefaultLocale { get; set; } = "en";

        [StringLength(100)]
        public string DefaultTimezone { get; set; } = "UTC";

        [StringLength(10)]
        public string DefaultCurrency { get; set; } = "QAR";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<OrganizationLocation> Locations { get; set; } = new List<OrganizationLocation>();
        public OrganizationBranding? Branding { get; set; }
    }

    public class OrganizationLocation
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(100)]
        public string Timezone { get; set; } = "UTC";

        [StringLength(20)]
        public string? Phone { get; set; }

        public bool IsDefault { get; set; } = false;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;
    }

    public class OrganizationBranding
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

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

        public bool CustomDomainVerified { get; set; } = false;

        public bool WhiteLabelEnabled { get; set; } = false;

        public Organization Organization { get; set; } = null!;
    }
}
