using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class AuditLog
    {
        [Key]
        public long Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string Action { get; set; } = string.Empty;

        public int? UserId { get; set; }

        [StringLength(255)]
        public string? UserEmail { get; set; }

        [StringLength(45)]
        public string? IpAddress { get; set; }

        [StringLength(50)]
        public string? EntityType { get; set; }

        [StringLength(100)]
        public string? EntityId { get; set; }

        // JSON blob — caller decides shape
        public string? Metadata { get; set; }

        public bool Success { get; set; } = true;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
