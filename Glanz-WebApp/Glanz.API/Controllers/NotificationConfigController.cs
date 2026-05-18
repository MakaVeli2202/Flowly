using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class NotificationConfigController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly TenantContext _tenant;

        public NotificationConfigController(AppDbContext context, TenantContext tenant)
        {
            _context = context;
            _tenant = tenant;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var cfg = await _context.OrgNotificationConfigs.FindAsync(_tenant.OrgId)
                      ?? new OrgNotificationConfig { OrgId = _tenant.OrgId };
            return Ok(cfg);
        }

        [HttpPut]
        public async Task<IActionResult> Update([FromBody] OrgNotificationConfig dto)
        {
            var cfg = await _context.OrgNotificationConfigs.FindAsync(_tenant.OrgId);
            if (cfg == null)
            {
                cfg = new OrgNotificationConfig { OrgId = _tenant.OrgId };
                _context.OrgNotificationConfigs.Add(cfg);
            }

            cfg.BirthdayOfferEnabled        = dto.BirthdayOfferEnabled;
            cfg.BirthdayDiscountPct         = Math.Clamp(dto.BirthdayDiscountPct, 0, 100);
            cfg.BirthdayMessageTemplate     = dto.BirthdayMessageTemplate?.Trim() ?? cfg.BirthdayMessageTemplate;
            cfg.AnniversaryOfferEnabled     = dto.AnniversaryOfferEnabled;
            cfg.AnniversaryDiscountPct      = Math.Clamp(dto.AnniversaryDiscountPct, 0, 100);
            cfg.AnniversaryMessageTemplate  = dto.AnniversaryMessageTemplate?.Trim() ?? cfg.AnniversaryMessageTemplate;
            cfg.ReviewRequestEnabled        = dto.ReviewRequestEnabled;
            cfg.ReviewRequestDelayHours     = Math.Clamp(dto.ReviewRequestDelayHours, 0, 72);
            cfg.ReviewRequestTemplate       = dto.ReviewRequestTemplate?.Trim() ?? cfg.ReviewRequestTemplate;
            cfg.ReminderEnabled             = dto.ReminderEnabled;
            cfg.ReminderHoursBefore         = Math.Clamp(dto.ReminderHoursBefore, 1, 72);
            cfg.ReminderTemplate            = dto.ReminderTemplate?.Trim() ?? cfg.ReminderTemplate;
            cfg.EscalationEnabled           = dto.EscalationEnabled;
            cfg.EscalationHoursBefore       = Math.Clamp(dto.EscalationHoursBefore, 1, 24);
            cfg.EscalationTemplate          = dto.EscalationTemplate?.Trim() ?? cfg.EscalationTemplate;
            cfg.UpdatedAt                   = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(cfg);
        }
    }
}
