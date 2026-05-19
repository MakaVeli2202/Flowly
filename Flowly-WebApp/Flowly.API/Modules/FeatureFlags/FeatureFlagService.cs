using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Modules.FeatureFlags
{
    public class FeatureFlagService : IFeatureFlagService
    {
        private readonly AppDbContext _context;

        public FeatureFlagService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Dictionary<string, bool>> GetAllFlagsAsync(int orgId)
        {
            var flags = await _context.TenantFeatureFlags
                .AsNoTracking()
                .ToListAsync();
            return flags.ToDictionary(f => f.FeatureKey, f => f.IsEnabled);
        }

        public async Task<bool> IsEnabledAsync(int orgId, string featureKey)
        {
            var flag = await _context.TenantFeatureFlags
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.FeatureKey == featureKey);
            return flag?.IsEnabled ?? false;
        }

        public async Task<(string? Error, int StatusCode)> SetFlagAsync(int orgId, string featureKey, bool enabled, string? configJson = null)
        {
            if (string.IsNullOrWhiteSpace(featureKey)) return ("Feature key is required.", 400);
            featureKey = featureKey.Trim().ToLowerInvariant();

            var flag = await _context.TenantFeatureFlags.FirstOrDefaultAsync(f => f.FeatureKey == featureKey);
            if (flag == null)
            {
                flag = new TenantFeatureFlag { OrgId = orgId, FeatureKey = featureKey };
                _context.TenantFeatureFlags.Add(flag);
            }

            flag.IsEnabled = enabled;
            if (configJson != null) flag.ConfigJson = configJson;
            flag.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteFlagAsync(int orgId, string featureKey)
        {
            var flag = await _context.TenantFeatureFlags.FirstOrDefaultAsync(f => f.FeatureKey == featureKey.Trim().ToLowerInvariant());
            if (flag == null) return ("Feature flag not found.", 404);
            _context.TenantFeatureFlags.Remove(flag);
            await _context.SaveChangesAsync();
            return (null, 204);
        }
    }
}
