using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Modules.SSO
{
    public class SsoConfiguration
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required, StringLength(50)]
        public string Provider { get; set; } = "AzureAD"; // AzureAD | Generic

        [StringLength(100)]
        public string? TenantId { get; set; }

        [Required, StringLength(200)]
        public string ClientId { get; set; } = string.Empty;

        // Stored encrypted at rest; set via env var in production
        [Required, StringLength(500)]
        public string ClientSecretHash { get; set; } = string.Empty;

        [StringLength(2000)]
        public string? AdditionalScopes { get; set; } // space-separated extra scopes

        public bool Enabled { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
