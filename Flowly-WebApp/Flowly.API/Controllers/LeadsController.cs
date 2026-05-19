using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Services;
using System.Security.Claims;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LeadsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LeadsController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LeadDto>>> GetAllLeads([FromQuery] LeadFilterDto filter)
        {
            var query = _context.Leads.AsQueryable();

            if (!string.IsNullOrEmpty(filter.status) && Enum.TryParse<LeadStatus>(filter.status, true, out var status))
            {
                query = query.Where(l => l.Status == status);
            }

            if (!string.IsNullOrEmpty(filter.source) && Enum.TryParse<LeadSource>(filter.source, true, out var source))
            {
                query = query.Where(l => l.Source == source);
            }

            var leads = await query
                .OrderByDescending(l => l.CreatedAt)
                .Skip(filter.skip ?? 0)
                .Take(filter.take ?? 50)
                .Select(l => new LeadDto
                {
                    Id = l.Id,
                    Name = l.Name,
                    Phone = l.Phone,
                    Email = l.Email,
                    Notes = l.Notes,
                    Source = l.Source,
                    SourceDetails = l.SourceDetails,
                    Status = l.Status,
                    CreatedAt = l.CreatedAt,
                    LastContactedAt = l.LastContactedAt,
                    AssignedToUserId = l.AssignedToUserId,
                    AssignedToUserName = l.AssignedToUser != null ? l.AssignedToUser.FirstName + " " + l.AssignedToUser.LastName : null,
                    ConvertedToBookingId = l.ConvertedToBookingId,
                    PreferredService = l.PreferredService,
                    Gclid = l.Gclid,
                    Fbclid = l.Fbclid,
                    FbLeadId = l.FbLeadId
                })
                .ToListAsync();

            return Ok(leads);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats")]
        public async Task<ActionResult<LeadStatsDto>> GetLeadStats()
        {
            var total = await _context.Leads.CountAsync();
            var newLeads = await _context.Leads.CountAsync(l => l.Status == LeadStatus.New);
            var contacted = await _context.Leads.CountAsync(l => l.Status == LeadStatus.Contacted);
            var interested = await _context.Leads.CountAsync(l => l.Status == LeadStatus.Interested);
            var booked = await _context.Leads.CountAsync(l => l.Status == LeadStatus.Booked);
            var lost = await _context.Leads.CountAsync(l => l.Status == LeadStatus.Lost);

            var sourceBreakdown = await _context.Leads
                .GroupBy(l => l.Source)
                .Select(g => new { Source = g.Key, Count = g.Count() })
                .ToListAsync();

            return Ok(new LeadStatsDto
            {
                Total = total,
                New = newLeads,
                Contacted = contacted,
                Interested = interested,
                Booked = booked,
                Lost = lost,
                SourceBreakdown = sourceBreakdown.Select(s => new SourceCountDto
                {
                    Source = s.Source.ToString(),
                    Count = s.Count
                }).ToList()
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{id}")]
        public async Task<ActionResult<LeadDto>> GetLead(int id)
        {
            var lead = await _context.Leads
                .Include(l => l.AssignedToUser)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (lead == null)
                return NotFound();

            return Ok(new LeadDto
            {
                Id = lead.Id,
                Name = lead.Name,
                Phone = lead.Phone,
                Email = lead.Email,
                Notes = lead.Notes,
                Source = lead.Source,
                SourceDetails = lead.SourceDetails,
                Status = lead.Status,
                CreatedAt = lead.CreatedAt,
                LastContactedAt = lead.LastContactedAt,
                AssignedToUserId = lead.AssignedToUserId,
                AssignedToUserName = lead.AssignedToUser != null ? lead.AssignedToUser.FirstName + " " + lead.AssignedToUser.LastName : null,
                PreferredService = lead.PreferredService,
                UtmCampaign = lead.UtmCampaign,
                UtmContent = lead.UtmContent,
                UtmTerm = lead.UtmTerm,
                Gclid = lead.Gclid,
                Fbclid = lead.Fbclid,
                FbLeadId = lead.FbLeadId
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<LeadDto>> CreateLead(CreateLeadDto dto)
        {
            var lead = new Lead
            {
                Name = dto.Name,
                Phone = dto.Phone,
                Email = dto.Email,
                Notes = dto.Notes,
                Source = dto.Source,
                SourceDetails = dto.SourceDetails,
                PreferredService = dto.PreferredService,
                UtmCampaign = dto.UtmCampaign,
                UtmContent = dto.UtmContent,
                UtmTerm = dto.UtmTerm,
                Gclid = dto.Gclid,
                Fbclid = dto.Fbclid,
                AssignedToUserId = dto.AssignedToUserId
            };

            _context.Leads.Add(lead);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetLead), new { id = lead.Id }, new LeadDto
            {
                Id = lead.Id,
                Name = lead.Name,
                Phone = lead.Phone,
                Email = lead.Email,
                Source = lead.Source,
                Status = lead.Status,
                CreatedAt = lead.CreatedAt
            });
        }

        // Endpoint for Facebook Lead Ads webhook
        [HttpPost("facebook-lead")]
        [AllowAnonymous]
        public async Task<ActionResult> FacebookLead([FromBody] FacebookLeadDto dto)
        {
            var lead = new Lead
            {
                Name = dto.Name ?? "Unknown",
                Phone = dto.Phone ?? "",
                Email = dto.Email,
                Source = LeadSource.Facebook,
                SourceDetails = $"FB Lead ID: {dto.LeadId}",
                FbLeadId = dto.LeadId,
                Fbclid = dto.Fbclid,
                Gclid = dto.Gclid,
                PreferredService = dto.Service
            };

            _context.Leads.Add(lead);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, leadId = lead.Id });
        }

        // Endpoint for Google Local Services Ads
        [HttpPost("google-lsa")]
        [AllowAnonymous]
        public async Task<ActionResult> GoogleLsaLead([FromBody] GoogleLsaLeadDto dto)
        {
            var lead = new Lead
            {
                Name = dto.CustomerName,
                Phone = dto.Phone,
                Email = dto.Email,
                Source = LeadSource.GoogleLSA,
                SourceDetails = $"GLS Ad ID: {dto.AdId}",
                Gclid = dto.Gclid,
                PreferredService = dto.Service
            };

            _context.Leads.Add(lead);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, leadId = lead.Id });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult<LeadDto>> UpdateLead(int id, UpdateLeadDto dto)
        {
            var lead = await _context.Leads.FindAsync(id);
            if (lead == null)
                return NotFound();

            if (!string.IsNullOrEmpty(dto.Name)) lead.Name = dto.Name;
            if (!string.IsNullOrEmpty(dto.Phone)) lead.Phone = dto.Phone;
            if (dto.Email != null) lead.Email = dto.Email;
            if (dto.Notes != null) lead.Notes = dto.Notes;
            if (dto.Source.HasValue) lead.Source = dto.Source.Value;
            if (dto.Status.HasValue)
            {
                lead.Status = dto.Status.Value;
                if (dto.Status == LeadStatus.Contacted && !lead.LastContactedAt.HasValue)
                {
                    lead.LastContactedAt = DateTime.UtcNow;
                }
            }
            if (dto.AssignedToUserId.HasValue) lead.AssignedToUserId = dto.AssignedToUserId;
            if (dto.PreferredService != null) lead.PreferredService = dto.PreferredService;
            if (dto.ConvertedToBookingId.HasValue)
            {
                lead.ConvertedToBookingId = dto.ConvertedToBookingId;
                lead.Status = LeadStatus.Booked;
            }

            await _context.SaveChangesAsync();

            return Ok(new LeadDto
            {
                Id = lead.Id,
                Name = lead.Name,
                Phone = lead.Phone,
                Email = lead.Email,
                Notes = lead.Notes,
                Source = lead.Source,
                SourceDetails = lead.SourceDetails,
                Status = lead.Status,
                CreatedAt = lead.CreatedAt,
                LastContactedAt = lead.LastContactedAt,
                AssignedToUserId = lead.AssignedToUserId,
                ConvertedToBookingId = lead.ConvertedToBookingId
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLead(int id)
        {
            var lead = await _context.Leads.FindAsync(id);
            if (lead == null)
                return NotFound();

            _context.Leads.Remove(lead);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}