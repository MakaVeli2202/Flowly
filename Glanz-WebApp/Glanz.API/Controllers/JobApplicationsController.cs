using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Controllers
{
    public class SubmitJobApplicationDto
    {
        [Required, StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required, StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Phone, StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? NationalId { get; set; }

        public DateTime? DateOfBirth { get; set; }

        public int? JobPositionId { get; set; }

        [StringLength(1000)]
        public string? Experience { get; set; }

        [StringLength(2000)]
        public string? CoverLetter { get; set; }

        public string? ResumeUrl { get; set; }
    }

    public class UpdateApplicationStatusDto
    {
        [Required]
        public JobApplicationStatus Status { get; set; }

        [StringLength(1000)]
        public string? Notes { get; set; }

        public DateTime? InterviewDate { get; set; }

        [StringLength(500)]
        public string? RejectionReason { get; set; }
    }

    public class UpsertJobPositionDto
    {
        [Required, StringLength(200)]
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
    }

    [ApiController]
    [Route("api/job-positions")]
    public class JobPositionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public JobPositionsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetOpenPositions()
        {
            var positions = await _context.JobPositions
                .Where(p => p.IsOpen)
                .OrderBy(p => p.Rank)
                .Select(p => new
                {
                    p.Id, p.Title, p.Description, p.Location, p.Type, p.Department, p.IsOpen, p.Rank, p.CreatedAt
                })
                .ToListAsync();
            return Ok(positions);
        }
    }

    [ApiController]
    [Route("api/job-applications")]
    public class JobApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public JobApplicationsController(AppDbContext context) => _context = context;

        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] SubmitJobApplicationDto dto)
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
                JobPositionId = dto.JobPositionId,
                Experience = dto.Experience,
                CoverLetter = dto.CoverLetter,
                ResumeUrl = dto.ResumeUrl,
                Status = JobApplicationStatus.Pending
            };

            _context.JobApplications.Add(application);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Application submitted", applicationId = application.Id });
        }
    }

    [ApiController]
    [Route("api/admin/job-applications")]
    [Authorize(Roles = "Admin")]
    public class AdminJobApplicationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminJobApplicationsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] JobApplicationStatus? status, [FromQuery] int? positionId)
        {
            var query = _context.JobApplications
                .Include(a => a.JobPosition)
                .AsQueryable();

            if (status.HasValue)
                query = query.Where(a => a.Status == status.Value);

            if (positionId.HasValue)
                query = query.Where(a => a.JobPositionId == positionId.Value);

            var applications = await query
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id, a.FirstName, a.LastName, a.Email, a.Phone, a.Status,
                    a.InterviewDate, a.CreatedAt, a.EmailSent,
                    position = a.JobPosition != null ? new { a.JobPosition.Id, a.JobPosition.Title } : null
                })
                .ToListAsync();

            return Ok(applications);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var application = await _context.JobApplications
                .Include(a => a.JobPosition)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (application == null)
                return NotFound(new { message = "Application not found" });

            return Ok(application);
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateApplicationStatusDto dto)
        {
            var application = await _context.JobApplications.FindAsync(id);
            if (application == null)
                return NotFound(new { message = "Application not found" });

            application.Status = dto.Status;
            application.Notes = dto.Notes ?? application.Notes;
            application.InterviewDate = dto.InterviewDate ?? application.InterviewDate;
            application.RejectionReason = dto.RejectionReason ?? application.RejectionReason;
            application.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Status updated", status = application.Status.ToString() });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var application = await _context.JobApplications.FindAsync(id);
            if (application == null)
                return NotFound(new { message = "Application not found" });

            _context.JobApplications.Remove(application);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Application deleted" });
        }
    }

    [ApiController]
    [Route("api/admin/job-positions")]
    [Authorize(Roles = "Admin")]
    public class AdminJobPositionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminJobPositionsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var positions = await _context.JobPositions
                .OrderBy(p => p.Rank)
                .Select(p => new
                {
                    p.Id, p.Title, p.Description, p.Location, p.Type, p.Department,
                    p.IsOpen, p.Rank, p.CreatedAt,
                    applicationCount = p.Applications.Count
                })
                .ToListAsync();
            return Ok(positions);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] UpsertJobPositionDto dto)
        {
            var position = new JobPosition
            {
                Title = dto.Title,
                Description = dto.Description,
                Location = dto.Location,
                Type = dto.Type,
                Department = dto.Department,
                IsOpen = dto.IsOpen,
                Rank = dto.Rank
            };

            _context.JobPositions.Add(position);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Position created", id = position.Id });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpsertJobPositionDto dto)
        {
            var position = await _context.JobPositions.FindAsync(id);
            if (position == null)
                return NotFound(new { message = "Position not found" });

            position.Title = dto.Title;
            position.Description = dto.Description;
            position.Location = dto.Location;
            position.Type = dto.Type;
            position.Department = dto.Department;
            position.IsOpen = dto.IsOpen;
            position.Rank = dto.Rank;
            position.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Position updated" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var position = await _context.JobPositions.FindAsync(id);
            if (position == null)
                return NotFound(new { message = "Position not found" });

            _context.JobPositions.Remove(position);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Position deleted" });
        }
    }
}
