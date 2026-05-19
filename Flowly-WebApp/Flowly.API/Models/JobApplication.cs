using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public enum JobApplicationStatus
    {
        Pending,
        UnderReview,
        InterviewScheduled,
        Offered,
        Hired,
        Rejected,
        Withdrawn
    }

    public class JobApplication
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Phone]
        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? NationalId { get; set; }

        public DateTime? DateOfBirth { get; set; }

        [StringLength(100)]
        public string? Position { get; set; }

        public int? JobPositionId { get; set; }
        [ForeignKey(nameof(JobPositionId))]
        public JobPosition? JobPosition { get; set; }

        [StringLength(1000)]
        public string? Experience { get; set; }

        [StringLength(2000)]
        public string? CoverLetter { get; set; }

        public string? ResumeUrl { get; set; }

        public JobApplicationStatus Status { get; set; } = JobApplicationStatus.Pending;

        [StringLength(1000)]
        public string? Notes { get; set; }

        public DateTime? InterviewDate { get; set; }

        [StringLength(500)]
        public string? RejectionReason { get; set; }

        public bool EmailSent { get; set; } = false;
        public DateTime? LastEmailSentAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class JobPosition
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }

        [StringLength(100)]
        public string? Location { get; set; }

        [StringLength(100)]
        public string? Type { get; set; }

        [StringLength(100)]
        public string? Department { get; set; }

        public bool IsOpen { get; set; } = true;

        public int Rank { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    }
}