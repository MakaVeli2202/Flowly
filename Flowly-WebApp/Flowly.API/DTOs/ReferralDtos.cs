using System.ComponentModel.DataAnnotations;
using Flowly.API.Models;

namespace Flowly.API.DTOs
{
    public class ReferralDto
    {
        public int Id { get; set; }
        public int ReferrerId { get; set; }
        public string? ReferrerName { get; set; }
        public string? ReferrerPhone { get; set; }
        public int ReferredUserId { get; set; }
        public string ReferredUserName { get; set; } = string.Empty;
        public string? ReferredUserPhone { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? FirstBookingAt { get; set; }
        public decimal RewardAmount { get; set; }
        public DateTime? RewardedAt { get; set; }
    }

    public class MyReferralsDto
    {
        public string ReferralCode { get; set; } = string.Empty;
        public decimal ReferralPoints { get; set; }
        public int TotalReferrals { get; set; }
        public int PendingReferrals { get; set; }
        public int RewardedReferrals { get; set; }
        public bool ReferralCodeUnlocked { get; set; }
        public List<ReferralDto> Referrals { get; set; } = new();
    }

    public class ApplyReferralDto
    {
        [Required]
        public string ReferralCode { get; set; } = string.Empty;
    }

    public class GenerateCodeResultDto
    {
        public string ReferralCode { get; set; } = string.Empty;
    }
}