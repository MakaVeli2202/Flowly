using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAdminNotificationService _adminNotificationService;

        public ProductsController(AppDbContext context, IAdminNotificationService adminNotificationService)
        {
            _context = context;
            _adminNotificationService = adminNotificationService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetProducts()
        {
            try
            {
                var products = await _context.Products
                    .Where(p => p.IsActive)
                    .Select(p => new ProductDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        Description = p.Description,
                        Vendor = p.Vendor,
                        CostPerUnit = p.CostPerUnit,
                        Unit = p.Unit,
                        StockQuantity = p.StockQuantity,
                        IsActive = p.IsActive,
                        CreatedAt = p.CreatedAt
                    })
                    .ToListAsync();

                return Ok(products);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting products: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve products" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProductDto>> GetProduct(int id)
        {
            try
            {
                var product = await _context.Products
                    .Where(p => p.Id == id)
                    .Select(p => new ProductDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        Description = p.Description,
                        Vendor = p.Vendor,
                        CostPerUnit = p.CostPerUnit,
                        Unit = p.Unit,
                        StockQuantity = p.StockQuantity,
                        IsActive = p.IsActive,
                        CreatedAt = p.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                if (product == null)
                {
                    return NotFound(new { message = "Product not found" });
                }

                return Ok(product);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting product: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve product" });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ProductDto>> CreateProduct(CreateProductDto dto)
        {
            try
            {
                var product = new Product
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    Vendor = dto.Vendor,
                    CostPerUnit = dto.CostPerUnit,
                    Unit = dto.Unit,
                    StockQuantity = dto.StockQuantity,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Products.Add(product);
                await _context.SaveChangesAsync();
                await _adminNotificationService.NotifyLowStockAsync(product);

                var productDto = new ProductDto
                {
                    Id = product.Id,
                    Name = product.Name,
                    Description = product.Description,
                    Vendor = product.Vendor,
                    CostPerUnit = product.CostPerUnit,
                    Unit = product.Unit,
                    StockQuantity = product.StockQuantity,
                    IsActive = product.IsActive,
                    CreatedAt = product.CreatedAt
                };

                return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, productDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating product: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create product" });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateProduct(int id, UpdateProductDto dto)
        {
            try
            {
                var product = await _context.Products.FindAsync(id);

                if (product == null)
                {
                    return NotFound(new { message = "Product not found" });
                }

                if (dto.Name != null) product.Name = dto.Name;
                if (dto.Description != null) product.Description = dto.Description;
                if (dto.Vendor != null) product.Vendor = dto.Vendor;
                if (dto.CostPerUnit.HasValue) product.CostPerUnit = dto.CostPerUnit.Value;
                if (dto.Unit != null) product.Unit = dto.Unit;
                if (dto.StockQuantity.HasValue) product.StockQuantity = dto.StockQuantity.Value;
                if (dto.IsActive.HasValue) product.IsActive = dto.IsActive.Value;

                product.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await _adminNotificationService.NotifyLowStockAsync(product);

                return Ok(new { message = "Product updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating product: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update product" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteProduct(int id)
        {
            try
            {
                var product = await _context.Products.FindAsync(id);

                if (product == null)
                {
                    return NotFound(new { message = "Product not found" });
                }

                product.IsActive = false;
                product.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Product deactivated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting product: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete product" });
            }
        }
    }
}