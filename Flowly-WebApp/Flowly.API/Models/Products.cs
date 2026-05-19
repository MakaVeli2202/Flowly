using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [StringLength(100)]
        public string Vendor { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal CostPerUnit { get; set; }

        [Required]
        [StringLength(20)]
        public string Unit { get; set; } = "ml"; // ml, item, piece, etc.

        [Required]
        public int StockQuantity { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<ServiceProduct> ServiceProducts { get; set; } = new List<ServiceProduct>();
    }
}