using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class ServiceProduct
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int ServiceId { get; set; }

        [Required]
        public int ProductId { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal QuantityUsed { get; set; }

        // Navigation properties
        [ForeignKey("ServiceId")]
        public Service Service { get; set; } = null!;

        [ForeignKey("ProductId")]
        public Product Product { get; set; } = null!;
    }
}