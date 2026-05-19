using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Modules.Reseller
{
    // Marks an org as a reseller and links it to child orgs it manages.
    public class ResellerProfile
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; } // the reseller org

        [StringLength(200)]
        public string? CompanyName { get; set; }

        [StringLength(255)]
        public string? BillingEmail { get; set; }

        // Margin the reseller adds on top of platform pricing (percentage, 0-100)
        public decimal RevenueSharePercent { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // Maps child orgs to their reseller.
    public class ResellerManagedOrg
    {
        [Key]
        public int Id { get; set; }

        public int ResellerOrgId { get; set; }  // the reseller
        public int ManagedOrgId { get; set; }   // the client org

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
