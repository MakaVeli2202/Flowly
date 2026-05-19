using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class BookingChecklistItem
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int BookingId { get; set; }

        [Required]
        [StringLength(200)]
        public string Label { get; set; } = string.Empty;

        [Required]
        public int DisplayOrder { get; set; }

        public bool IsCompleted { get; set; } = false;

        public DateTime? CompletedAt { get; set; }

        [ForeignKey("BookingId")]
        public Booking Booking { get; set; } = null!;
    }
}
