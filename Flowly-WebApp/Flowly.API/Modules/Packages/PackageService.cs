using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;
using Flowly.API.Services;
using Microsoft.EntityFrameworkCore;
using PackageServiceModel = Flowly.API.Models.PackageService;

namespace Flowly.API.Modules.Packages
{
    public class PackageService : IPackageService
    {
        private readonly AppDbContext _context;
        private readonly ILocalizationTextResolver _localizationTextResolver;
        private readonly IAutoTranslationService _autoTranslationService;

        public PackageService(
            AppDbContext context,
            ILocalizationTextResolver localizationTextResolver,
            IAutoTranslationService autoTranslationService)
        {
            _context = context;
            _localizationTextResolver = localizationTextResolver;
            _autoTranslationService = autoTranslationService;
        }

        public async Task<IEnumerable<PackageDto>> GetPackagesAsync(string lang, CancellationToken ct)
        {
            var packages = await _context.Packages
                .Where(p => p.IsActive)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
                .Include(p => p.PackageServices)
                    .ThenInclude(ps => ps.Service)
                        .ThenInclude(s => s.ServiceProducts)
                            .ThenInclude(sp => sp.Product)
                .ToListAsync(ct);

            var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, ct);
            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);
            (packageTextMap, serviceTextMap) = await EnsureMissingTranslationsAsync(packages, lang, packageTextMap, serviceTextMap, ct);

