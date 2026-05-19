using Flowly.API.DTOs;

namespace Flowly.API.Modules.Services
{
    public interface IServicesService
    {
        Task<IEnumerable<ServiceDto>> GetServicesAsync(string lang, CancellationToken ct);
        Task<(ServiceDto? Result, string? Error)> GetServiceAsync(int id, string lang, CancellationToken ct);
        Task<(ServiceDto? Result, string? Error, int StatusCode)> CreateServiceAsync(CreateServiceDto dto, CancellationToken ct);
        Task<(string? Error, int StatusCode)> UpdateServiceAsync(int id, UpdateServiceDto dto, CancellationToken ct);
        Task ReorderServicesAsync(List<ReorderItemDto> items);
        Task<string?> DeleteServiceAsync(int id);
    }
}
