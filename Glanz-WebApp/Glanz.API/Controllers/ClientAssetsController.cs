using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Modules.ClientAssets;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClientAssetsController : ControllerBase
    {
        private readonly IClientAssetService _clientAssets;
        private readonly TenantContext _tenantContext;
        private readonly AppDbContext _db;

        public ClientAssetsController(IClientAssetService clientAssets, TenantContext tenantContext, AppDbContext db)
        {
            _clientAssets = clientAssets;
            _tenantContext = tenantContext;
            _db = db;
        }

        private int GetUserId() => User.GetCurrentUserId();

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClientAssetDto>>> GetMyAssets()
        {
            return Ok(await _clientAssets.GetAssetsAsync(_tenantContext.OrgId, GetUserId()));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<ClientAssetDto>> GetAsset(int id)
        {
            var (result, error, statusCode) = await _clientAssets.GetAssetAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult<ClientAssetDto>> CreateAsset([FromBody] CreateClientAssetDto dto)
        {
            var (result, error, statusCode) = await _clientAssets.CreateAssetAsync(_tenantContext.OrgId, GetUserId(), dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return CreatedAtAction(nameof(GetAsset), new { id = result!.Id }, result);
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<ClientAssetDto>> UpdateAsset(int id, [FromBody] UpdateClientAssetDto dto)
        {
            var (result, error, statusCode) = await _clientAssets.UpdateAssetAsync(_tenantContext.OrgId, GetUserId(), id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteAsset(int id)
        {
            var (error, statusCode) = await _clientAssets.DeleteAssetAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return NoContent();
        }

        [HttpPut("{id:int}/default")]
        public async Task<ActionResult<ClientAssetDto>> SetDefault(int id)
        {
            var (result, error, statusCode) = await _clientAssets.SetDefaultAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpGet("{id:int}/history")]
        public async Task<IActionResult> GetHistory(int id)
        {
            var (result, error, statusCode) = await _clientAssets.GetHistoryAsync(_tenantContext.OrgId, GetUserId(), id);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(result);
        }

        [HttpGet("admin/search")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminSearch([FromQuery] string? q)
        {
            var orgId = _tenantContext.OrgId;
            var query = _db.ClientAssets
                .AsNoTracking()
                .Include(ca => ca.Customer)
                .Include(ca => ca.AssetCategory)
                .Where(ca => ca.OrgId == orgId && ca.IsActive);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var ql = q.Trim().ToLower();
                query = query.Where(ca =>
                    ca.Label.ToLower().Contains(ql) ||
                    (ca.AttributesJson != null && ca.AttributesJson.ToLower().Contains(ql)) ||
                    (ca.Customer != null && (ca.Customer.FirstName + " " + ca.Customer.LastName).ToLower().Contains(ql)) ||
                    (ca.Customer != null && ca.Customer.Phone != null && ca.Customer.Phone.Contains(ql)));
            }

            var assets = await query
                .OrderByDescending(ca => ca.CreatedAt)
                .Take(50)
                .Select(ca => new
                {
                    ca.Id,
                    ca.Label,
                    ca.AttributesJson,
                    CategoryName = ca.AssetCategory != null ? ca.AssetCategory.Name : null,
                    ca.IsDefault,
                    ca.CreatedAt,
                    Customer = ca.Customer == null ? null : new
                    {
                        ca.Customer.Id,
                        Name = ca.Customer.FirstName + " " + ca.Customer.LastName,
                        ca.Customer.Phone,
                        ca.Customer.Email
                    }
                })
                .ToListAsync();

            return Ok(assets);
        }

        [HttpGet("admin/{id:int}/history")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminGetHistory(int id)
        {
            var orgId = _tenantContext.OrgId;
            var asset = await _db.ClientAssets.AsNoTracking()
                .Include(ca => ca.Customer)
                .Include(ca => ca.AssetCategory)
                .FirstOrDefaultAsync(ca => ca.Id == id && ca.OrgId == orgId);
            if (asset == null) return NotFound(new { message = "Asset not found" });

            var bookings = await _db.Bookings.AsNoTracking()
                .IgnoreQueryFilters()
                .Where(b => b.ClientAssetId == id && b.OrgId == orgId)
                .OrderByDescending(b => b.ScheduledDate)
                .Select(b => new
                {
                    b.Id,
                    b.BookingNumber,
                    b.ScheduledDate,
                    b.TimeSlot,
                    Status = b.Status.ToString(),
                    b.TotalAmount,
                    b.InvoicePdfUrl
                })
                .ToListAsync();

            return Ok(new
            {
                asset = new
                {
                    asset.Id,
                    asset.Label,
                    asset.AttributesJson,
                    CategoryName = asset.AssetCategory?.Name,
                    CustomerName = asset.Customer != null ? asset.Customer.FirstName + " " + asset.Customer.LastName : null,
                    CustomerPhone = asset.Customer?.Phone,
                    CustomerEmail = asset.Customer?.Email
                },
                bookings
            });
        }
    }
}
