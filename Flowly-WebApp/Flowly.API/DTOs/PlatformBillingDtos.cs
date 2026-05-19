using System.ComponentModel.DataAnnotations;

namespace Flowly.API.DTOs
{
    public class PlatformPlanDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal MonthlyPrice { get; set; }
        public decimal AnnualPrice { get; set; }
        public int MaxLocations { get; set; }
        public int MaxStaff { get; set; }
        public int MaxBookingsPerMonth { get; set; }
        public int AITokenMonthlyLimit { get; set; }
        public Dictionary<string, bool> Features { get; set; } = new();
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
    }

    public class CreatePlatformPlanDto
    {
        [Required]
        [StringLength(50)]
        public string Name { get; set; } = string.Empty;

        [Range(0, 100000)]
        public decimal MonthlyPrice { get; set; }

        [Range(0, 100000)]
        public decimal AnnualPrice { get; set; }

        [Range(1, 100)]
        public int MaxLocations { get; set; } = 1;

        [Range(1, 1000)]
        public int MaxStaff { get; set; } = 5;

        [Range(1, 100000)]
        public int MaxBookingsPerMonth { get; set; } = 200;

        public int AITokenMonthlyLimit { get; set; } = 0;

        public Dictionary<string, bool>? Features { get; set; }

        public int SortOrder { get; set; }
    }

    public class UpdatePlatformPlanDto
    {
        [StringLength(50)]
        public string? Name { get; set; }

        [Range(0, 100000)]
        public decimal? MonthlyPrice { get; set; }

        [Range(0, 100000)]
        public decimal? AnnualPrice { get; set; }

        [Range(1, 100)]
        public int? MaxLocations { get; set; }

        [Range(1, 1000)]
        public int? MaxStaff { get; set; }

        [Range(1, 100000)]
        public int? MaxBookingsPerMonth { get; set; }

        public int? AITokenMonthlyLimit { get; set; }

        public Dictionary<string, bool>? Features { get; set; }

        public int? SortOrder { get; set; }

        public bool? IsActive { get; set; }
    }

    public class OrganizationSubscriptionDto
    {
        public int Id { get; set; }
        public int OrgId { get; set; }
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string BillingCycle { get; set; } = string.Empty;
        public DateTime CurrentPeriodStart { get; set; }
        public DateTime CurrentPeriodEnd { get; set; }
        public DateTime? TrialEndsAt { get; set; }
        public DateTime? CancelledAt { get; set; }
        public bool IsActive => Status is "active" or "trialing";
    }

    public class CreateCheckoutSessionDto
    {
        [Required]
        public int PlanId { get; set; }

        [Required]
        [RegularExpression("^(monthly|annual)$")]
        public string BillingCycle { get; set; } = "monthly";

        [Required]
        public string SuccessUrl { get; set; } = string.Empty;

        [Required]
        public string CancelUrl { get; set; } = string.Empty;
    }

    public class CheckoutSessionResultDto
    {
        public string SessionId { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }

    public class BillingPortalSessionDto
    {
        public string Url { get; set; } = string.Empty;
    }

    public class UsageRecordDto
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public int BookingCount { get; set; }
        public int StaffCount { get; set; }
        public long AITokensUsed { get; set; }
    }
}
