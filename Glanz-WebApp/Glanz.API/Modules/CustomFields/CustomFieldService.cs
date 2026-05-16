using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Modules.CustomFields
{
    public record CustomFieldDefinitionDto(
        int Id, string EntityType, string FieldKey, string Label,
        string FieldType, string? OptionsJson, bool IsRequired, int SortOrder, bool IsActive);

    public record CreateCustomFieldDto(
        string EntityType, string FieldKey, string Label,
        string FieldType = "Text", string? OptionsJson = null,
        bool IsRequired = false, int SortOrder = 0);

    public record UpdateCustomFieldDto(
        string? Label, string? OptionsJson, bool? IsRequired, int? SortOrder, bool? IsActive);

    public record CustomFieldValueDto(int Id, int FieldDefinitionId, string FieldKey, string? Value);

    public record SetCustomFieldValueDto(int FieldDefinitionId, string? Value);

    public interface ICustomFieldService
    {
        Task<IEnumerable<CustomFieldDefinitionDto>> GetDefinitionsAsync(int orgId, string? entityType);
        Task<(CustomFieldDefinitionDto? Result, string? Error, int StatusCode)> CreateDefinitionAsync(int orgId, CreateCustomFieldDto dto);
        Task<(CustomFieldDefinitionDto? Result, string? Error, int StatusCode)> UpdateDefinitionAsync(int orgId, int id, UpdateCustomFieldDto dto);
        Task<(string? Error, int StatusCode)> DeleteDefinitionAsync(int orgId, int id);
        Task<IEnumerable<CustomFieldValueDto>> GetValuesAsync(int orgId, string entityType, int entityId);
        Task<(string? Error, int StatusCode)> SetValueAsync(int orgId, string entityType, int entityId, SetCustomFieldValueDto dto);
        Task<(string? Error, int StatusCode)> DeleteValueAsync(int orgId, string entityType, int entityId, int fieldDefinitionId);
    }

    public class CustomFieldService : ICustomFieldService
    {
        private readonly AppDbContext _context;

        public CustomFieldService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<CustomFieldDefinitionDto>> GetDefinitionsAsync(int orgId, string? entityType)
        {
            var query = _context.CustomFieldDefinitions.AsNoTracking().Where(d => d.IsActive);
            if (!string.IsNullOrEmpty(entityType))
                query = query.Where(d => d.EntityType == entityType);
            var defs = await query.OrderBy(d => d.SortOrder).ToListAsync();
            return defs.Select(ToDefDto);
        }

        public async Task<(CustomFieldDefinitionDto? Result, string? Error, int StatusCode)> CreateDefinitionAsync(int orgId, CreateCustomFieldDto dto)
        {
            var exists = await _context.CustomFieldDefinitions
                .AnyAsync(d => d.OrgId == orgId && d.EntityType == dto.EntityType && d.FieldKey == dto.FieldKey);
            if (exists) return (null, "Field key already exists for this entity type.", 409);

            var def = new CustomFieldDefinition
            {
                OrgId = orgId,
                EntityType = dto.EntityType,
                FieldKey = dto.FieldKey,
                Label = dto.Label.Trim(),
                FieldType = dto.FieldType,
                OptionsJson = dto.OptionsJson,
                IsRequired = dto.IsRequired,
                SortOrder = dto.SortOrder,
                IsActive = true
            };

            _context.CustomFieldDefinitions.Add(def);
            await _context.SaveChangesAsync();
            return (ToDefDto(def), null, 201);
        }

        public async Task<(CustomFieldDefinitionDto? Result, string? Error, int StatusCode)> UpdateDefinitionAsync(int orgId, int id, UpdateCustomFieldDto dto)
        {
            var def = await _context.CustomFieldDefinitions.FirstOrDefaultAsync(d => d.Id == id);
            if (def == null) return (null, "Field definition not found.", 404);

            if (dto.Label != null) def.Label = dto.Label.Trim();
            if (dto.OptionsJson != null) def.OptionsJson = dto.OptionsJson;
            if (dto.IsRequired.HasValue) def.IsRequired = dto.IsRequired.Value;
            if (dto.SortOrder.HasValue) def.SortOrder = dto.SortOrder.Value;
            if (dto.IsActive.HasValue) def.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();
            return (ToDefDto(def), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteDefinitionAsync(int orgId, int id)
        {
            var def = await _context.CustomFieldDefinitions.FirstOrDefaultAsync(d => d.Id == id);
            if (def == null) return ("Field definition not found.", 404);
            def.IsActive = false;
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<CustomFieldValueDto>> GetValuesAsync(int orgId, string entityType, int entityId)
        {
            var values = await _context.CustomFieldValues
                .AsNoTracking()
                .Include(v => v.FieldDefinition)
                .Where(v => v.EntityType == entityType && v.EntityId == entityId)
                .ToListAsync();
            return values.Select(v => new CustomFieldValueDto(v.Id, v.FieldDefinitionId, v.FieldDefinition.FieldKey, v.Value));
        }

        public async Task<(string? Error, int StatusCode)> SetValueAsync(int orgId, string entityType, int entityId, SetCustomFieldValueDto dto)
        {
            var def = await _context.CustomFieldDefinitions.FirstOrDefaultAsync(d => d.Id == dto.FieldDefinitionId);
            if (def == null) return ("Field definition not found.", 404);

            var existing = await _context.CustomFieldValues
                .FirstOrDefaultAsync(v => v.EntityType == entityType && v.EntityId == entityId && v.FieldDefinitionId == dto.FieldDefinitionId);

            if (existing != null)
            {
                existing.Value = dto.Value;
            }
            else
            {
                _context.CustomFieldValues.Add(new CustomFieldValue
                {
                    OrgId = orgId,
                    EntityType = entityType,
                    EntityId = entityId,
                    FieldDefinitionId = dto.FieldDefinitionId,
                    Value = dto.Value
                });
            }

            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteValueAsync(int orgId, string entityType, int entityId, int fieldDefinitionId)
        {
            var value = await _context.CustomFieldValues
                .FirstOrDefaultAsync(v => v.EntityType == entityType && v.EntityId == entityId && v.FieldDefinitionId == fieldDefinitionId);
            if (value == null) return ("Value not found.", 404);
            _context.CustomFieldValues.Remove(value);
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        private static CustomFieldDefinitionDto ToDefDto(CustomFieldDefinition d) => new(
            d.Id, d.EntityType, d.FieldKey, d.Label, d.FieldType, d.OptionsJson, d.IsRequired, d.SortOrder, d.IsActive);
    }
}
