using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Flowly.API.Platform.Messaging
{
    public class InfobipSmsService : ISmsService
    {
        private readonly HttpClient _http;
        private readonly string _baseUrl;
        private readonly string _apiKey;
        private readonly string? _whatsAppSender;
        private readonly string? _smsSender;

        public InfobipSmsService(IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _http = httpClientFactory.CreateClient("Infobip");
            _baseUrl = config["Infobip:BaseUrl"] ?? "https://api.infobip.com";
            _apiKey = config["Infobip:ApiKey"] ?? string.Empty;
            _whatsAppSender = config["Infobip:WhatsAppSender"];
            _smsSender = config["Infobip:SmsSender"];
        }

        public async Task<(bool Success, string? Error)> SendAsync(string to, string message, bool useWhatsApp = false)
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
                return (false, "Infobip API key not configured");

            try
            {
                if (useWhatsApp && !string.IsNullOrWhiteSpace(_whatsAppSender))
                    return await SendWhatsAppAsync(to, message);

                return await SendSmsAsync(to, message);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        private async Task<(bool, string?)> SendSmsAsync(string to, string message)
        {
            var payload = new
            {
                messages = new[] { new { from = _smsSender ?? "Flowly", destinations = new[] { new { to } }, text = message } }
            };
            var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/sms/2/text/advanced")
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("App", _apiKey);

            var resp = await _http.SendAsync(req);
            return resp.IsSuccessStatusCode ? (true, null) : (false, $"SMS API returned {(int)resp.StatusCode}");
        }

        private async Task<(bool, string?)> SendWhatsAppAsync(string to, string message)
        {
            var payload = new
            {
                from = _whatsAppSender,
                to,
                content = new { text = message }
            };
            var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/whatsapp/1/message/text")
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("App", _apiKey);

            var resp = await _http.SendAsync(req);
            return resp.IsSuccessStatusCode ? (true, null) : (false, $"WhatsApp API returned {(int)resp.StatusCode}");
        }
    }
}
