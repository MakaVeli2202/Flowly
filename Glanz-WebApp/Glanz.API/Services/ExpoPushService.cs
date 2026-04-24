using System.Text;
using System.Text.Json;

namespace Glanz.API.Services
{
    public interface IExpoPushService
    {
        Task SendAsync(string expoPushToken, string title, string body, object? data = null);
        Task SendBatchAsync(IEnumerable<string> expoPushTokens, string title, string body, object? data = null);
    }

    public class ExpoPushService : IExpoPushService
    {
        private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<ExpoPushService> _logger;

        public ExpoPushService(IHttpClientFactory httpClientFactory, ILogger<ExpoPushService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public Task SendAsync(string expoPushToken, string title, string body, object? data = null)
            => SendBatchAsync(new[] { expoPushToken }, title, body, data);

        public async Task SendBatchAsync(IEnumerable<string> expoPushTokens, string title, string body, object? data = null)
        {
            var tokens = expoPushTokens
                .Where(t => !string.IsNullOrWhiteSpace(t) && t.StartsWith("ExponentPushToken"))
                .Distinct()
                .ToList();

            if (tokens.Count == 0) return;

            var messages = tokens.Select(token => new
            {
                to        = token,
                title,
                body,
                sound     = "default",
                badge     = 1,
                priority  = "high",
                channelId = "default",
                data      = data ?? new { },
            });

            var json       = JsonSerializer.Serialize(messages);
            const int MaxAttempts = 2;

            for (int attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                try
                {
                    var client   = _httpClientFactory.CreateClient();
                    var content  = new StringContent(json, Encoding.UTF8, "application/json");
                    var response = await client.PostAsync(ExpoApiUrl, content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseBody = await response.Content.ReadAsStringAsync();
                        // Expo returns per-ticket status; log any token-level errors
                        if (responseBody.Contains("\"status\":\"error\""))
                            _logger.LogWarning("Expo push: ticket errors in response: {Body}", responseBody);
                        return; // success — no retry needed
                    }

                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Expo push failed (attempt {Attempt}/{Max}, HTTP {Status}): {Body}",
                        attempt, MaxAttempts, (int)response.StatusCode, err);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Expo push network error (attempt {Attempt}/{Max})", attempt, MaxAttempts);
                }

                if (attempt < MaxAttempts)
                    await Task.Delay(2000); // 2 s backoff before retry
            }
        }
    }
}
