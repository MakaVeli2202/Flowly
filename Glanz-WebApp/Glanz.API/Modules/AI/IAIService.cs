namespace Glanz.API.Modules.AI
{
    public interface IAIService
    {
        Task<string> CrmNextActionsAsync(int orgId, int customerId, CancellationToken ct = default);
        Task<string> BusinessInsightsAsync(int orgId, CancellationToken ct = default);
        Task<string> MarketingCopyAsync(int orgId, string objective, string language, CancellationToken ct = default);
        Task<string> UpsellSuggestionsAsync(int orgId, int bookingId, CancellationToken ct = default);
    }
}
