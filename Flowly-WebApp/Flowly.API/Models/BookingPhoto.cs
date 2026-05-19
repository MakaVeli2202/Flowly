using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public enum PhotoType { Before, After }

    public class BookingPhoto
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int BookingId { get; set; }

        [Required]
        public PhotoType PhotoType { get; set; }

        [Required]
        [StringLength(1000)]
        public string ImageUrl { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Caption { get; set; }

        public int? UploadedByWorkerId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("BookingId")]
        public Booking? Booking { get; set; }

        [ForeignKey("UploadedByWorkerId")]
        public User? UploadedByWorker { get; set; }
    }
}
