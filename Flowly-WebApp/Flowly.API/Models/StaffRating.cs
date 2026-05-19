using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class StaffRating
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int BookingId { get; set; }

        public int WorkerId { get; set; }

        [Range(1, 5)]
        public int Rating { get; set; }

        [StringLength(500)]
        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("BookingId")]
        public Booking Booking { get; set; } = null!;

        [ForeignKey("WorkerId")]
        public Staff Worker { get; set; } = null!;
    }
}
