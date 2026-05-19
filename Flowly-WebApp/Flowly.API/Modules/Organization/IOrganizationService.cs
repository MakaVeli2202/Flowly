using Flowly.API.DTOs;

namespace Flowly.API.Modules.Organization
{
    public interface IOrganizationService
    {
        Task<(OrganizationDto? Result, string? Error, int StatusCode)> RegisterOrganizationAsync(RegisterOrganizationDto dto);
        Task<(OrganizationDto? Result, string? Error, int StatusCode)> GetOrganizationAsync(int orgId);
        Task<(OrganizationDto? Result, string? Error, int StatusCode)> UpdateOrganizationAsync(int orgId, UpdateOrganizationDto dto, int adminId);
        Task<(OrganizationBrandingDto? Result, string? Error, int StatusCode)> GetBrandingAsync(int orgId);
        Task<(OrganizationBrandingDto? Result, string? Error, int StatusCode)> UpdateBrandingAsync(int orgId, UpdateOrganizationBrandingDto dto, int adminId);
        Task<OrganizationOnboardingDto> GetOnboardingStatusAsync(int orgId);
    }
}
