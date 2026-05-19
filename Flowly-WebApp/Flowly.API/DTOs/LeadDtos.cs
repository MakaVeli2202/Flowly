using Flowly.API.Models;

namespace Flowly.API.DTOs
{
    public class LeadDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Notes { get; set; }
        public LeadSource Source { get; set; }
        public string? SourceDetails { get; set; }
        public LeadStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastContactedAt { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? AssignedToUserName { get; set; }
        public int? ConvertedToBookingId { get; set; }
        public string? PreferredService { get; set; }
        public string? UtmCampaign { get; set; }
        public string? UtmContent { get; set; }
        public string? UtmTerm { get; set; }
        public string? Gclid { get; set; }
        public string? Fbclid { get; set; }
        public string? FbLeadId { get; set; }
    }

    public class LeadFilterDto
    {
        public string? status { get; set; }
        public string? source { get; set; }
        public int? skip { get; set; }
        public int? take { get; set; }
    }

    public class LeadStatsDto
    {
        public int Total { get; set; }
        public int New { get; set; }
        public int Contacted { get; set; }
        public int Interested { get; set; }
        public int Booked { get; set; }
        public int Lost { get; set; }
        public List<SourceCountDto> SourceBreakdown { get; set; } = new();
    }

    public class SourceCountDto
    {
        public string Source { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class CreateLeadDto
    {
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Notes { get; set; }
        public LeadSource Source { get; set; } = LeadSource.Other;
        public string? SourceDetails { get; set; }
        public string? PreferredService { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? UtmCampaign { get; set; }
        public string? UtmContent { get; set; }
        public string? UtmTerm { get; set; }
        public string? Gclid { get; set; }
        public string? Fbclid { get; set; }
    }

    public class UpdateLeadDto
    {
        public string? Name { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Notes { get; set; }
        public LeadSource? Source { get; set; }
        public LeadStatus? Status { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? PreferredService { get; set; }
        public int? ConvertedToBookingId { get; set; }
    }

    // Facebook Lead Ads webhook DTO
    public class FacebookLeadDto
    {
        public string LeadId { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Fbclid { get; set; }
        public string? Gclid { get; set; }
        public string? Service { get; set; }
    }

    // Google Local Services Ads DTO
    public class GoogleLsaLeadDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Gclid { get; set; }
        public string? AdId { get; set; }
        public string? Service { get; set; }
    }
}