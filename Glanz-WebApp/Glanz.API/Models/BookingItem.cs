using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class BookingItem
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public int BookingId { get; set; }

        [Required]
        public int PackageId { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        [Required]
        public int Quantity { get; set; } = 1;

        /// <summary>
        /// Duration frozen at booking creation time from Package.EstimatedDurationMinutes.
        /// Used by the scheduler so that later edits to the package catalog never silently
        /// alter the time-conflict window of an existing booking.  0 means legacy row
        /// (pre-migration); the scheduler falls back to the live package value in that case.
        /// </summary>
        public int SnapshotDurationMinutes { get; set; } = 0;

        [Column(TypeName = "decimal(10,2)")]
        public decimal ItemCost { get; set; } = 0;

        // Navigation properties
        [ForeignKey("BookingId")]
        public Booking Booking { get; set; } = null!;

        [ForeignKey("PackageId")]
        public Package Package { get; set; } = null!;
    }
}