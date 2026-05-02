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
    public class ServicesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILocalizationTextResolver _localizationTextResolver;
        private readonly IAutoTranslationService _autoTranslationService;

        public ServicesController(
            AppDbContext context,
            ILocalizationTextResolver localizationTextResolver,
            IAutoTranslationService autoTranslationService)
        {
            _context = context;
            _localizationTextResolver = localizationTextResolver;
            _autoTranslationService = autoTranslationService;
        }

        private string ResolveRequestedLanguage()
        {
            var queryLang = Request.Query["lang"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(queryLang))
                return queryLang;

            var header = Request.Headers["Accept-Language"].FirstOrDefault()
                         ?? Request.Headers["X-Language"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(header)) return "en";

            return header.Split(',')[0].Split('-')[0].Trim().ToLowerInvariant();
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<ServiceDto>>> GetServices()
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var services = await _context.Services
                    .Where(s => s.IsActive)
                    .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                    .ToListAsync();

                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

                var serviceDtos = services.Select(s => new ServiceDto
                {
                    Id = s.Id,
                    Name = serviceTextMap.TryGetValue(s.Id, out var serviceText)
                        ? (serviceText.Name ?? s.Name)
                        : s.Name,
                    Description = serviceTextMap.TryGetValue(s.Id, out serviceText)
                        ? (serviceText.Description ?? s.Description)
                        : s.Description,
                    DefaultDurationMinutes = s.DefaultDurationMinutes,
                    IsActive = s.IsActive,
                    EstimatedCost = s.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit),
                    Products = s.ServiceProducts.Select(sp => new ServiceProductDto
                    {
                        ProductId = sp.ProductId,
                        ProductName = sp.Product.Name,
                        QuantityUsed = sp.QuantityUsed,
                        Unit = sp.Product.Unit,
                        CostPerUnit = sp.Product.CostPerUnit,
                        TotalCost = sp.QuantityUsed * sp.Product.CostPerUnit
                    }).ToList(),
                    CreatedAt = s.CreatedAt
                }).ToList();

                return Ok(serviceDtos);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting services: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve services" });
            }
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<ServiceDto>> GetService(int id)
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var service = await _context.Services
                    .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                    .FirstOrDefaultAsync(s => s.Id == id);

                if (service == null)
                {
                    return NotFound(new { message = "Service not found" });
                }

                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

                var serviceDto = new ServiceDto
                {
                    Id = service.Id,
                    Name = serviceTextMap.TryGetValue(service.Id, out var serviceText)
                        ? (serviceText.Name ?? service.Name)
                        : service.Name,
                    Description = serviceTextMap.TryGetValue(service.Id, out serviceText)
                        ? (serviceText.Description ?? service.Description)
                        : service.Description,
                    DefaultDurationMinutes = service.DefaultDurationMinutes,
                    IsActive = service.IsActive,
                    EstimatedCost = service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit),
                    Products = service.ServiceProducts.Select(sp => new ServiceProductDto
                    {
                        ProductId = sp.ProductId,
                        ProductName = sp.Product.Name,
                        QuantityUsed = sp.QuantityUsed,
                        Unit = sp.Product.Unit,
                        CostPerUnit = sp.Product.CostPerUnit,
                        TotalCost = sp.QuantityUsed * sp.Product.CostPerUnit
                    }).ToList(),
                    CreatedAt = service.CreatedAt
                };

                return Ok(serviceDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting service: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve service" });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ServiceDto>> CreateService(CreateServiceDto dto)
        {
            try
            {
                // Validate products exist
                var productIds = dto.Products.Select(p => p.ProductId).ToList();
                var existingProducts = await _context.Products
                    .Where(p => productIds.Contains(p.Id) && p.IsActive)
                    .ToDictionaryAsync(p => p.Id);

                if (existingProducts.Count != productIds.Count)
                {
                    return BadRequest(new { message = "One or more products not found" });
                }

                var service = new Service
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    DefaultDurationMinutes = dto.DefaultDurationMinutes,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Services.Add(service);
                await _context.SaveChangesAsync();
                try
                {
                    await _autoTranslationService.EnsureServiceTranslationsAsync(
                        service.Id,
                        service.Name,
                        service.Description,
                        HttpContext.RequestAborted);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Auto-translation failed for service {service.Id}: {ex.Message}");
                }

                // Add service products
                foreach (var productDto in dto.Products)
                {
                    var serviceProduct = new ServiceProduct
                    {
                        ServiceId = service.Id,
                        ProductId = productDto.ProductId,
                        QuantityUsed = productDto.QuantityUsed
                    };
                    _context.ServiceProducts.Add(serviceProduct);
                }

                await _context.SaveChangesAsync();

                // Reload service with products
                var createdService = await _context.Services
                    .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                    .FirstAsync(s => s.Id == service.Id);

                var serviceDto = new ServiceDto
                {
                    Id = createdService.Id,
                    Name = createdService.Name,
                    Description = createdService.Description,
                    DefaultDurationMinutes = createdService.DefaultDurationMinutes,
                    IsActive = createdService.IsActive,
                    EstimatedCost = createdService.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit),
                    Products = createdService.ServiceProducts.Select(sp => new ServiceProductDto
                    {
                        ProductId = sp.ProductId,
                        ProductName = sp.Product.Name,
                        QuantityUsed = sp.QuantityUsed,
                        Unit = sp.Product.Unit,
                        CostPerUnit = sp.Product.CostPerUnit,
                        TotalCost = sp.QuantityUsed * sp.Product.CostPerUnit
                    }).ToList(),
                    CreatedAt = createdService.CreatedAt
                };

                return CreatedAtAction(nameof(GetService), new { id = service.Id }, serviceDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating service: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create service" });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateService(int id, UpdateServiceDto dto)
        {
            try
            {
                var service = await _context.Services
                    .Include(s => s.ServiceProducts)
                    .FirstOrDefaultAsync(s => s.Id == id);

                if (service == null)
                {
                    return NotFound(new { message = "Service not found" });
                }

                if (dto.Name != null) service.Name = dto.Name;
                if (dto.Description != null) service.Description = dto.Description;
                if (dto.DefaultDurationMinutes.HasValue) service.DefaultDurationMinutes = dto.DefaultDurationMinutes.Value;
                if (dto.IsActive.HasValue) service.IsActive = dto.IsActive.Value;

                if (dto.Products != null)
                {
                    // Remove existing products
                    _context.ServiceProducts.RemoveRange(service.ServiceProducts);

                    // Add new products
                    foreach (var productDto in dto.Products)
                    {
                        var serviceProduct = new ServiceProduct
                        {
                            ServiceId = service.Id,
                            ProductId = productDto.ProductId,
                            QuantityUsed = productDto.QuantityUsed
                        };
                        _context.ServiceProducts.Add(serviceProduct);
                    }
                }

                service.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                try
                {
                    await _autoTranslationService.EnsureServiceTranslationsAsync(
                        service.Id,
                        service.Name,
                        service.Description,
                        HttpContext.RequestAborted);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Auto-translation failed for service {service.Id}: {ex.Message}");
                }

                return Ok(new { message = "Service updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating service: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update service" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteService(int id)
        {
            try
            {
                var service = await _context.Services.FindAsync(id);

                if (service == null)
                {
                    return NotFound(new { message = "Service not found" });
                }

                service.IsActive = false;
                service.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Service deactivated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting service: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete service" });
            }
        }
    }
}