using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class AttendanceLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int StaffId { get; set; }

        [ForeignKey(nameof(StaffId))]
        public Staff? Staff { get; set; }

        /// <summary>UTC date the shift is for (truncated to date only for grouping).</summary>
        public DateTime ShiftDate { get; set; }

        public DateTime? ClockIn { get; set; }
        public DateTime? ClockOut { get; set; }

        /// <summary>Optional note recorded at clock-out.</summary>
        [StringLength(500)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
