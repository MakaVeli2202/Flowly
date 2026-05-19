using System.ComponentModel.DataAnnotations;

namespace Flowly.API.DTOs
{
    public class CreateServiceDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [Range(1, 480)]
        public int DefaultDurationMinutes { get; set; }

        public List<ServiceProductInputDto> Products { get; set; } = new();
    }

    public class ServiceProductInputDto
    {
        [Required]
        public int ProductId { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal QuantityUsed { get; set; }
    }

    public class UpdateServiceDto
    {
        [StringLength(200)]
        public string? Name { get; set; }

        public string? Description { get; set; }

        [Range(1, 480)]
        public int? DefaultDurationMinutes { get; set; }

        public bool? IsActive { get; set; }

        public List<ServiceProductInputDto>? Products { get; set; }
    }

    public class ServiceDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int DefaultDurationMinutes { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        public decimal EstimatedCost { get; set; }
        public List<ServiceProductDto> Products { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class ServiceProductDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal QuantityUsed { get; set; }
        public string Unit { get; set; } = string.Empty;
        public decimal CostPerUnit { get; set; }
        public decimal TotalCost { get; set; }
    }
}