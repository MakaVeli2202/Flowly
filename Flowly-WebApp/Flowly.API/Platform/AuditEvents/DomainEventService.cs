using System.Text.Json;
using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Platform.Tenancy;
using MediatR;

namespace Flowly.API.Platform.AuditEvents
{
    // Marker interface for all domain events
    public interface IDomainEvent : INotification
    {
        int OrgId { get; }
        string EventType { get; }
        string? EntityType { get; }
        int? EntityId { get; }
        object? Payload { get; }
    }

    // Core domain events
    public record BookingCreatedEvent(int OrgId, int BookingId, string BookingNumber, int? CustomerId) : IDomainEvent
    {
        public string EventType => "BookingCreated";
        public string? EntityType => "Booking";
        public int? EntityId => BookingId;
        public object? Payload => new { BookingId, BookingNumber, CustomerId };
    }

    public record BookingCompletedEvent(int OrgId, int BookingId, string BookingNumber, decimal TotalAmount) : IDomainEvent
    {
        public string EventType => "BookingCompleted";
        public string? EntityType => "Booking";
        public int? EntityId => BookingId;
        public object? Payload => new { BookingId, BookingNumber, TotalAmount };
    }

    public record BookingCancelledEvent(int OrgId, int BookingId, string BookingNumber, string? Reason) : IDomainEvent
    {
        public string EventType => "BookingCancelled";
        public string? EntityType => "Booking";
        public int? EntityId => BookingId;
        public object? Payload => new { BookingId, BookingNumber, Reason };
    }

    public record CustomerCreatedEvent(int OrgId, int CustomerId, string Email) : IDomainEvent
    {
        public string EventType => "CustomerCreated";
        public string? EntityType => "User";
        public int? EntityId => CustomerId;
        public object? Payload => new { CustomerId, Email };
    }

    public record PaymentProcessedEvent(int OrgId, int BookingId, decimal Amount, string PaymentIntentId) : IDomainEvent
    {
        public string EventType => "PaymentProcessed";
        public string? EntityType => "Booking";
        public int? EntityId => BookingId;
        public object? Payload => new { BookingId, Amount, PaymentIntentId };
    }

    public interface IDomainEventService
    {
        Task PublishAsync<T>(T domainEvent, CancellationToken cancellationToken = default) where T : IDomainEvent;
    }

    public class DomainEventService : IDomainEventService
    {
        private readonly AppDbContext _db;
        private readonly IMediator _mediator;
        private readonly ILogger<DomainEventService> _logger;

        public DomainEventService(AppDbContext db, IMediator mediator, ILogger<DomainEventService> logger)
        {
            _db = db;
            _mediator = mediator;
            _logger = logger;
        }

        public async Task PublishAsync<T>(T domainEvent, CancellationToken cancellationToken = default) where T : IDomainEvent
        {
            // 1. Persist event to DomainEvents table first (event sourcing / audit trail)
            var record = new DomainEvent
            {
                OrgId = domainEvent.OrgId,
                EventType = domainEvent.EventType,
                EntityType = domainEvent.EntityType,
                EntityId = domainEvent.EntityId,
                PayloadJson = domainEvent.Payload != null
                    ? JsonSerializer.Serialize(domainEvent.Payload)
                    : null,
                OccurredAt = DateTime.UtcNow
            };

            _db.DomainEvents.Add(record);
            await _db.SaveChangesAsync(cancellationToken);

            // 2. Dispatch to MediatR handlers
            try
            {
                await _mediator.Publish(domainEvent, cancellationToken);
                record.ProcessedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing domain event {EventType} for org {OrgId}", domainEvent.EventType, domainEvent.OrgId);
                // Don't rethrow - event is persisted, handlers can be retried
            }
        }
    }
}
