using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class Availability
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        public DateTime Date { get; set; }

        [Required]
        [StringLength(20)]
        public string TimeSlot { get; set; } = string.Empty;

        [Required]
        public int MaxBookings { get; set; } = 3;

        public int CurrentBookings { get; set; } = 0;

        public bool IsAvailable { get; set; } = true;
    }
}
