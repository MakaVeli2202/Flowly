using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Modules.Automation
{
    public record AutomationRuleDto(
        int Id, string Name, string TriggerEvent, int DelayMinutes,
        string ActionType, string? ConfigJson, bool IsActive, DateTime CreatedAt);

    public record CreateAutomationRuleDto(
        string Name, string TriggerEvent, string ActionType,
        int DelayMinutes = 0, string? ConfigJson = null);

    public record UpdateAutomationRuleDto(
        string? Name, string? TriggerEvent, string? ActionType,
        int? DelayMinutes, string? ConfigJson, bool? IsActive);

    public interface IAutomationRuleService
    {
        Task<IEnumerable<AutomationRuleDto>> GetRulesAsync(int orgId);
        Task<(AutomationRuleDto? Result, string? Error, int StatusCode)> CreateRuleAsync(int orgId, CreateAutomationRuleDto dto);
        Task<(AutomationRuleDto? Result, string? Error, int StatusCode)> UpdateRuleAsync(int orgId, int id, UpdateAutomationRuleDto dto);
        Task<(string? Error, int StatusCode)> DeleteRuleAsync(int orgId, int id);
        Task<IEnumerable<AutomationRule>> GetActiveRulesForEventAsync(int orgId, string triggerEvent);
    }

    public class AutomationRuleService : IAutomationRuleService
    {
        private readonly AppDbContext _context;

        public AutomationRuleService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<AutomationRuleDto>> GetRulesAsync(int orgId)
        {
            var rules = await _context.AutomationRules
                .AsNoTracking()
                .OrderBy(r => r.TriggerEvent)
                .ThenBy(r => r.DelayMinutes)
                .ToListAsync();
            return rules.Select(ToDto);
        }

        public async Task<(AutomationRuleDto? Result, string? Error, int StatusCode)> CreateRuleAsync(int orgId, CreateAutomationRuleDto dto)
        {
            var rule = new AutomationRule
            {
                OrgId = orgId,
                Name = dto.Name.Trim(),
                TriggerEvent = dto.TriggerEvent,
                DelayMinutes = dto.DelayMinutes,
                ActionType = dto.ActionType,
                ConfigJson = dto.ConfigJson,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.AutomationRules.Add(rule);
            await _context.SaveChangesAsync();
            return (ToDto(rule), null, 201);
        }

        public async Task<(AutomationRuleDto? Result, string? Error, int StatusCode)> UpdateRuleAsync(int orgId, int id, UpdateAutomationRuleDto dto)
        {
            var rule = await _context.AutomationRules.FirstOrDefaultAsync(r => r.Id == id);
            if (rule == null) return (null, "Rule not found.", 404);

            if (dto.Name != null) rule.Name = dto.Name.Trim();
            if (dto.TriggerEvent != null) rule.TriggerEvent = dto.TriggerEvent;
            if (dto.ActionType != null) rule.ActionType = dto.ActionType;
            if (dto.DelayMinutes.HasValue) rule.DelayMinutes = dto.DelayMinutes.Value;
            if (dto.ConfigJson != null) rule.ConfigJson = dto.ConfigJson;
            if (dto.IsActive.HasValue) rule.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();
            return (ToDto(rule), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteRuleAsync(int orgId, int id)
        {
            var rule = await _context.AutomationRules.FirstOrDefaultAsync(r => r.Id == id);
            if (rule == null) return ("Rule not found.", 404);
            rule.IsActive = false;
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<AutomationRule>> GetActiveRulesForEventAsync(int orgId, string triggerEvent)
        {
            return await _context.AutomationRules
                .AsNoTracking()
                .Where(r => r.OrgId == orgId && r.TriggerEvent == triggerEvent && r.IsActive)
                .OrderBy(r => r.DelayMinutes)
                .ToListAsync();
        }

        private static AutomationRuleDto ToDto(AutomationRule r) => new(
            r.Id, r.Name, r.TriggerEvent, r.DelayMinutes, r.ActionType, r.ConfigJson, r.IsActive, r.CreatedAt);
    }
}
