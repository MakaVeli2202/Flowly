using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Platform.Tenancy;
using System.ComponentModel.DataAnnotations;
using Flowly.API.Services;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoyaltyController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public LoyaltyController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // Customer: get my loyalty balance
        [Authorize(Roles = "Customer")]
        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var config = await GetConfig();
            var account = await _db.LoyaltyAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId.Value);

            return Ok(new
            {
                balance = account?.Balance ?? 0,
                lifetimeEarned = account?.LifetimeEarned ?? 0,
                lifetimeRedeemed = account?.LifetimeRedeemed ?? 0,
                redemptionRateQar = config.RedemptionRateQar,
                pointsPerQar = config.PointsPerQar,
                minRedemptionPoints = config.MinRedemptionPoints,
                maxRedemptionPct = config.MaxRedemptionPct,
                isEnabled = config.IsEnabled
            });
        }

        // Customer: get transaction history
        [Authorize(Roles = "Customer")]
        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var txns = await _db.LoyaltyTransactions
                .AsNoTracking()
                .Where(t => t.UserId == userId.Value)
                .OrderByDescending(t => t.CreatedAt)
                .Take(50)
                .Select(t => new { t.Points, t.Type, t.Description, t.CreatedAt, t.BookingId })
                .ToListAsync();
            return Ok(txns);
        }

        // Admin: get / update loyalty config
        [Authorize(Roles = "Admin")]
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig_Admin()
        {
            var cfg = await GetConfig();
            return Ok(cfg);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("config")]
        public async Task<IActionResult> UpdateConfig([FromBody] LoyaltyConfigDto dto)
        {
            var cfg = await _db.OrgLoyaltyConfigs.FindAsync(_tenant.OrgId);
            if (cfg == null)
            {
                cfg = new OrgLoyaltyConfig { OrgId = _tenant.OrgId };
                _db.OrgLoyaltyConfigs.Add(cfg);
            }
            cfg.IsEnabled = dto.IsEnabled;
            cfg.PointsPerQar = Math.Max(0.01m, dto.PointsPerQar);
            cfg.RedemptionRateQar = Math.Max(0.001m, dto.RedemptionRateQar);
            cfg.MinRedemptionPoints = Math.Max(1, dto.MinRedemptionPoints);
            cfg.MaxRedemptionPct = Math.Clamp(dto.MaxRedemptionPct, 1, 100);
            cfg.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(cfg);
        }

        // Admin: view customer loyalty account
        [Authorize(Roles = "Admin")]
        [HttpGet("customer/{userId}")]
        public async Task<IActionResult> GetCustomerBalance(int userId)
        {
            var account = await _db.LoyaltyAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId);
            return Ok(new
            {
                balance = account?.Balance ?? 0,
                lifetimeEarned = account?.LifetimeEarned ?? 0,
                lifetimeRedeemed = account?.LifetimeRedeemed ?? 0
            });
        }

        private async Task<OrgLoyaltyConfig> GetConfig()
        {
            return await _db.OrgLoyaltyConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.OrgId == _tenant.OrgId)
                ?? new OrgLoyaltyConfig { OrgId = _tenant.OrgId };
        }
    }

    public class LoyaltyConfigDto
    {
        public bool IsEnabled { get; set; } = true;
        [Range(0.01, 100)]
        public decimal PointsPerQar { get; set; } = 1m;
        [Range(0.001, 10)]
        public decimal RedemptionRateQar { get; set; } = 0.05m;
        [Range(1, 100000)]
        public int MinRedemptionPoints { get; set; } = 100;
        [Range(1, 100)]
        public int MaxRedemptionPct { get; set; } = 50;
    }
}
