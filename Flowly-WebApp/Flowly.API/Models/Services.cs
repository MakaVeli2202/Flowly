using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class Service
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        public int DefaultDurationMinutes { get; set; }

        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<ServiceProduct> ServiceProducts { get; set; } = new List<ServiceProduct>();
        public ICollection<PackageService> PackageServices { get; set; } = new List<PackageService>();
    }
}