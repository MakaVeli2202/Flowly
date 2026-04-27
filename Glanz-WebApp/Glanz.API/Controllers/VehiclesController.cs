using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VehiclesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VehiclesController(AppDbContext context)
        {
            _context = context;
        }

        private int GetUserId() =>
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private static VehicleDto ToDto(Vehicle v) => new()
        {
            Id           = v.Id,
            Nickname     = v.Nickname,
            Make         = v.Make,
            Model        = v.Model,
            Year         = v.Year,
            Color        = v.Color,
            PlateNumber  = v.PlateNumber,
            VehicleType  = v.VehicleType.ToString(),
            ImageUrl     = v.ImageUrl,
            IsDefault    = v.IsDefault,
            CreatedAt    = v.CreatedAt,
        };

        // GET api/Vehicles
        [HttpGet]
        public async Task<ActionResult<IEnumerable<VehicleDto>>> GetMyVehicles()
        {
            var userId = GetUserId();
            var vehicles = await _context.Vehicles
                .AsNoTracking()
                .Where(v => v.UserId == userId)
                .OrderByDescending(v => v.IsDefault)
                .ThenBy(v => v.CreatedAt)
                .ToListAsync();
            return Ok(vehicles.Select(ToDto));
        }

        // GET api/Vehicles/5
        [HttpGet("{id:int}")]
        public async Task<ActionResult<VehicleDto>> GetVehicle(int id)
        {
            var userId  = GetUserId();
            var vehicle = await _context.Vehicles.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vehicle == null) return NotFound();
            return Ok(ToDto(vehicle));
        }

        // POST api/Vehicles
        [HttpPost]
        public async Task<ActionResult<VehicleDto>> CreateVehicle([FromBody] CreateVehicleDto dto)
        {
            var userId = GetUserId();

            // If this is the first vehicle, make it default automatically
            var count = await _context.Vehicles.CountAsync(v => v.UserId == userId);
            var isDefault = dto.IsDefault || count == 0;

            if (isDefault)
                await ClearDefaultAsync(userId);

            var vehicle = new Vehicle
            {
                UserId      = userId,
                Nickname    = dto.Nickname?.Trim(),
                Make        = dto.Make?.Trim(),
                Model       = dto.Model?.Trim(),
                Year        = dto.Year?.Trim(),
                Color       = dto.Color?.Trim(),
                PlateNumber = dto.PlateNumber?.Trim(),
                VehicleType = dto.VehicleType,
                IsDefault   = isDefault,
            };

            _context.Vehicles.Add(vehicle);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, ToDto(vehicle));
        }

        // PUT api/Vehicles/5
        [HttpPut("{id:int}")]
        public async Task<ActionResult<VehicleDto>> UpdateVehicle(int id, [FromBody] UpdateVehicleDto dto)
        {
            var userId  = GetUserId();
            var vehicle = await _context.Vehicles
                .FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vehicle == null) return NotFound();

            if (dto.IsDefault && !vehicle.IsDefault)
                await ClearDefaultAsync(userId);

            vehicle.Nickname    = dto.Nickname?.Trim();
            vehicle.Make        = dto.Make?.Trim();
            vehicle.Model       = dto.Model?.Trim();
            vehicle.Year        = dto.Year?.Trim();
            vehicle.Color       = dto.Color?.Trim();
            vehicle.PlateNumber = dto.PlateNumber?.Trim();
            vehicle.VehicleType = dto.VehicleType;
            vehicle.IsDefault   = dto.IsDefault;

            await _context.SaveChangesAsync();
            return Ok(ToDto(vehicle));
        }

        // DELETE api/Vehicles/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteVehicle(int id)
        {
            var userId  = GetUserId();
            var vehicle = await _context.Vehicles
                .FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vehicle == null) return NotFound();

            _context.Vehicles.Remove(vehicle);
            await _context.SaveChangesAsync();

            // If we just deleted the default, promote the oldest remaining
            if (vehicle.IsDefault)
            {
                var next = await _context.Vehicles
                    .Where(v => v.UserId == userId)
                    .OrderBy(v => v.CreatedAt)
                    .FirstOrDefaultAsync();
                if (next != null) { next.IsDefault = true; await _context.SaveChangesAsync(); }
            }

            return NoContent();
        }

        // PUT api/Vehicles/5/default
        [HttpPut("{id:int}/default")]
        public async Task<ActionResult<VehicleDto>> SetDefault(int id)
        {
            var userId  = GetUserId();
            var vehicle = await _context.Vehicles
                .FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vehicle == null) return NotFound();

            await ClearDefaultAsync(userId);
            vehicle.IsDefault = true;
            await _context.SaveChangesAsync();
            return Ok(ToDto(vehicle));
        }

        // POST api/Vehicles/5/image
        [HttpPost("{id:int}/image")]
        [RequestSizeLimit(2_000_000)]
        public async Task<ActionResult<VehicleDto>> UploadImage(int id, [FromForm] UploadVehicleImageDto dto)
        {
            var userId  = GetUserId();
            var vehicle = await _context.Vehicles
                .FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);
            if (vehicle == null) return NotFound();

            var file = dto.Image;
            if (file.Length == 0)
                return BadRequest(new { message = "Empty file." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp"))
                return BadRequest(new { message = "Only jpg, png, or webp allowed." });

            var uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "vehicles");
            Directory.CreateDirectory(uploadsRoot);

            // Delete old image
            if (!string.IsNullOrWhiteSpace(vehicle.ImageUrl)
                && vehicle.ImageUrl.StartsWith("/uploads/vehicles/", StringComparison.OrdinalIgnoreCase))
            {
                var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", vehicle.ImageUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }

            var fileName  = $"vehicle_{userId}_{id}_{Guid.NewGuid():N}{ext}";
            var filePath  = Path.Combine(uploadsRoot, fileName);
            using var stream = System.IO.File.Create(filePath);
            await file.CopyToAsync(stream);

            vehicle.ImageUrl = $"/uploads/vehicles/{fileName}";
            await _context.SaveChangesAsync();
            return Ok(ToDto(vehicle));
        }

        // ── Helpers ──────────────────────────────────────────────────────────────

        private async Task ClearDefaultAsync(int userId)
        {
            await _context.Vehicles
                .Where(v => v.UserId == userId && v.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.IsDefault, false));
        }
    }
}
