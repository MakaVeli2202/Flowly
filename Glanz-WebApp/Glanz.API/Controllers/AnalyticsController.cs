using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private static readonly TimeSpan ActiveWindow = TimeSpan.FromMinutes(5);

        public AnalyticsController(AppDbContext db)
        {
            _db = db;
        }

        // ── Public: track a page view ─────────────────────────────────────────

        public record TrackDto(
            string SessionId,
            string Page,
            string Source,
            string? Referrer,
            string DeviceType,
            bool IsNewVisitor
        );

        [HttpPost("track")]
        public async Task<IActionResult> Track([FromBody] TrackDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.SessionId) || dto.SessionId.Length > 64)
                return BadRequest();

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var today = DateTime.UtcNow.Date;

            var existing = await _db.PageViews
                .FirstOrDefaultAsync(p =>
                    p.SessionId == dto.SessionId &&
                    p.Page == dto.Page &&
                    p.FirstSeen >= today);

            if (existing is not null)
            {
                existing.LastHeartbeat = DateTime.UtcNow;
            }
            else
            {
                _db.PageViews.Add(new PageView
                {
                    SessionId    = dto.SessionId,
                    Page         = dto.Page ?? "/",
                    Source       = dto.Source ?? "Direct",
                    Referrer     = dto.Referrer,
                    DeviceType   = dto.DeviceType ?? "Desktop",
                    IsNewVisitor = dto.IsNewVisitor,
                    IpAddress    = ip,
                    FirstSeen    = DateTime.UtcNow,
                    LastHeartbeat = DateTime.UtcNow,
                });
            }

            await _db.SaveChangesAsync();
            return Ok();
        }

        // ── Public: heartbeat to keep session alive ───────────────────────────

        [HttpPut("heartbeat/{sessionId}")]
        public async Task<IActionResult> Heartbeat(string sessionId)
        {
            if (string.IsNullOrWhiteSpace(sessionId) || sessionId.Length > 64)
                return BadRequest();

            var cutoff = DateTime.UtcNow - TimeSpan.FromMinutes(30);
            var rows = await _db.PageViews
                .Where(p => p.SessionId == sessionId && p.LastHeartbeat >= cutoff)
                .ToListAsync();

            foreach (var r in rows)
                r.LastHeartbeat = DateTime.UtcNow;

            if (rows.Count > 0)
                await _db.SaveChangesAsync();

            return Ok();
        }

        // ── Admin: live visitor snapshot ──────────────────────────────────────

        [HttpGet("live")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetLive()
        {
            var since = DateTime.UtcNow - ActiveWindow;

            var active = await _db.PageViews
                .Where(p => p.LastHeartbeat >= since)
                .ToListAsync();

            var sessions = active
                .GroupBy(p => p.SessionId)
                .Select(g => g.OrderByDescending(p => p.LastHeartbeat).First())
                .ToList();

            return Ok(new
            {
                activeNow = sessions.Count,
                sources = sessions
                    .GroupBy(p => p.Source)
                    .Select(g => new { source = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count),
                devices = sessions
                    .GroupBy(p => p.DeviceType)
                    .Select(g => new { device = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count),
                pages = active
                    .GroupBy(p => p.Page)
                    .Select(g => new { page = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .Take(10),
            });
        }

        // ── Admin: historical stats ───────────────────────────────────────────

        [HttpGet("stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetStats(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var start = (from ?? DateTime.UtcNow.AddDays(-7)).Date;
            var end   = (to   ?? DateTime.UtcNow).Date.AddDays(1);

            var rows = await _db.PageViews
                .Where(p => p.FirstSeen >= start && p.FirstSeen < end)
                .ToListAsync();

            var uniqueSessions = rows.Select(p => p.SessionId).Distinct().Count();
            var newVisitors    = rows.Where(p => p.IsNewVisitor).Select(p => p.SessionId).Distinct().Count();

            // Hourly breakdown (for single-day view) or daily (multi-day)
            var rangeDays = (end - start).TotalDays;

            object timeline;
            if (rangeDays <= 1)
            {
                timeline = rows
                    .GroupBy(p => p.FirstSeen.Hour)
                    .Select(g => new { label = $"{g.Key:00}:00", views = g.Count() })
                    .OrderBy(x => x.label);
            }
            else
            {
                timeline = rows
                    .GroupBy(p => p.FirstSeen.Date)
                    .Select(g => new { label = g.Key.ToString("MMM dd"), views = g.Count() })
                    .OrderBy(x => x.label);
            }

            return Ok(new
            {
                totalViews        = rows.Count,
                uniqueVisitors    = uniqueSessions,
                newVisitors       = newVisitors,
                returningVisitors = uniqueSessions - newVisitors,
                sources = rows
                    .GroupBy(p => p.Source)
                    .Select(g => new { source = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count),
                devices = rows
                    .GroupBy(p => p.DeviceType)
                    .Select(g => new { device = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count),
                topPages = rows
                    .GroupBy(p => p.Page)
                    .Select(g => new { page = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .Take(10),
                timeline,
            });
        }
    }
}
