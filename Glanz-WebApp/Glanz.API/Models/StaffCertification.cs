using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class StaffCertification
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int WorkerId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(200)]
        public string? IssuingBody { get; set; }

        public DateTime? IssuedDate { get; set; }

        public DateTime? ExpiryDate { get; set; }

        [StringLength(1000)]
        public string? CertificateUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("WorkerId")]
        public Staff Worker { get; set; } = null!;
    }
}
