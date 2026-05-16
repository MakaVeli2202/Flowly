using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class PlatformPlan
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; } = string.Empty; // Starter, Growth, Pro, Enterprise

        [Column(TypeName = "decimal(10,2)")]
        public decimal MonthlyPrice { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal AnnualPrice { get; set; }

        public int MaxLocations { get; set; } = 1;
        public int MaxStaff { get; set; } = 5;
        public int MaxBookingsPerMonth { get; set; } = 200;
        public int AITokenMonthlyLimit { get; set; } = 0;

        // JSON: { "payments": true, "ai": false, "inventory": true, ... }
        public string? FeaturesJson { get; set; }

        public bool IsActive { get; set; } = true;
        public int SortOrder { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<OrganizationSubscription> OrganizationSubscriptions { get; set; } = new List<OrganizationSubscription>();
    }

    public class OrganizationSubscription
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }
        public int PlanId { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "trialing"; // trialing, active, past_due, cancelled

        [StringLength(10)]
        public string BillingCycle { get; set; } = "monthly"; // monthly, annual

        public DateTime CurrentPeriodStart { get; set; }
        public DateTime CurrentPeriodEnd { get; set; }

        [StringLength(255)]
        public string? StripeSubscriptionId { get; set; }

        [StringLength(255)]
        public string? StripePriceId { get; set; }

        [StringLength(255)]
        public string? StripeCustomerId { get; set; }

        public DateTime? TrialEndsAt { get; set; }
        public DateTime? CancelledAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;
        public PlatformPlan Plan { get; set; } = null!;
    }

    public class UsageRecord
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int Year { get; set; }
        public int Month { get; set; }

        public int BookingCount { get; set; }
        public int StaffCount { get; set; }
        public long AITokensUsed { get; set; }
        public int SMSSent { get; set; }

        [Column(TypeName = "decimal(10,4)")]
        public decimal StorageGb { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;
    }
}
