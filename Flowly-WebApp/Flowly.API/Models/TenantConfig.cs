using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class TenantConfigurationSnapshot
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }
        public int Version { get; set; }

        [StringLength(100)]
        public string? IndustryTemplateKey { get; set; }

        // JSON snapshots of config at point in time
        public string? FeatureFlagsJson { get; set; }
        public string? CustomFieldSchemaJson { get; set; }
        public string? TerminologyJson { get; set; }
        public string? WorkflowTemplatesJson { get; set; }
        public string? BrandingJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [StringLength(200)]
        public string? CreatedBy { get; set; }

        public Organization Organization { get; set; } = null!;
    }

    public class TenantFeatureFlag
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string FeatureKey { get; set; } = string.Empty;

        public bool IsEnabled { get; set; } = false;

        // JSON config for the feature
        public string? ConfigJson { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;
    }
}