            return packages.Select(p => MapToDto(p, packageTextMap, serviceTextMap)).ToList();
        }

        public async Task<(PackageDto? Result, string? Error)> GetPackageAsync(int id, string lang, CancellationToken ct)
        {
            var package = await _context.Packages
                .Include(p => p.PackageServices)
                    .ThenInclude(ps => ps.Service)
                        .ThenInclude(s => s.ServiceProducts)
                            .ThenInclude(sp => sp.Product)
                .FirstOrDefaultAsync(p => p.Id == id, ct);

            if (package == null) return (null, "Package not found");

            var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, ct);
            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);
            (packageTextMap, serviceTextMap) = await EnsureMissingTranslationsAsync(new List<Package> { package }, lang, packageTextMap, serviceTextMap, ct);

            return (MapToDto(package, packageTextMap, serviceTextMap), null);
        }

        public async Task<(PackageDto? Result, string? Error, int StatusCode)> CreatePackageAsync(CreatePackageDto dto, CancellationToken ct)
        {
            if (await _context.Packages.AnyAsync(p => p.Name == dto.Name, ct))
                return (null, "Package name already exists", 400);

            var serviceIds = dto.ServiceIds;
            var existingServices = await _context.Services
                .Where(s => serviceIds.Contains(s.Id) && s.IsActive)
                .ToListAsync(ct);

            if (existingServices.Count != serviceIds.Count)
                return (null, "One or more services not found", 400);

            var package = new Package
            {
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                Tier = dto.Tier,
                EstimatedDurationMinutes = dto.EstimatedDurationMinutes,
                ImageUrl = dto.ImageUrl,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Packages.Add(package);
            await _context.SaveChangesAsync(ct);

            try
            {
                await _autoTranslationService.EnsurePackageTranslationsAsync(package.Id, package.Name, package.Description, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Auto-translation failed for package {package.Id}: {ex.Message}");
            }

            foreach (var serviceId in dto.ServiceIds)
                _context.PackageServices.Add(new PackageServiceModel { PackageId = package.Id, ServiceId = serviceId });

            await _context.SaveChangesAsync(ct);

            var created = await _context.Packages
                .Include(p => p.PackageServices)
                    .ThenInclude(ps => ps.Service)
                        .ThenInclude(s => s.ServiceProducts)
                            .ThenInclude(sp => sp.Product)
                .FirstAsync(p => p.Id == package.Id, ct);

            return (MapToDto(created, new Dictionary<int, LocalizedText>(), new Dictionary<int, LocalizedText>()), null, 201);
        }

        public async Task<(string? Error, int StatusCode)> UpdatePackageAsync(int id, UpdatePackageDto dto, CancellationToken ct)
        {
            var package = await _context.Packages
                .Include(p => p.PackageServices)
                .FirstOrDefaultAsync(p => p.Id == id, ct);

            if (package == null) return ("Package not found", 404);

            if (dto.Name != null) package.Name = dto.Name;
            if (dto.Description != null) package.Description = dto.Description;
            if (dto.Price.HasValue) package.Price = dto.Price.Value;
            if (dto.Tier != null) package.Tier = dto.Tier;
            if (dto.EstimatedDurationMinutes.HasValue) package.EstimatedDurationMinutes = dto.EstimatedDurationMinutes.Value;
            if (dto.ImageUrl != null) package.ImageUrl = dto.ImageUrl;
            if (dto.IsActive.HasValue) package.IsActive = dto.IsActive.Value;

            if (dto.ServiceIds != null)
            {
                _context.PackageServices.RemoveRange(package.PackageServices);
                foreach (var serviceId in dto.ServiceIds)
                    _context.PackageServices.Add(new PackageServiceModel { PackageId = package.Id, ServiceId = serviceId });
            }

            package.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);

            try
            {
                await _autoTranslationService.EnsurePackageTranslationsAsync(package.Id, package.Name, package.Description, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Auto-translation failed for package {package.Id}: {ex.Message}");
            }

            return (null, 200);
        }

        public async Task<(string? Error, bool IsActive)> ToggleActiveAsync(int id)
        {
            var package = await _context.Packages.FindAsync(id);
            if (package == null) return ("Package not found", false);

            package.IsActive = !package.IsActive;
            package.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, package.IsActive);
        }

        public async Task<IEnumerable<PackageDto>> GetAllPackagesAdminAsync(string lang, CancellationToken ct)
        {
            var packages = await _context.Packages
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
                .Include(p => p.PackageServices)
                    .ThenInclude(ps => ps.Service)
                        .ThenInclude(s => s.ServiceProducts)
                            .ThenInclude(sp => sp.Product)
                .ToListAsync(ct);

            var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, ct);
            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);

            return packages.Select(p => MapToDto(p, packageTextMap, serviceTextMap)).ToList();
        }

        public async Task<string?> DeletePackageAsync(int id)
        {
            var package = await _context.Packages.FindAsync(id);
            if (package == null) return "Package not found";

            package.IsActive = false;
            package.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task ReorderPackagesAsync(List<ReorderItemDto> items)
        {
            var ids = items.Select(i => i.Id).ToList();
            var packages = await _context.Packages.Where(p => ids.Contains(p.Id)).ToListAsync();
            foreach (var pkg in packages)
            {
                var item = items.FirstOrDefault(i => i.Id == pkg.Id);
                if (item != null) pkg.SortOrder = item.SortOrder;
            }
            await _context.SaveChangesAsync();
        }

        private static PackageDto MapToDto(Package p, Dictionary<int, LocalizedText> packageTextMap, Dictionary<int, LocalizedText> serviceTextMap)
        {
            var estimatedCost = p.PackageServices
                .Sum(ps => ps.Service.ServiceProducts
                    .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));
            var profit = p.Price - estimatedCost;
            var profitMargin = p.Price > 0 ? (profit / p.Price) * 100 : 0;

            return new PackageDto
            {
                Id = p.Id,
                Name = packageTextMap.TryGetValue(p.Id, out var packageText) ? (packageText.Name ?? p.Name) : p.Name,
                Description = packageTextMap.TryGetValue(p.Id, out packageText) ? (packageText.Description ?? p.Description) : p.Description,
                Price = p.Price,
                Tier = p.Tier,
                EstimatedDurationMinutes = p.EstimatedDurationMinutes,
                ImageUrl = p.ImageUrl,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder,
                EstimatedCost = estimatedCost,
                EstimatedProfit = profit,
                ProfitMarginPercent = profitMargin,
                Services = p.PackageServices.Select(ps => new PackageServiceDetailDto
                {
                    ServiceId = ps.ServiceId,
                    ServiceName = serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText) ? (serviceText.Name ?? ps.Service.Name) : ps.Service.Name,
                    ServiceDescription = serviceTextMap.TryGetValue(ps.ServiceId, out serviceText) ? (serviceText.Description ?? ps.Service.Description) : ps.Service.Description,
                    DurationMinutes = ps.Service.DefaultDurationMinutes,
                    ServiceCost = ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)
                }).ToList(),
                CreatedAt = p.CreatedAt
            };
        }

        private async Task<(Dictionary<int, LocalizedText> packageTextMap, Dictionary<int, LocalizedText> serviceTextMap)> EnsureMissingTranslationsAsync(
            IReadOnlyCollection<Package> packages,
            string? lang,
            Dictionary<int, LocalizedText> packageTextMap,
            Dictionary<int, LocalizedText> serviceTextMap,
            CancellationToken cancellationToken)
        {
            var normalizedLang = (lang ?? "en").Trim().Split(',', ';')[0].Split('-')[0].ToLowerInvariant();
            if (normalizedLang == "en" || packages.Count == 0)
                return (packageTextMap, serviceTextMap);

            var attemptedBackfill = false;

            try
            {
                foreach (var package in packages)
                {
                    var hasTranslation = packageTextMap.TryGetValue(package.Id, out var packageText)
                        && !string.IsNullOrWhiteSpace(packageText?.Name);
                    if (!hasTranslation)
                    {
                        attemptedBackfill = true;
                        await _autoTranslationService.EnsurePackageTranslationsAsync(package.Id, package.Name, package.Description, cancellationToken);
                    }
                }

                var servicesById = packages
                    .SelectMany(p => p.PackageServices)
                    .Select(ps => ps.Service)
                    .Where(s => s != null)
                    .GroupBy(s => s.Id)
                    .Select(g => g.First())
                    .ToList();

                foreach (var service in servicesById)
                {
                    var hasTranslation = serviceTextMap.TryGetValue(service.Id, out var serviceText)
                        && !string.IsNullOrWhiteSpace(serviceText?.Name);
                    if (!hasTranslation)
                    {
                        attemptedBackfill = true;
                        await _autoTranslationService.EnsureServiceTranslationsAsync(service.Id, service.Name, service.Description, cancellationToken);
                    }
                }

                if (attemptedBackfill)
                {
                    packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(normalizedLang, cancellationToken);
                    serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(normalizedLang, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Translation ensure-on-read failed: {ex.Message}");
            }

            return (packageTextMap, serviceTextMap);
        }
    }
}
