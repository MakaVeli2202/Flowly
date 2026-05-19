using Flowly.API.Platform.AuditEvents;
using MediatR;

namespace Flowly.API.Modules.Webhooks
{
    // Forwards every domain event to matching webhook subscriptions.
    // Registered automatically by MediatR assembly scanning.
    public class WebhookEventHandler :
        INotificationHandler<BookingCreatedEvent>,
        INotificationHandler<BookingCompletedEvent>,
        INotificationHandler<BookingCancelledEvent>,
        INotificationHandler<PaymentProcessedEvent>
    {
        private readonly IWebhookService _webhooks;

        public WebhookEventHandler(IWebhookService webhooks)
        {
            _webhooks = webhooks;
        }

        public Task Handle(BookingCreatedEvent e, CancellationToken ct) =>
            _webhooks.TriggerAsync(e.OrgId, "booking.created", e.Payload!, ct);

        public Task Handle(BookingCompletedEvent e, CancellationToken ct) =>
            _webhooks.TriggerAsync(e.OrgId, "booking.completed", e.Payload!, ct);

        public Task Handle(BookingCancelledEvent e, CancellationToken ct) =>
            _webhooks.TriggerAsync(e.OrgId, "booking.cancelled", e.Payload!, ct);

        public Task Handle(PaymentProcessedEvent e, CancellationToken ct) =>
            _webhooks.TriggerAsync(e.OrgId, "payment.processed", e.Payload!, ct);
    }
}
