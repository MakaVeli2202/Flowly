using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class Resource
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int? LocationId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(50)]
        public string Type { get; set; } = "Room"; // Room, Equipment, Vehicle

        public int Capacity { get; set; } = 1;

        public bool IsActive { get; set; } = true;

        public Organization Organization { get; set; } = null!;

        public ICollection<ResourceBooking> ResourceBookings { get; set; } = new List<ResourceBooking>();
    }

    public class ResourceBooking
    {
        [Key]
        public int Id { get; set; }

        public int ResourceId { get; set; }
        public int BookingId { get; set; }

        public DateTime StartAt { get; set; }
        public DateTime EndAt { get; set; }

        public Resource Resource { get; set; } = null!;
        public Booking Booking { get; set; } = null!;
    }
}
