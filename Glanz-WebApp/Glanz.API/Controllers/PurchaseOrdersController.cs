using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class PurchaseOrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly TenantContext _tenant;

        public PurchaseOrdersController(AppDbContext context, TenantContext tenant)
        {
            _context = context;
            _tenant = tenant;
        }

        // ── Suppliers ────────────────────────────────────────────────────────────

        [HttpGet("suppliers")]
        public async Task<IActionResult> GetSuppliers()
        {
            var suppliers = await _context.Suppliers
                .Where(s => s.IsActive)
                .OrderBy(s => s.Name)
                .ToListAsync();
            return Ok(suppliers);
        }

        [HttpPost("suppliers")]
        public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierDto dto)
        {
            var supplier = new Supplier
            {
                OrgId = _tenant.OrgId,
                Name = dto.Name,
                Email = dto.Email,
                Phone = dto.Phone,
                Address = dto.Address,
                ContactPerson = dto.ContactPerson
            };
            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();
            return Ok(supplier);
        }

        [HttpPut("suppliers/{id}")]
        public async Task<IActionResult> UpdateSupplier(int id, [FromBody] CreateSupplierDto dto)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound(new { message = "Supplier not found." });

            supplier.Name = dto.Name;
            supplier.Email = dto.Email;
            supplier.Phone = dto.Phone;
            supplier.Address = dto.Address;
            supplier.ContactPerson = dto.ContactPerson;
            supplier.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(supplier);
        }

        [HttpDelete("suppliers/{id}")]
        public async Task<IActionResult> DeleteSupplier(int id)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound(new { message = "Supplier not found." });
            supplier.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Supplier deactivated." });
        }

        // ── Purchase Orders ──────────────────────────────────────────────────────

        [HttpGet]
        public async Task<IActionResult> GetOrders([FromQuery] string? status)
        {
            var query = _context.PurchaseOrders
                .Include(po => po.Supplier)
                .Include(po => po.Items).ThenInclude(i => i.Product)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PurchaseOrderStatus>(status, true, out var s))
                query = query.Where(po => po.Status == s);

            var orders = await query.OrderByDescending(po => po.CreatedAt).ToListAsync();
            return Ok(orders.Select(po => new
            {
                po.Id, po.OrderNumber, po.Status, po.TotalAmount,
                po.OrderedAt, po.ExpectedDelivery, po.ReceivedAt, po.Notes, po.CreatedAt,
                Supplier = po.Supplier == null ? null : new { po.Supplier.Id, po.Supplier.Name },
                Items = po.Items.Select(i => new { i.Id, i.Description, i.Quantity, i.UnitCost, LineTotal = i.Quantity * i.UnitCost, ProductId = i.ProductId })
            }));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrder(int id)
        {
            var po = await _context.PurchaseOrders
                .Include(p => p.Supplier)
                .Include(p => p.Items).ThenInclude(i => i.Product)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (po == null) return NotFound(new { message = "Purchase order not found." });
            return Ok(po);
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrder([FromBody] CreatePurchaseOrderDto dto)
        {
            var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
            if (supplier == null) return BadRequest(new { message = "Supplier not found." });

            var orderNumber = $"PO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var po = new PurchaseOrder
            {
                OrgId = _tenant.OrgId,
                OrderNumber = orderNumber,
                SupplierId = dto.SupplierId,
                Status = PurchaseOrderStatus.Draft,
                ExpectedDelivery = dto.ExpectedDelivery,
                Notes = dto.Notes,
                Items = dto.Items.Select(i => new PurchaseOrderItem
                {
                    Description = i.Description,
                    Quantity = i.Quantity,
                    UnitCost = i.UnitCost,
                    ProductId = i.ProductId
                }).ToList()
            };
            po.TotalAmount = po.Items.Sum(i => i.Quantity * i.UnitCost);

            _context.PurchaseOrders.Add(po);
            await _context.SaveChangesAsync();
            return Ok(new { po.Id, po.OrderNumber, po.TotalAmount });
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdatePurchaseOrderStatusDto dto)
        {
            var po = await _context.PurchaseOrders.FindAsync(id);
            if (po == null) return NotFound(new { message = "Purchase order not found." });

            po.Status = dto.Status;
            if (dto.Status == PurchaseOrderStatus.Sent && !po.OrderedAt.HasValue)
                po.OrderedAt = DateTime.UtcNow;
            if (dto.Status == PurchaseOrderStatus.Received)
                po.ReceivedAt = DateTime.UtcNow;

            po.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { po.Id, po.Status });
        }
    }

    public class CreateSupplierDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;
        [StringLength(255)]
        public string? Email { get; set; }
        [StringLength(20)]
        public string? Phone { get; set; }
        [StringLength(500)]
        public string? Address { get; set; }
        [StringLength(100)]
        public string? ContactPerson { get; set; }
    }

    public class CreatePurchaseOrderDto
    {
        [Required]
        public int SupplierId { get; set; }
        public DateTime? ExpectedDelivery { get; set; }
        [StringLength(500)]
        public string? Notes { get; set; }
        [Required]
        public List<PurchaseOrderItemDto> Items { get; set; } = new();
    }

    public class PurchaseOrderItemDto
    {
        [Required]
        [StringLength(200)]
        public string Description { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitCost { get; set; }
        public int? ProductId { get; set; }
    }

    public class UpdatePurchaseOrderStatusDto
    {
        [Required]
        public PurchaseOrderStatus Status { get; set; }
    }
}
