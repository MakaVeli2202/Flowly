using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class Vehicle
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int UserId { get; set; }

        /// <summary>User-friendly label, e.g. "My Camry" or "Wife's SUV".</summary>
        [StringLength(100)]
        public string? Nickname { get; set; }

        [StringLength(100)]
        public string? Make { get; set; }

        [StringLength(100)]
        public string? Model { get; set; }

        [StringLength(4)]
        public string? Year { get; set; }

        [StringLength(50)]
        public string? Color { get; set; }

        [StringLength(50)]
        public string? PlateNumber { get; set; }

        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        [StringLength(1000)]
        public string? ImageUrl { get; set; }

        public bool IsDefault { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
