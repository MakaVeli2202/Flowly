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
    public class PackagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILocalizationTextResolver _localizationTextResolver;
        private readonly IAutoTranslationService _autoTranslationService;

        public PackagesController(
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
        public async Task<ActionResult<IEnumerable<PackageDto>>> GetPackages()
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packages = await _context.Packages
                    .Where(p => p.IsActive)
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .ToListAsync();

                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);
                (packageTextMap, serviceTextMap) = await EnsureMissingTranslationsAsync(
                    packages,
                    lang,
                    packageTextMap,
                    serviceTextMap,
                    HttpContext.RequestAborted);

                var packageDtos = packages.Select(p => 
                {
                    var estimatedCost = p.PackageServices
                        .Sum(ps => ps.Service.ServiceProducts
                            .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));

                    var profit = p.Price - estimatedCost;
                    var profitMargin = p.Price > 0 ? (profit / p.Price) * 100 : 0;

                    return new PackageDto
                    {
                        Id = p.Id,
                        Name = packageTextMap.TryGetValue(p.Id, out var packageText)
                            ? (packageText.Name ?? p.Name)
                            : p.Name,
                        Description = packageTextMap.TryGetValue(p.Id, out packageText)
                            ? (packageText.Description ?? p.Description)
                            : p.Description,
                        Price = p.Price,
                        Tier = p.Tier,
                        EstimatedDurationMinutes = p.EstimatedDurationMinutes,
                        ImageUrl = p.ImageUrl,
                        IsActive = p.IsActive,
                        EstimatedCost = estimatedCost,
                        EstimatedProfit = profit,
                        ProfitMarginPercent = profitMargin,
                        Services = p.PackageServices.Select(ps => new PackageServiceDetailDto
                        {
                            ServiceId = ps.ServiceId,
                            ServiceName = serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                                ? (serviceText.Name ?? ps.Service.Name)
                                : ps.Service.Name,
                            ServiceDescription = serviceTextMap.TryGetValue(ps.ServiceId, out serviceText)
                                ? (serviceText.Description ?? ps.Service.Description)
                                : ps.Service.Description,
                            DurationMinutes = ps.Service.DefaultDurationMinutes,
                            ServiceCost = ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)
                        }).ToList(),
                        CreatedAt = p.CreatedAt
                    };
                }).ToList();

                return Ok(packageDtos);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting packages: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve packages" });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PackageDto>> GetPackage(int id)
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var package = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (package == null)
                {
                    return NotFound(new { message = "Package not found" });
                }

                var estimatedCost = package.PackageServices
                    .Sum(ps => ps.Service.ServiceProducts
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));

                var profit = package.Price - estimatedCost;
                var profitMargin = package.Price > 0 ? (profit / package.Price) * 100 : 0;

                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);
                (packageTextMap, serviceTextMap) = await EnsureMissingTranslationsAsync(
                    new List<Package> { package },
                    lang,
                    packageTextMap,
                    serviceTextMap,
                    HttpContext.RequestAborted);

                var packageDto = new PackageDto
                {
                    Id = package.Id,
                    Name = packageTextMap.TryGetValue(package.Id, out var packageText)
                        ? (packageText.Name ?? package.Name)
                        : package.Name,
                    Description = packageTextMap.TryGetValue(package.Id, out packageText)
                        ? (packageText.Description ?? package.Description)
                        : package.Description,
                    Price = package.Price,
                    Tier = package.Tier,
                    EstimatedDurationMinutes = package.EstimatedDurationMinutes,
                    ImageUrl = package.ImageUrl,
                    IsActive = package.IsActive,
                    EstimatedCost = estimatedCost,
                    EstimatedProfit = profit,
                    ProfitMarginPercent = profitMargin,
                    Services = package.PackageServices.Select(ps => new PackageServiceDetailDto
                    {
                        ServiceId = ps.ServiceId,
                        ServiceName = serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                            ? (serviceText.Name ?? ps.Service.Name)
                            : ps.Service.Name,
                        ServiceDescription = serviceTextMap.TryGetValue(ps.ServiceId, out serviceText)
                            ? (serviceText.Description ?? ps.Service.Description)
                            : ps.Service.Description,
                        DurationMinutes = ps.Service.DefaultDurationMinutes,
                        ServiceCost = ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)
                    }).ToList(),
                    CreatedAt = package.CreatedAt
                };

                return Ok(packageDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting package: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<PackageDto>> CreatePackage(CreatePackageDto dto)
        {
            try
            {
                // Check if package name already exists
                if (await _context.Packages.AnyAsync(p => p.Name == dto.Name))
                {
                    return BadRequest(new { message = "Package name already exists" });
                }

                // Validate services exist
                var serviceIds = dto.ServiceIds;
                var existingServices = await _context.Services
                    .Where(s => serviceIds.Contains(s.Id) && s.IsActive)
                    .ToListAsync();

                if (existingServices.Count != serviceIds.Count)
                {
                    return BadRequest(new { message = "One or more services not found" });
                }

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
                await _context.SaveChangesAsync();
                try
                {
                    await _autoTranslationService.EnsurePackageTranslationsAsync(
                        package.Id,
                        package.Name,
                        package.Description,
                        HttpContext.RequestAborted);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Auto-translation failed for package {package.Id}: {ex.Message}");
                }

                // Add package services
                foreach (var serviceId in dto.ServiceIds)
                {
                    var packageService = new PackageService
                    {
                        PackageId = package.Id,
                        ServiceId = serviceId
                    };
                    _context.PackageServices.Add(packageService);
                }

                await _context.SaveChangesAsync();

                // Reload package with all relationships
                var createdPackage = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .FirstAsync(p => p.Id == package.Id);

                var estimatedCost = createdPackage.PackageServices
                    .Sum(ps => ps.Service.ServiceProducts
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));

                var profit = createdPackage.Price - estimatedCost;
                var profitMargin = createdPackage.Price > 0 ? (profit / createdPackage.Price) * 100 : 0;

                var packageDto = new PackageDto
                {
                    Id = createdPackage.Id,
                    Name = createdPackage.Name,
                    Description = createdPackage.Description,
                    Price = createdPackage.Price,
                    Tier = createdPackage.Tier,
                    EstimatedDurationMinutes = createdPackage.EstimatedDurationMinutes,
                    ImageUrl = createdPackage.ImageUrl,
                    IsActive = createdPackage.IsActive,
                    EstimatedCost = estimatedCost,
                    EstimatedProfit = profit,
                    ProfitMarginPercent = profitMargin,
                    Services = createdPackage.PackageServices.Select(ps => new PackageServiceDetailDto
                    {
                        ServiceId = ps.ServiceId,
                        ServiceName = ps.Service.Name,
                        ServiceDescription = ps.Service.Description,
                        DurationMinutes = ps.Service.DefaultDurationMinutes,
                        ServiceCost = ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)
                    }).ToList(),
                    CreatedAt = createdPackage.CreatedAt
                };

                return CreatedAtAction(nameof(GetPackage), new { id = package.Id }, packageDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating package: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdatePackage(int id, UpdatePackageDto dto)
        {
            try
            {
                var package = await _context.Packages
                    .Include(p => p.PackageServices)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (package == null)
                {
                    return NotFound(new { message = "Package not found" });
                }

                if (dto.Name != null) package.Name = dto.Name;
                if (dto.Description != null) package.Description = dto.Description;
                if (dto.Price.HasValue) package.Price = dto.Price.Value;
                if (dto.Tier != null) package.Tier = dto.Tier;
                if (dto.EstimatedDurationMinutes.HasValue) package.EstimatedDurationMinutes = dto.EstimatedDurationMinutes.Value;
                if (dto.ImageUrl != null) package.ImageUrl = dto.ImageUrl;
                if (dto.IsActive.HasValue) package.IsActive = dto.IsActive.Value;

                if (dto.ServiceIds != null)
                {
                    // Remove existing services
                    _context.PackageServices.RemoveRange(package.PackageServices);

                    // Add new services
                    foreach (var serviceId in dto.ServiceIds)
                    {
                        var packageService = new PackageService
                        {
                            PackageId = package.Id,
                            ServiceId = serviceId
                        };
                        _context.PackageServices.Add(packageService);
                    }
                }

                package.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                try
                {
                    await _autoTranslationService.EnsurePackageTranslationsAsync(
                        package.Id,
                        package.Name,
                        package.Description,
                        HttpContext.RequestAborted);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Auto-translation failed for package {package.Id}: {ex.Message}");
                }

                return Ok(new { message = "Package updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating package: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update package" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPatch("{id}/toggle-active")]
        public async Task<ActionResult> TogglePackageActive(int id)
        {
            try
            {
                var package = await _context.Packages.FindAsync(id);

                if (package == null)
                {
                    return NotFound(new { message = "Package not found" });
                }

                package.IsActive = !package.IsActive;
                package.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                var action = package.IsActive ? "activated" : "deactivated";
                return Ok(new { message = $"Package {action} successfully", isActive = package.IsActive });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error toggling package active status: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update package status" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin/all")]
        public async Task<ActionResult<IEnumerable<PackageDto>>> GetAllPackagesAdmin()
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packages = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .ToListAsync();

                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

                var packageDtos = packages.Select(p =>
                {
                    var estimatedCost = p.PackageServices
                        .Sum(ps => ps.Service.ServiceProducts
                            .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));

                    var profit = p.Price - estimatedCost;
                    var profitMargin = p.Price > 0 ? (profit / p.Price) * 100 : 0;

                    return new PackageDto
                    {
                        Id = p.Id,
                        Name = packageTextMap.TryGetValue(p.Id, out var packageText)
                            ? (packageText.Name ?? p.Name)
                            : p.Name,
                        Description = packageTextMap.TryGetValue(p.Id, out packageText)
                            ? (packageText.Description ?? p.Description)
                            : p.Description,
                        Price = p.Price,
                        Tier = p.Tier,
                        EstimatedDurationMinutes = p.EstimatedDurationMinutes,
                        ImageUrl = p.ImageUrl,
                        IsActive = p.IsActive,
                        EstimatedCost = estimatedCost,
                        EstimatedProfit = profit,
                        ProfitMarginPercent = profitMargin,
                        Services = p.PackageServices.Select(ps => new PackageServiceDetailDto
                        {
                            ServiceId = ps.ServiceId,
                            ServiceName = serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                                ? (serviceText.Name ?? ps.Service.Name)
                                : ps.Service.Name,
                            ServiceDescription = serviceTextMap.TryGetValue(ps.ServiceId, out serviceText)
                                ? (serviceText.Description ?? ps.Service.Description)
                                : ps.Service.Description,
                            DurationMinutes = ps.Service.DefaultDurationMinutes,
                            ServiceCost = ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)
                        }).ToList(),
                        CreatedAt = p.CreatedAt
                    };
                }).ToList();

                return Ok(packageDtos);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting all packages: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve packages" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeletePackage(int id)
        {
            try
            {
                var package = await _context.Packages.FindAsync(id);

                if (package == null)
                {
                    return NotFound(new { message = "Package not found" });
                }

                package.IsActive = false;
                package.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Package deactivated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting package: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete package" });
            }
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
            {
                return (packageTextMap, serviceTextMap);
            }

            var attemptedBackfill = false;

            try
            {
                foreach (var package in packages)
                {
                    var hasPackageTranslation = packageTextMap.TryGetValue(package.Id, out var packageText)
                        && !string.IsNullOrWhiteSpace(packageText?.Name);

                    if (!hasPackageTranslation)
                    {
                        attemptedBackfill = true;
                        await _autoTranslationService.EnsurePackageTranslationsAsync(
                            package.Id,
                            package.Name,
                            package.Description,
                            cancellationToken);
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
                    var hasServiceTranslation = serviceTextMap.TryGetValue(service.Id, out var serviceText)
                        && !string.IsNullOrWhiteSpace(serviceText?.Name);

                    if (!hasServiceTranslation)
                    {
                        attemptedBackfill = true;
                        await _autoTranslationService.EnsureServiceTranslationsAsync(
                            service.Id,
                            service.Name,
                            service.Description,
                            cancellationToken);
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