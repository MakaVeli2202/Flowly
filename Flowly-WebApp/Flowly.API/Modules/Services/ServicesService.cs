using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Microsoft.EntityFrameworkCore;
using IAutoTranslationService = Flowly.API.Services.IAutoTranslationService;
using ILocalizationTextResolver = Flowly.API.Services.ILocalizationTextResolver;
using LocalizedText = Flowly.API.Services.LocalizedText;
using ServiceModel = Flowly.API.Models.Service;

namespace Flowly.API.Modules.Services
{
    public class ServicesService : IServicesService
    {
        private readonly AppDbContext _context;
        private readonly ILocalizationTextResolver _localizationTextResolver;
        private readonly IAutoTranslationService _autoTranslationService;

        public ServicesService(
            AppDbContext context,
            ILocalizationTextResolver localizationTextResolver,
            IAutoTranslationService autoTranslationService)
        {
            _context = context;
            _localizationTextResolver = localizationTextResolver;
            _autoTranslationService = autoTranslationService;
        }

        public async Task<IEnumerable<ServiceDto>> GetServicesAsync(string lang, CancellationToken ct)
        {
            var services = await _context.Services
                .Where(s => s.IsActive)
                .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
                .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                .ToListAsync(ct);

            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);

            return services.Select(s => MapToDto(s, serviceTextMap)).ToList();
        }

        public async Task<(ServiceDto? Result, string? Error)> GetServiceAsync(int id, string lang, CancellationToken ct)
        {
            var service = await _context.Services
                .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                .FirstOrDefaultAsync(s => s.Id == id, ct);

            if (service == null) return (null, "Service not found");

            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);
            return (MapToDto(service, serviceTextMap), null);
        }

        public async Task<(ServiceDto? Result, string? Error, int StatusCode)> CreateServiceAsync(CreateServiceDto dto, CancellationToken ct)
        {
            var productIds = dto.Products.Select(p => p.ProductId).ToList();
            var existingProducts = await _context.Products
                .Where(p => productIds.Contains(p.Id) && p.IsActive)
                .ToDictionaryAsync(p => p.Id, ct);

            if (existingProducts.Count != productIds.Count)
                return (null, "One or more products not found", 400);

            var service = new ServiceModel
            {
                Name                   = dto.Name,
                Description            = dto.Description,
                DefaultDurationMinutes = dto.DefaultDurationMinutes,
                IsActive               = true,
                CreatedAt              = DateTime.UtcNow,
                UpdatedAt              = DateTime.UtcNow
            };

            _context.Services.Add(service);
            await _context.SaveChangesAsync(ct);

            try
            {
                await _autoTranslationService.EnsureServiceTranslationsAsync(service.Id, service.Name, service.Description, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Auto-translation failed for service {service.Id}: {ex.Message}");
            }

            foreach (var productDto in dto.Products)
                _context.ServiceProducts.Add(new ServiceProduct { ServiceId = service.Id, ProductId = productDto.ProductId, QuantityUsed = productDto.QuantityUsed });

            await _context.SaveChangesAsync(ct);

            var created = await _context.Services
                .Include(s => s.ServiceProducts)
                    .ThenInclude(sp => sp.Product)
                .FirstAsync(s => s.Id == service.Id, ct);

            return (MapToDto(created, new Dictionary<int, LocalizedText>()), null, 201);
        }

        public async Task<(string? Error, int StatusCode)> UpdateServiceAsync(int id, UpdateServiceDto dto, CancellationToken ct)
        {
            var service = await _context.Services
                .Include(s => s.ServiceProducts)
                .FirstOrDefaultAsync(s => s.Id == id, ct);

            if (service == null) return ("Service not found", 404);

            if (dto.Name != null) service.Name = dto.Name;
            if (dto.Description != null) service.Description = dto.Description;
            if (dto.DefaultDurationMinutes.HasValue) service.DefaultDurationMinutes = dto.DefaultDurationMinutes.Value;
            if (dto.IsActive.HasValue) service.IsActive = dto.IsActive.Value;

            if (dto.Products != null)
            {
                _context.ServiceProducts.RemoveRange(service.ServiceProducts);
                foreach (var productDto in dto.Products)
                    _context.ServiceProducts.Add(new ServiceProduct { ServiceId = service.Id, ProductId = productDto.ProductId, QuantityUsed = productDto.QuantityUsed });
            }

            service.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);

            try
            {
                await _autoTranslationService.EnsureServiceTranslationsAsync(service.Id, service.Name, service.Description, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Auto-translation failed for service {service.Id}: {ex.Message}");
            }

            return (null, 200);
        }

        public async Task ReorderServicesAsync(List<ReorderItemDto> items)
        {
            var ids = items.Select(i => i.Id).ToList();
            var services = await _context.Services.Where(s => ids.Contains(s.Id)).ToListAsync();
            foreach (var svc in services)
            {
                var item = items.FirstOrDefault(i => i.Id == svc.Id);
                if (item != null) svc.SortOrder = item.SortOrder;
            }
            await _context.SaveChangesAsync();
        }

        public async Task<string?> DeleteServiceAsync(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return "Service not found";

            service.IsActive  = false;
            service.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        private static ServiceDto MapToDto(ServiceModel s, Dictionary<int, LocalizedText> textMap) => new()
        {
            Id                     = s.Id,
            Name                   = textMap.TryGetValue(s.Id, out var t) ? (t.Name ?? s.Name) : s.Name,
            Description            = textMap.TryGetValue(s.Id, out t) ? (t.Description ?? s.Description) : s.Description,
            DefaultDurationMinutes = s.DefaultDurationMinutes,
            IsActive               = s.IsActive,
            SortOrder              = s.SortOrder,
            EstimatedCost          = s.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit),
            Products = s.ServiceProducts.Select(sp => new ServiceProductDto
            {
                ProductId    = sp.ProductId,
                ProductName  = sp.Product.Name,
                QuantityUsed = sp.QuantityUsed,
                Unit         = sp.Product.Unit,
                CostPerUnit  = sp.Product.CostPerUnit,
                TotalCost    = sp.QuantityUsed * sp.Product.CostPerUnit
            }).ToList(),
            CreatedAt = s.CreatedAt
        };
    }
}
