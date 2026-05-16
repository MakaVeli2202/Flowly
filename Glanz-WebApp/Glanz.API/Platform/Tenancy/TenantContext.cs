namespace Glanz.API.Platform.Tenancy
{
    public class TenantContext
    {
        public int OrgId { get; set; } = 1; // default org for backwards compat
        public string? OrgSlug { get; set; }
        public bool IsResolved { get; set; } = false;
        public bool IsPlatformAdmin { get; set; } = false;
    }
}
