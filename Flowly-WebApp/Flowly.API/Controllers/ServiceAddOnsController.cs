using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Platform.Tenancy;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ServiceAddOnsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public ServiceAddOnsController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<ServiceAddOnDto>>> GetAll()
        {
            var items = await _db.ServiceAddOns
                .AsNoTracking()
                .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
                .Select(a => new ServiceAddOnDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    Description = a.Description,
                    Price = a.Price,
                    DurationIncreaseMinutes = a.DurationIncreaseMinutes,
                    IsActive = a.IsActive,
                    SortOrder = a.SortOrder
                })
                .ToListAsync();
            return Ok(items);
        }

        [HttpPost]
        public async Task<ActionResult<ServiceAddOnDto>> Create([FromBody] UpsertServiceAddOnDto dto)
        {
            var addOn = new ServiceAddOn
            {
                OrgId = _tenant.OrgId,
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                Price = dto.Price,
                DurationIncreaseMinutes = dto.DurationIncreaseMinutes,
                IsActive = dto.IsActive,
                SortOrder = dto.SortOrder
            };
            _db.ServiceAddOns.Add(addOn);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAll), new ServiceAddOnDto
            {
                Id = addOn.Id,
                Name = addOn.Name,
                Description = addOn.Description,
                Price = addOn.Price,
                DurationIncreaseMinutes = addOn.DurationIncreaseMinutes,
                IsActive = addOn.IsActive,
                SortOrder = addOn.SortOrder
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpsertServiceAddOnDto dto)
        {
            var addOn = await _db.ServiceAddOns.FirstOrDefaultAsync(a => a.Id == id);
            if (addOn == null) return NotFound();

            addOn.Name = dto.Name.Trim();
            addOn.Description = dto.Description?.Trim();
            addOn.Price = dto.Price;
            addOn.DurationIncreaseMinutes = dto.DurationIncreaseMinutes;
            addOn.IsActive = dto.IsActive;
            addOn.SortOrder = dto.SortOrder;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var addOn = await _db.ServiceAddOns.FirstOrDefaultAsync(a => a.Id == id);
            if (addOn == null) return NotFound();
            _db.ServiceAddOns.Remove(addOn);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
