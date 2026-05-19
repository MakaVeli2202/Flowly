using System.Text.Json;
using Flowly.API.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AddressesController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public AddressesController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        [HttpGet("autocomplete")]
        public async Task<ActionResult<IEnumerable<AddressSuggestionDto>>> Autocomplete([FromQuery] string q, [FromQuery] int? limit)
        {
            if (!(_configuration.GetValue<bool?>("AddressAutocomplete:Enabled") ?? true))
            {
                return Ok(Array.Empty<AddressSuggestionDto>());
            }

            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Ok(Array.Empty<AddressSuggestionDto>());
            }

            var maxResults = Math.Clamp(limit ?? _configuration.GetValue<int?>("AddressAutocomplete:ResultLimit") ?? 5, 1, 15);
            var baseUrl = _configuration["AddressAutocomplete:BaseUrl"] ?? "https://nominatim.openstreetmap.org/search";
            var countryCode = (_configuration["AddressAutocomplete:CountryCode"] ?? "qa").Trim();
            var query = Uri.EscapeDataString(q.Trim());
            // Detect language from query: if the text contains Arabic characters (U+0600–U+06FF)
            // return Arabic names; otherwise return English. This mirrors the user's input language.
            var hasArabic = q.Trim().Any(c => c >= '\u0600' && c <= '\u06FF');
            var acceptLanguage = hasArabic ? "ar" : "en";
            var requestUrl = $"{baseUrl}?q={query}&format=jsonv2&addressdetails=1&limit={maxResults}&countrycodes={Uri.EscapeDataString(countryCode)}&accept-language={acceptLanguage}";

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Flowly/1.0 (deployment-readiness-address-autocomplete)");

            using var response = await client.GetAsync(requestUrl);
            if (!response.IsSuccessStatusCode)
            {
                return Ok(Array.Empty<AddressSuggestionDto>());
            }

            await using var stream = await response.Content.ReadAsStreamAsync();
            using var document = await JsonDocument.ParseAsync(stream);

            var results = new List<AddressSuggestionDto>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                var displayName = item.TryGetProperty("display_name", out var displayNameElement)
                    ? displayNameElement.GetString()
                    : null;

                if (string.IsNullOrWhiteSpace(displayName))
                {
                    continue;
                }

                results.Add(new AddressSuggestionDto
                {
                    DisplayName = displayName,
                    StreetAddress = displayName,
                    Latitude = item.TryGetProperty("lat", out var latElement) ? latElement.GetString() : null,
                    Longitude = item.TryGetProperty("lon", out var lonElement) ? lonElement.GetString() : null,
                    Source = _configuration["AddressAutocomplete:Provider"] ?? "Nominatim"
                });
            }

            return Ok(results);
        }
    }
}