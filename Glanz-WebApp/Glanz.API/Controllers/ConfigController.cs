using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private static readonly string[] KnownFlags =
    [
        "payments", "subscriptions", "slotReservation",
        "smartAssignment", "loyalty", "favoriteDetailer",
    ];

    private readonly AppDbContext _context;
    public ConfigController(AppDbContext context) => _context = context;

    [HttpGet("features")]
    public async Task<IActionResult> GetFeatures()
    {
        var keys = KnownFlags.Select(f => $"features.{f}").ToList();
        var rows = await _context.SystemSettings
            .AsNoTracking()
            .Where(s => keys.Contains(s.Key))
            .ToListAsync();

        var dict = new Dictionary<string, bool>();
        foreach (var flag in KnownFlags)
        {
            var row = rows.FirstOrDefault(r => r.Key == $"features.{flag}");
            dict[flag] = row != null && (row.Value == "true" || row.Value == "True");
        }
        return Ok(dict);
    }

    [HttpPut("features/{flag}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetFeatureFlag(string flag, [FromBody] SetFeatureFlagDto dto)
    {
        if (!KnownFlags.Contains(flag))
            return BadRequest(new { message = $"Unknown feature flag: {flag}" });

        var key = $"features.{flag}";
        var existing = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (existing != null)
        {
            existing.Value     = dto.Enabled ? "true" : "false";
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.SystemSettings.Add(new SystemSetting
            {
                Key       = key,
                Value     = dto.Enabled ? "true" : "false",
                UpdatedAt = DateTime.UtcNow,
            });
        }
        await _context.SaveChangesAsync();
        return Ok(new { flag, enabled = dto.Enabled });
    }
}

public class SetFeatureFlagDto
{
    public bool Enabled { get; set; }
}
