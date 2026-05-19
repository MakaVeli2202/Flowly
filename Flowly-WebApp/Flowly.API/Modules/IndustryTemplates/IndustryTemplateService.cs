using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Modules.IndustryTemplates
{
    public record IndustryTemplateDto(
        int Id,
        string Key,
        string DisplayName,
        string? TerminologyJson,
        string? DefaultServiceTemplatesJson,
        string? DefaultChecklistTemplatesJson,
        string? DefaultCustomFieldsJson,
        string? DefaultWorkflowRulesJson,
        string? DefaultAutomationRulesJson,
        bool IsActive);

    public record CreateIndustryTemplateDto(
        string Key,
        string DisplayName,
        string? TerminologyJson = null,
        string? DefaultServiceTemplatesJson = null,
        string? DefaultChecklistTemplatesJson = null,
        string? DefaultCustomFieldsJson = null,
        string? DefaultWorkflowRulesJson = null,
        string? DefaultAutomationRulesJson = null);

    public record UpdateIndustryTemplateDto(
        string? DisplayName,
        string? TerminologyJson,
        string? DefaultServiceTemplatesJson,
        string? DefaultChecklistTemplatesJson,
        string? DefaultCustomFieldsJson,
        string? DefaultWorkflowRulesJson,
        string? DefaultAutomationRulesJson,
        bool? IsActive);

    public record ApplyTemplateDto(string TemplateKey);

    public interface IIndustryTemplateService
    {
        Task<IEnumerable<IndustryTemplateDto>> GetAllAsync();
        Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> GetByKeyAsync(string key);
        Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> CreateAsync(CreateIndustryTemplateDto dto);
        Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> UpdateAsync(string key, UpdateIndustryTemplateDto dto);
        Task<(string? Error, int StatusCode)> DeleteAsync(string key);
        Task<(string? Error, int StatusCode)> ApplyToOrgAsync(int orgId, string templateKey);
    }

    public class IndustryTemplateService : IIndustryTemplateService
    {
        private readonly AppDbContext _context;

        public IndustryTemplateService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<IndustryTemplateDto>> GetAllAsync()
        {
            var templates = await _context.IndustryTemplates
                .AsNoTracking()
                .Where(t => t.IsActive)
                .OrderBy(t => t.DisplayName)
                .ToListAsync();
            return templates.Select(ToDto);
        }

        public async Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> GetByKeyAsync(string key)
        {
            var template = await _context.IndustryTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Key == key);
            if (template == null) return (null, "Template not found.", 404);
            return (ToDto(template), null, 200);
        }

        public async Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> CreateAsync(CreateIndustryTemplateDto dto)
        {
            var exists = await _context.IndustryTemplates.AnyAsync(t => t.Key == dto.Key);
            if (exists) return (null, "Template key already exists.", 409);

            var template = new IndustryTemplate
            {
                Key = dto.Key.ToLowerInvariant(),
                DisplayName = dto.DisplayName.Trim(),
                TerminologyJson = dto.TerminologyJson,
                DefaultServiceTemplatesJson = dto.DefaultServiceTemplatesJson,
                DefaultChecklistTemplatesJson = dto.DefaultChecklistTemplatesJson,
                DefaultCustomFieldsJson = dto.DefaultCustomFieldsJson,
                DefaultWorkflowRulesJson = dto.DefaultWorkflowRulesJson,
                DefaultAutomationRulesJson = dto.DefaultAutomationRulesJson,
                IsActive = true
            };

            _context.IndustryTemplates.Add(template);
            await _context.SaveChangesAsync();
            return (ToDto(template), null, 201);
        }

        public async Task<(IndustryTemplateDto? Result, string? Error, int StatusCode)> UpdateAsync(string key, UpdateIndustryTemplateDto dto)
        {
            var template = await _context.IndustryTemplates.FirstOrDefaultAsync(t => t.Key == key);
            if (template == null) return (null, "Template not found.", 404);

            if (dto.DisplayName != null) template.DisplayName = dto.DisplayName.Trim();
            if (dto.TerminologyJson != null) template.TerminologyJson = dto.TerminologyJson;
            if (dto.DefaultServiceTemplatesJson != null) template.DefaultServiceTemplatesJson = dto.DefaultServiceTemplatesJson;
            if (dto.DefaultChecklistTemplatesJson != null) template.DefaultChecklistTemplatesJson = dto.DefaultChecklistTemplatesJson;
            if (dto.DefaultCustomFieldsJson != null) template.DefaultCustomFieldsJson = dto.DefaultCustomFieldsJson;
            if (dto.DefaultWorkflowRulesJson != null) template.DefaultWorkflowRulesJson = dto.DefaultWorkflowRulesJson;
            if (dto.DefaultAutomationRulesJson != null) template.DefaultAutomationRulesJson = dto.DefaultAutomationRulesJson;
            if (dto.IsActive.HasValue) template.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();
            return (ToDto(template), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteAsync(string key)
        {
            var template = await _context.IndustryTemplates.FirstOrDefaultAsync(t => t.Key == key);
            if (template == null) return ("Template not found.", 404);
            template.IsActive = false;
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<(string? Error, int StatusCode)> ApplyToOrgAsync(int orgId, string templateKey)
        {
            var template = await _context.IndustryTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Key == templateKey && t.IsActive);
            if (template == null) return ("Template not found.", 404);

            var lastSnapshot = await _context.TenantConfigurationSnapshots
                .AsNoTracking()
                .Where(s => s.OrgId == orgId)
                .OrderByDescending(s => s.Version)
                .FirstOrDefaultAsync();

            var snapshot = new Models.TenantConfigurationSnapshot
            {
                OrgId = orgId,
                Version = (lastSnapshot?.Version ?? 0) + 1,
                IndustryTemplateKey = templateKey,
                TerminologyJson = template.TerminologyJson,
                CreatedAt = DateTime.UtcNow
            };

            _context.TenantConfigurationSnapshots.Add(snapshot);
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        private static IndustryTemplateDto ToDto(IndustryTemplate t) => new(
            t.Id, t.Key, t.DisplayName, t.TerminologyJson,
            t.DefaultServiceTemplatesJson, t.DefaultChecklistTemplatesJson,
            t.DefaultCustomFieldsJson, t.DefaultWorkflowRulesJson,
            t.DefaultAutomationRulesJson, t.IsActive);
    }
}
