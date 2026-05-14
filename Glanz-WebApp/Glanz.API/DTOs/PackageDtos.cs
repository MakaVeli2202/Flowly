using System.ComponentModel.DataAnnotations;

namespace Glanz.API.DTOs
{
    public class CreatePackageDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Price { get; set; }

        [Required]
        [StringLength(50)]
        public string Tier { get; set; } = "Standard";

        [Required]
        [Range(1, 480)]
        public int EstimatedDurationMinutes { get; set; }

        public string? ImageUrl { get; set; }

        [Required]
        public List<int> ServiceIds { get; set; } = new();
    }

    public class UpdatePackageDto
    {
        [StringLength(200)]
        public string? Name { get; set; }

        public string? Description { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? Price { get; set; }

        [StringLength(50)]
        public string? Tier { get; set; }

        [Range(1, 480)]
        public int? EstimatedDurationMinutes { get; set; }

        public string? ImageUrl { get; set; }

        public bool? IsActive { get; set; }

        public List<int>? ServiceIds { get; set; }
    }

    public class PackageDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public string Tier { get; set; } = string.Empty;
        public int EstimatedDurationMinutes { get; set; }
        public string? ImageUrl { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        public decimal EstimatedCost { get; set; }
        public decimal EstimatedProfit { get; set; }
        public decimal ProfitMarginPercent { get; set; }
        public List<PackageServiceDetailDto> Services { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class ReorderItemDto
    {
        public int Id { get; set; }
        public int SortOrder { get; set; }
    }

    public class PackageServiceDetailDto
    {
        public int ServiceId { get; set; }
        public string ServiceName { get; set; } = string.Empty;
        public string? ServiceDescription { get; set; }
        public int DurationMinutes { get; set; }
        public decimal ServiceCost { get; set; }
    }
}