using System.ComponentModel.DataAnnotations;

namespace Flowly.API.DTOs
{
    public class CreateProductDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [StringLength(100)]
        public string Vendor { get; set; } = string.Empty;

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal CostPerUnit { get; set; }

        [Required]
        [StringLength(20)]
        public string Unit { get; set; } = "ml";

        [Required]
        [Range(0, int.MaxValue)]
        public int StockQuantity { get; set; }
    }

    public class UpdateProductDto
    {
        [StringLength(200)]
        public string? Name { get; set; }

        public string? Description { get; set; }

        [StringLength(100)]
        public string? Vendor { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? CostPerUnit { get; set; }

        [StringLength(20)]
        public string? Unit { get; set; }

        [Range(0, int.MaxValue)]
        public int? StockQuantity { get; set; }

        public bool? IsActive { get; set; }
    }

    public class ProductDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Vendor { get; set; } = string.Empty;
        public decimal CostPerUnit { get; set; }
        public string Unit { get; set; } = string.Empty;
        public int StockQuantity { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}