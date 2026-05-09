using Glanz.API.Models;
using System.ComponentModel.DataAnnotations;

namespace Glanz.API.DTOs
{
    public class CreateFeedbackDto
    {
        public int? BookingId { get; set; }

        [Required]
        public FeedbackType Type { get; set; }

        [Range(1, 5)]
        public int? Rating { get; set; }

        [StringLength(2000)]
        public string? Comment { get; set; }

        public bool IsAnonymous { get; set; }

        public int? WorkerId { get; set; }
    }

    public class FeedbackDto
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string? UserName { get; set; }
        public int? BookingId { get; set; }
        public string? BookingNumber { get; set; }
        public int? WorkerId { get; set; }
        public string? WorkerName { get; set; }
        public FeedbackType Type { get; set; }
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public bool IsAnonymous { get; set; }
        public bool IsResolved { get; set; }
        public string? ResolutionNote { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }

    public class ResolveFeedbackDto
    {
        [StringLength(500)]
        public string? ResolutionNote { get; set; }
    }

    public class UpdateCustomerDto
    {
        [StringLength(1000)]
        public string? Tags { get; set; }

        public string? Notes { get; set; }

        public decimal? TotalSpent { get; set; }

        public int? TotalBookingsCount { get; set; }
    }

    public class CustomerProfileDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string? Tags { get; set; }
        public string? Notes { get; set; }
        public decimal TotalSpent { get; set; }
        public int TotalBookingsCount { get; set; }
        public DateTime? LastBookedDate { get; set; }
        public DateTime? CreatedAt { get; set; }
        public bool IsLoyaltyActive { get; set; }
        public DateTime? LoyaltyActivatedAt { get; set; }
    }

    public class CrmCustomerDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Tags { get; set; }
        public List<string> TagList => string.IsNullOrWhiteSpace(Tags) 
            ? new List<string>() 
            : Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        public decimal TotalSpent { get; set; }
        public int TotalBookings { get; set; }
        public DateTime? LastBookedDate { get; set; }
        public int DaysSinceLastBooking { get; set; }
        public string Segment { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsAtRisk { get; set; }
    }

    public class CrmDashboardDto
    {
        public int TotalCustomers { get; set; }
        public int ActiveThisMonth { get; set; }
        public int AtRiskCustomers { get; set; }
        public int VipCustomers { get; set; }
        public int NewCustomers { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal AverageCustomerValue { get; set; }
        public List<CrmCustomerDto> RecentAtRisk { get; set; } = new();
        public List<CrmCustomerDto> TopSpenders { get; set; } = new();
    }

    public class CrmStatsDto
    {
        public int TotalCustomers { get; set; }
        public int ActiveCustomers { get; set; }
        public int InactiveCustomers { get; set; }
        public int AtRiskCustomers { get; set; }
        public int VipCustomers { get; set; }
        public int FleetCustomers { get; set; }
        public decimal AverageLtv { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalComplaints { get; set; }
        public int UnresolvedComplaints { get; set; }
    }

    public class CustomerSegmentRequest
    {
        [Required]
        public List<int> CustomerIds { get; set; } = new();

        [Required]
        [StringLength(50)]
        public string Tag { get; set; } = string.Empty;
    }

    public class BulkTagDto
    {
        [Required]
        public List<int> CustomerIds { get; set; } = new();

        [StringLength(50)]
        public string Tag { get; set; } = string.Empty;

        public bool Remove { get; set; }
    }

    public static class CustomerSegments
    {
        public const string VIP = "VIP";
        public const string AtRisk = "At-Risk";
        public const string New = "New";
        public const string Loyal = "Loyal";
        public const string Fleet = "Fleet";
        public const string Commercial = "Commercial";
        public const string Inactive = "Inactive";
    }

    public class BookingSourceStatsDto
    {
        public int TotalBookings { get; set; }
        public decimal TotalRevenue { get; set; }
        public List<SourceStatItem> Sources { get; set; } = new();
    }

    public class SourceStatItem
    {
        public string Source { get; set; } = string.Empty;
        public int Count { get; set; }
        public decimal Revenue { get; set; }
    }
}