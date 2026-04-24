using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdminSettingsController : ControllerBase
    {
        private const string FeeEnabledKey = "cancellation.feeEnabled";
        private const string FeeTypeKey    = "cancellation.feeType";
        private const string FeeAmountKey  = "cancellation.feeAmount";
        private const string FreeWindowKey = "cancellation.freeWindowHours";

        private readonly AppDbContext _context;

        public AdminSettingsController(AppDbContext context)
        {
            _context = context;
        }

        private bool IsAdmin()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        // GET api/AdminSettings/cancellation-policy
        [HttpGet("cancellation-policy")]
        public async Task<IActionResult> GetCancellationPolicy()
        {
            if (!IsAdmin()) return Forbid();

            var settings = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.Key == FeeEnabledKey || s.Key == FeeTypeKey || s.Key == FeeAmountKey || s.Key == FreeWindowKey)
                .ToListAsync();

            var dto = BuildPolicyDto(settings);
            return Ok(dto);
        }

        // PUT api/AdminSettings/cancellation-policy
        [HttpPut("cancellation-policy")]
        public async Task<IActionResult> UpdateCancellationPolicy([FromBody] CancellationPolicyDto dto)
        {
            if (!IsAdmin()) return Forbid();

            if (!string.Equals(dto.FeeType, "Percent", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(dto.FeeType, "Flat", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "FeeType must be 'Percent' or 'Flat'." });
            }

            if (dto.FeeAmount < 0)
                return BadRequest(new { message = "Fee amount cannot be negative." });

            if (string.Equals(dto.FeeType, "Percent", StringComparison.OrdinalIgnoreCase) && dto.FeeAmount > 100)
                return BadRequest(new { message = "Percentage fee cannot exceed 100%." });

            if (dto.FreeWindowHours < 0)
                return BadRequest(new { message = "Free cancellation window cannot be negative." });

            await UpsertSettingAsync(FeeEnabledKey, dto.FeeEnabled.ToString());
            await UpsertSettingAsync(FeeTypeKey,    dto.FeeType);
            await UpsertSettingAsync(FeeAmountKey,  dto.FeeAmount.ToString("F2"));
            await UpsertSettingAsync(FreeWindowKey, dto.FreeWindowHours.ToString());

            await _context.SaveChangesAsync();

            var updated = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.Key == FeeEnabledKey || s.Key == FeeTypeKey || s.Key == FeeAmountKey || s.Key == FreeWindowKey)
                .ToListAsync();

            return Ok(BuildPolicyDto(updated));
        }

        // ── helpers ─────────────────────────────────────────────────────────

        private static CancellationPolicyDto BuildPolicyDto(List<SystemSetting> settings)
        {
            string Get(string key) => settings.FirstOrDefault(s => s.Key == key)?.Value ?? string.Empty;

            bool feeEnabled = bool.TryParse(Get(FeeEnabledKey), out var fe) ? fe : false;
            string feeType  = Get(FeeTypeKey) is { Length: > 0 } ft ? ft : "Percent";
            decimal feeAmt  = decimal.TryParse(Get(FeeAmountKey), out var fa) ? fa : 0m;
            int freeHrs     = int.TryParse(Get(FreeWindowKey), out var fh) ? fh : 24;

            return new CancellationPolicyDto
            {
                FeeEnabled      = feeEnabled,
                FeeType         = feeType,
                FeeAmount       = feeAmt,
                FreeWindowHours = freeHrs,
            };
        }

        private async Task UpsertSettingAsync(string key, string value)
        {
            var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (setting == null)
            {
                _context.SystemSettings.Add(new SystemSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
            }
            else
            {
                setting.Value     = value;
                setting.UpdatedAt = DateTime.UtcNow;
            }
        }
    }
}
