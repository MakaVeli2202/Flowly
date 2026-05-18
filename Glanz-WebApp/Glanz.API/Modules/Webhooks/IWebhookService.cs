namespace Glanz.API.Modules.Webhooks
{
    public interface IWebhookService
    {
        // Fire-and-forget: sends to all active subscriptions for this org+event.
        Task TriggerAsync(int orgId, string eventType, object payload, CancellationToken ct = default);
    }
}
