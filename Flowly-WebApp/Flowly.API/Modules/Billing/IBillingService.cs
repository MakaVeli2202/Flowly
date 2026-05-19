using Flowly.API.DTOs;

namespace Flowly.API.Modules.Billing
{
    public interface IBillingService
    {
        // Platform plan management
        Task<IEnumerable<PlatformPlanDto>> GetPlansAsync();
        Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> GetPlanAsync(int id);
        Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> CreatePlanAsync(CreatePlatformPlanDto dto);
        Task<(PlatformPlanDto? Result, string? Error, int StatusCode)> UpdatePlanAsync(int id, UpdatePlatformPlanDto dto);
        Task<(string? Error, int StatusCode)> DeactivatePlanAsync(int id);

        // Org subscription management
        Task<(OrganizationSubscriptionDto? Result, string? Error, int StatusCode)> GetSubscriptionAsync(int orgId);
        Task<(CheckoutSessionResultDto? Result, string? Error, int StatusCode)> CreateCheckoutSessionAsync(int orgId, CreateCheckoutSessionDto dto);
        Task<(BillingPortalSessionDto? Result, string? Error, int StatusCode)> CreateBillingPortalSessionAsync(int orgId, string returnUrl);
        Task<(string? Error, int StatusCode)> HandleStripeWebhookAsync(string payload, string signature);

        // Usage tracking
        Task<UsageRecordDto?> GetCurrentUsageAsync(int orgId);
        Task IncrementBookingCountAsync(int orgId);
    }
}
