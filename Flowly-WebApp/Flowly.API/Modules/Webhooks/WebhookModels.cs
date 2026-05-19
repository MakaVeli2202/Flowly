using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Modules.Webhooks
{
    public class WebhookSubscription
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required, StringLength(100)]
        public string EventType { get; set; } = string.Empty;
        // e.g. booking.created | booking.completed | booking.cancelled

        [Required, StringLength(2000)]
        public string TargetUrl { get; set; } = string.Empty;

        // HMAC-SHA256 secret used to sign the payload header X-Flowly-Signature
        [StringLength(200)]
        public string? Secret { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class WebhookDelivery
    {
        [Key]
        public int Id { get; set; }

        public int SubscriptionId { get; set; }
        public int OrgId { get; set; }

        [Required, StringLength(100)]
        public string EventType { get; set; } = string.Empty;

        public string PayloadJson { get; set; } = string.Empty;

        public int? ResponseStatusCode { get; set; }
        public bool Success { get; set; }
        public int AttemptCount { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
