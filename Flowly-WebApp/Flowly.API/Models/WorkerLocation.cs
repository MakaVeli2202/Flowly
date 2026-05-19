using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class WorkerLocation
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int WorkerId { get; set; }

        [Required]
        public int BookingId { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        [Required]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;

        [StringLength(50)]
        public string? Status { get; set; }

        [ForeignKey("WorkerId")]
        public Staff? Worker { get; set; }

        [ForeignKey("BookingId")]
        public Booking? Booking { get; set; }
    }
}