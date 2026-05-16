using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Modules.Packages
{
    public interface IPackageService
    {
        Task<IEnumerable<PackageDto>> GetPackagesAsync(string lang, CancellationToken ct);
        Task<(PackageDto? Result, string? Error)> GetPackageAsync(int id, string lang, CancellationToken ct);
        Task<(PackageDto? Result, string? Error, int StatusCode)> CreatePackageAsync(CreatePackageDto dto, CancellationToken ct);
        Task<(string? Error, int StatusCode)> UpdatePackageAsync(int id, UpdatePackageDto dto, CancellationToken ct);
        Task<(string? Error, bool IsActive)> ToggleActiveAsync(int id);
        Task<IEnumerable<PackageDto>> GetAllPackagesAdminAsync(string lang, CancellationToken ct);
        Task<string?> DeletePackageAsync(int id);
        Task ReorderPackagesAsync(List<ReorderItemDto> items);
    }
}
