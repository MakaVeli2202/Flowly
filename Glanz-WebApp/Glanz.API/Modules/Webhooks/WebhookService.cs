using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Glanz.API.Data;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Modules.Webhooks
{
    public class WebhookService : IWebhookService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _http;
        private readonly ILogger<WebhookService> _logger;

        public WebhookService(IServiceScopeFactory scopeFactory, IHttpClientFactory http, ILogger<WebhookService> logger)
        {
            _scopeFactory = scopeFactory;
            _http = http;
            _logger = logger;
        }

        public async Task TriggerAsync(int orgId, string eventType, object payload, CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var subs = await db.WebhookSubscriptions
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(s => s.OrgId == orgId && s.EventType == eventType && s.IsActive)
                .ToListAsync(ct);

            if (subs.Count == 0) return;

            var envelope = new
            {
                id = Guid.NewGuid(),
                eventType,
                orgId,
                timestamp = DateTime.UtcNow,
                data = payload
            };
            var json = JsonSerializer.Serialize(envelope);

            // Deliver to each subscriber in parallel, fire-and-forget errors
            var tasks = subs.Select(sub => DeliverAsync(sub, json, ct));
            await Task.WhenAll(tasks);
        }

        private async Task DeliverAsync(WebhookSubscription sub, string json, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var delivery = new WebhookDelivery
            {
                SubscriptionId = sub.Id,
                OrgId = sub.OrgId,
                EventType = sub.EventType,
                PayloadJson = json,
                CreatedAt = DateTime.UtcNow
            };

            try
            {
                var client = _http.CreateClient("Webhook");
                var request = new HttpRequestMessage(HttpMethod.Post, sub.TargetUrl)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };

                if (!string.IsNullOrWhiteSpace(sub.Secret))
                {
                    var sig = ComputeHmac(sub.Secret, json);
                    request.Headers.Add("X-Flowly-Signature", $"sha256={sig}");
                }

                request.Headers.Add("X-Flowly-Event", sub.EventType);

                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(10));

                var response = await client.SendAsync(request, cts.Token);

                delivery.ResponseStatusCode = (int)response.StatusCode;
                delivery.Success = response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Webhook delivery failed for subscription {SubId} -> {Url}", sub.Id, sub.TargetUrl);
                delivery.Success = false;
            }

            db.WebhookDeliveries.Add(delivery);
            await db.SaveChangesAsync(CancellationToken.None);
        }

        private static string ComputeHmac(string secret, string payload)
        {
            var key = Encoding.UTF8.GetBytes(secret);
            var data = Encoding.UTF8.GetBytes(payload);
            using var hmac = new HMACSHA256(key);
            return Convert.ToHexString(hmac.ComputeHash(data)).ToLowerInvariant();
        }
    }
}
