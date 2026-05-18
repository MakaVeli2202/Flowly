using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class ServiceAddOn
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(150)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        public int DurationIncreaseMinutes { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; } = 0;

        public Organization Organization { get; set; } = null!;
        public ICollection<BookingAddOn> BookingAddOns { get; set; } = new List<BookingAddOn>();
    }

    public class BookingAddOn
    {
        [Key]
        public int Id { get; set; }

        public int BookingId { get; set; }

        public int AddOnId { get; set; }

        [Required]
        [StringLength(150)]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "decimal(10,2)")]
        public decimal Price { get; set; }

        [ForeignKey("BookingId")]
        public Booking Booking { get; set; } = null!;

        [ForeignKey("AddOnId")]
        public ServiceAddOn AddOn { get; set; } = null!;
    }
}
