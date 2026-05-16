using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class PageView
    {
        [Key]
        public long Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(64)]
        public string SessionId { get; set; } = string.Empty;

        [StringLength(255)]
        public string Page { get; set; } = "/";

        // Direct, Google, TikTok, Instagram, Facebook, Twitter/X, YouTube, Snapchat, LinkedIn, Referral
        [StringLength(50)]
        public string Source { get; set; } = "Direct";

        [StringLength(500)]
        public string? Referrer { get; set; }

        // Desktop, Mobile, Tablet
        [StringLength(20)]
        public string DeviceType { get; set; } = "Desktop";

        public bool IsNewVisitor { get; set; }

        public DateTime FirstSeen { get; set; } = DateTime.UtcNow;

        public DateTime LastHeartbeat { get; set; } = DateTime.UtcNow;

        [StringLength(45)]
        public string? IpAddress { get; set; }
    }
}
