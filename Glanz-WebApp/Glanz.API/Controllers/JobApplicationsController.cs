using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class JobApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public JobApplicationsController(AppDbContext context)
        {
            _context = context;
        }

        // Public: Apply for a job
        [HttpPost]
        public async Task<ActionResult<JobApplicationDto>> Create([FromBody] CreateJobApplicationDto dto)
        {
            try
            {
                var application = new JobApplication
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    Phone = dto.Phone,
                    Address = dto.Address,
                    NationalId = dto.NationalId,
                    DateOfBirth = dto.DateOfBirth,
                    Position = dto.Position,
                    JobPositionId = dto.JobPositionId,
                    Experience = dto.Experience,
                    CoverLetter = dto.CoverLetter,
                    ResumeUrl = dto.ResumeUrl,
                    Status = JobApplicationStatus.Pending,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.JobApplications.Add(application);
                await _context.SaveChangesAsync();

                // Send confirmation email
                await SendApplicationConfirmationEmail(application);

                return Ok(ToDto(application));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Create job application error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit application" });
            }
        }

        // Public: Get open job positions
        [HttpGet("positions")]
        public async Task<ActionResult<List<JobPositionDto>>> GetOpenPositions()
        {
            var positions = await _context.JobPositions
                .Where(p => p.IsOpen)
                .OrderBy(p => p.Rank)
                .ThenBy(p => p.Title)
                .ToListAsync();

            return Ok(positions.Select(ToPositionDto).ToList());
        }

        // Admin: Get all applications
        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<ActionResult<List<JobApplicationDto>>> GetAll(
            [FromQuery] string? status = null,
            [FromQuery] int? positionId = null)
        {
            var query = _context.JobApplications.AsQueryable();

            if (!string.IsNullOrEmpty(status) && Enum.TryParse<JobApplicationStatus>(status, true, out var statusEnum))
            {
                query = query.Where(a => a.Status == statusEnum);
            }

            if (positionId.HasValue)
            {
                query = query.Where(a => a.JobPositionId == positionId);
            }

            var applications = await query
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(applications.Select(ToDto).ToList());
        }

        // Admin: Get application by ID
        [Authorize(Roles = "Admin")]
        [HttpGet("{id}")]
        public async Task<ActionResult<JobApplicationDto>> GetById(int id)
        {
            var application = await _context.JobApplications.FindAsync(id);
            if (application == null)
                return NotFound(new { message = "Application not found" });

            return Ok(ToDto(application));
        }

        // Admin: Update application status
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult<JobApplicationDto>> Update(int id, [FromBody] UpdateJobApplicationDto dto)
        {
            try
            {
                var application = await _context.JobApplications.FindAsync(id);
                if (application == null)
                    return NotFound(new { message = "Application not found" });

                if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<JobApplicationStatus>(dto.Status, true, out var newStatus))
                {
                    application.Status = newStatus;
                }

                application.Notes = dto.Notes ?? application.Notes;
                application.InterviewDate = dto.InterviewDate ?? application.InterviewDate;
                application.RejectionReason = dto.RejectionReason ?? application.RejectionReason;
                application.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Send status update email
                await SendStatusUpdateEmail(application);

                return Ok(ToDto(application));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Update application error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update application" });
            }
        }

        // Admin: Get all positions (including closed)
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/positions")]
        public async Task<ActionResult<List<JobPositionDto>>> GetAllPositions()
        {
            var positions = await _context.JobPositions
                .OrderBy(p => p.Rank)
                .ThenBy(p => p.Title)
                .ToListAsync();

            return Ok(positions.Select(ToPositionDto).ToList());
        }

        // Admin: Create position
        [Authorize(Roles = "Admin")]
        [HttpPost("admin/positions")]
        public async Task<ActionResult<JobPositionDto>> CreatePosition([FromBody] CreateJobPositionDto dto)
        {
            var position = new JobPosition
            {
                Title = dto.Title,
                Description = dto.Description,
                Location = dto.Location,
                Type = dto.Type,
                Department = dto.Department,
                IsOpen = dto.IsOpen,
                Rank = dto.Rank,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.JobPositions.Add(position);
            await _context.SaveChangesAsync();

            return Ok(ToPositionDto(position));
        }

        // Private helpers
        private async Task SendApplicationConfirmationEmail(JobApplication app)
        {
            try
            {
                var subject = "We Received Your Application - Glanz";
                var body = $@"
Dear {app.FirstName},

Thank you for applying to join Glanz! We have received your application for the {app.Position ?? "open position"}.

Our team will review your application and get back to you within 5 business days.

If you have any questions, feel free to reply to this email.

Best regards,
The Glanz Team
                ";

                Console.WriteLine($"[EMAIL] To: {app.Email}");
                Console.WriteLine($"[EMAIL] Subject: {subject}");
                Console.WriteLine($"[EMAIL] Body: {body}");

                app.EmailSent = true;
                app.LastEmailSentAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email send error: {ex.Message}");
            }
        }

        private async Task SendStatusUpdateEmail(JobApplication app)
        {
            try
            {
                string subject, body;

                switch (app.Status)
                {
                    case JobApplicationStatus.UnderReview:
                        subject = "Your Application is Under Review - Glanz";
                        body = $@"Dear {app.FirstName},

Your application is now under review. We'll be in touch soon with an update.

Best regards,
The Glanz Team";
                        break;

                    case JobApplicationStatus.InterviewScheduled:
                        subject = "Interview Scheduled - Glanz";
                        body = $@"Dear {app.FirstName},

Great news! We'd like to invite you for an interview.

{(app.InterviewDate.HasValue ? $"Please arrive on " + app.InterviewDate.Value.ToString("MMMM dd, yyyy 'at' h:mm tt") : "")}

Reply to confirm or reschedule.

Best regards,
The Glanz Team";
                        break;

                    case JobApplicationStatus.Offered:
                        subject = "Congratulations! You've Been Offered a Position - Glanz";
                        body = $@"Dear {app.FirstName},

Congratulations! We're pleased to offer you a position at Glanz.

Please reply to this email to accept the offer and we'll send you next steps.

Welcome to the team!

Best regards,
The Glanz Team";
                        break;

                    case JobApplicationStatus.Rejected:
                        subject = "Update on Your Application - Glanz";
                        body = $@"Dear {app.FirstName},

Thank you for your interest in Glanz and taking the time to apply.

After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current needs.

We wish you the best in your career journey.

Sincerely,
The Glanz Team";
                        break;

                    case JobApplicationStatus.Hired:
                        subject = "Welcome to Glanz! - Onboarding Details";
                        body = $@"Dear {app.FirstName},

Welcome to Glanz! We're thrilled to have you join our team.

Please reply to this email to start your onboarding process.

We can't wait to work with you!

Best regards,
The Glanz Team";
                        break;

                    default:
                        return;
                }

                Console.WriteLine($"[EMAIL] To: {app.Email}");
                Console.WriteLine($"[EMAIL] Subject: {subject}");
                Console.WriteLine($"[EMAIL] Body: {body}");

                app.EmailSent = true;
                app.LastEmailSentAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email send error: {ex.Message}");
            }
        }

        private static JobApplicationDto ToDto(JobApplication a) => new()
        {
            Id = a.Id,
            FirstName = a.FirstName,
            LastName = a.LastName,
            Email = a.Email,
            Phone = a.Phone,
            Address = a.Address,
            NationalId = a.NationalId,
            DateOfBirth = a.DateOfBirth,
            Position = a.Position,
            JobPositionId = a.JobPositionId,
            Experience = a.Experience,
            CoverLetter = a.CoverLetter,
            ResumeUrl = a.ResumeUrl,
            Status = a.Status.ToString(),
            Notes = a.Notes,
            InterviewDate = a.InterviewDate,
            RejectionReason = a.RejectionReason,
            CreatedAt = a.CreatedAt
        };

        private static JobPositionDto ToPositionDto(JobPosition p) => new()
        {
            Id = p.Id,
            Title = p.Title,
            Description = p.Description,
            Location = p.Location,
            Type = p.Type,
            Department = p.Department,
            IsOpen = p.IsOpen,
            Rank = p.Rank,
            CreatedAt = p.CreatedAt
        };
    }
}