using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class StaffCertificationsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public StaffCertificationsController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        [HttpGet("{workerId}")]
        public async Task<IActionResult> GetForWorker(int workerId)
        {
            var certs = await _db.StaffCertifications
                .AsNoTracking()
                .Where(c => c.WorkerId == workerId)
                .OrderByDescending(c => c.ExpiryDate)
                .Select(c => new CertDto
                {
                    Id = c.Id,
                    WorkerId = c.WorkerId,
                    Name = c.Name,
                    IssuingBody = c.IssuingBody,
                    IssuedDate = c.IssuedDate,
                    ExpiryDate = c.ExpiryDate,
                    CertificateUrl = c.CertificateUrl,
                    IsExpired = c.ExpiryDate.HasValue && c.ExpiryDate.Value < DateTime.UtcNow,
                    ExpiringWithin30Days = c.ExpiryDate.HasValue
                        && c.ExpiryDate.Value > DateTime.UtcNow
                        && c.ExpiryDate.Value <= DateTime.UtcNow.AddDays(30)
                })
                .ToListAsync();
            return Ok(certs);
        }

        [HttpGet("expiring")]
        public async Task<IActionResult> GetExpiringSoon([FromQuery] int days = 30)
        {
            var threshold = DateTime.UtcNow.AddDays(days);
            var certs = await _db.StaffCertifications
                .AsNoTracking()
                .Include(c => c.Worker)
                .Where(c => c.ExpiryDate.HasValue && c.ExpiryDate.Value <= threshold && c.ExpiryDate.Value >= DateTime.UtcNow)
                .OrderBy(c => c.ExpiryDate)
                .Select(c => new CertDto
                {
                    Id = c.Id,
                    WorkerId = c.WorkerId,
                    WorkerName = $"{c.Worker.FirstName} {c.Worker.LastName}".Trim(),
                    Name = c.Name,
                    IssuingBody = c.IssuingBody,
                    IssuedDate = c.IssuedDate,
                    ExpiryDate = c.ExpiryDate,
                    CertificateUrl = c.CertificateUrl,
                    IsExpired = false,
                    ExpiringWithin30Days = true
                })
                .ToListAsync();
            return Ok(certs);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] UpsertCertDto dto)
        {
            var cert = new StaffCertification
            {
                OrgId = _tenant.OrgId,
                WorkerId = dto.WorkerId,
                Name = dto.Name.Trim(),
                IssuingBody = dto.IssuingBody?.Trim(),
                IssuedDate = dto.IssuedDate,
                ExpiryDate = dto.ExpiryDate,
                CertificateUrl = dto.CertificateUrl?.Trim()
            };
            _db.StaffCertifications.Add(cert);
            await _db.SaveChangesAsync();
            return Ok(new { cert.Id });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpsertCertDto dto)
        {
            var cert = await _db.StaffCertifications.FirstOrDefaultAsync(c => c.Id == id);
            if (cert == null) return NotFound();
            cert.Name = dto.Name.Trim();
            cert.IssuingBody = dto.IssuingBody?.Trim();
            cert.IssuedDate = dto.IssuedDate;
            cert.ExpiryDate = dto.ExpiryDate;
            cert.CertificateUrl = dto.CertificateUrl?.Trim();
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var cert = await _db.StaffCertifications.FirstOrDefaultAsync(c => c.Id == id);
            if (cert == null) return NotFound();
            _db.StaffCertifications.Remove(cert);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class CertDto
    {
        public int Id { get; set; }
        public int WorkerId { get; set; }
        public string? WorkerName { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? IssuingBody { get; set; }
        public DateTime? IssuedDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? CertificateUrl { get; set; }
        public bool IsExpired { get; set; }
        public bool ExpiringWithin30Days { get; set; }
    }

    public class UpsertCertDto
    {
        public int WorkerId { get; set; }
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;
        [StringLength(200)]
        public string? IssuingBody { get; set; }
        public DateTime? IssuedDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        [StringLength(1000)]
        public string? CertificateUrl { get; set; }
    }
}
