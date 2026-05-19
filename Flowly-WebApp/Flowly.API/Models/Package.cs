using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class Package
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        [Required]
        [StringLength(50)]
        public string Tier { get; set; } = "Standard"; // Standard, Gold, Platinum

        [Required]
        public int EstimatedDurationMinutes { get; set; }

        [StringLength(500)]
        public string? ImageUrl { get; set; }

        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<PackageService> PackageServices { get; set; } = new List<PackageService>();
        public ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();
    }
}