using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class PackageService
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int PackageId { get; set; }

        [Required]
        public int ServiceId { get; set; }

        // Navigation properties
        [ForeignKey("PackageId")]
        public Package Package { get; set; } = null!;

        [ForeignKey("ServiceId")]
        public Service Service { get; set; } = null!;
    }
}