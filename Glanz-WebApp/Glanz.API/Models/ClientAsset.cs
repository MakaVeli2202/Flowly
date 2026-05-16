using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class AssetCategory
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty; // "Sedan", "SUV", "Studio Apartment", etc.

        [Column(TypeName = "decimal(5,2)")]
        public decimal PricingMultiplier { get; set; } = 1.0m;

        [StringLength(100)]
        public string? Icon { get; set; }

        public int SortOrder { get; set; }

        public bool IsActive { get; set; } = true;

        public Organization Organization { get; set; } = null!;
        public ICollection<ClientAsset> ClientAssets { get; set; } = new List<ClientAsset>();
    }

    public class ClientAsset
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int? CustomerId { get; set; } // FK to Users

        public int? AssetCategoryId { get; set; }

        [Required]
        [StringLength(200)]
        public string Label { get; set; } = string.Empty; // "My Camry", "Living Room"

        // JSONB: make/model/year for cars, breed/weight for pets, sqm for cleaning
        public string? AttributesJson { get; set; }

        public bool IsDefault { get; set; } = false;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Organization Organization { get; set; } = null!;

        [ForeignKey("CustomerId")]
        public User? Customer { get; set; }

        [ForeignKey("AssetCategoryId")]
        public AssetCategory? AssetCategory { get; set; }
    }
}
