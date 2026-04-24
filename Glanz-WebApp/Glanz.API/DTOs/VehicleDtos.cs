using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;
using Microsoft.AspNetCore.Http;

namespace Glanz.API.DTOs
{
    public class CreateVehicleDto
    {
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

        public bool IsDefault { get; set; } = false;
    }

    public class UpdateVehicleDto : CreateVehicleDto { }

    public class UploadVehicleImageDto
    {
        [Required]
        public IFormFile Image { get; set; } = null!;
    }

    public class VehicleDto
    {
        public int Id { get; set; }
        public string? Nickname { get; set; }
        public string? Make { get; set; }
        public string? Model { get; set; }
        public string? Year { get; set; }
        public string? Color { get; set; }
        public string? PlateNumber { get; set; }
        public string VehicleType { get; set; } = "Sedan";
        public string? ImageUrl { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
