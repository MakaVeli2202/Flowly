namespace Flowly.API.Modules.FeatureFlags
{
    public interface IFeatureFlagService
    {
        Task<Dictionary<string, bool>> GetAllFlagsAsync(int orgId);
        Task<bool> IsEnabledAsync(int orgId, string featureKey);
        Task<(string? Error, int StatusCode)> SetFlagAsync(int orgId, string featureKey, bool enabled, string? configJson = null);
        Task<(string? Error, int StatusCode)> DeleteFlagAsync(int orgId, string featureKey);
    }
}
