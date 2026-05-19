using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;

namespace Flowly.API.Services
{
    public sealed class TranslationBackfillResult
    {
        public int PackagesProcessed { get; set; }
        public int ServicesProcessed { get; set; }
    }

    public interface IAutoTranslationService
    {
        Task EnsurePackageTranslationsAsync(int packageId, string sourceName, string? sourceDescription, CancellationToken cancellationToken = default);
        Task EnsureServiceTranslationsAsync(int serviceId, string sourceName, string? sourceDescription, CancellationToken cancellationToken = default);
        Task<TranslationBackfillResult> BackfillAllAsync(CancellationToken cancellationToken = default);
    }

    public class AutoTranslationService : IAutoTranslationService
    {
        private readonly AppDbContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AutoTranslationService> _logger;

        public AutoTranslationService(
            AppDbContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<AutoTranslationService> logger)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task EnsurePackageTranslationsAsync(int packageId, string sourceName, string? sourceDescription, CancellationToken cancellationToken = default)
        {
            if (!IsEnabled()) return;
            await EnsureTranslationsAsync(
                tableName: "package_translations",
                entityId: packageId,
                sourceName,
                sourceDescription,
                cancellationToken
            );
        }

        public async Task EnsureServiceTranslationsAsync(int serviceId, string sourceName, string? sourceDescription, CancellationToken cancellationToken = default)
        {
            if (!IsEnabled()) return;
            await EnsureTranslationsAsync(
                tableName: "service_translations",
                entityId: serviceId,
                sourceName,
                sourceDescription,
                cancellationToken
            );
        }

        public async Task<TranslationBackfillResult> BackfillAllAsync(CancellationToken cancellationToken = default)
        {
            var result = new TranslationBackfillResult();
            if (!IsEnabled()) return result;

            var packages = await _context.Packages.AsNoTracking().ToListAsync(cancellationToken);
            foreach (var package in packages)
            {
                await EnsurePackageTranslationsAsync(package.Id, package.Name, package.Description, cancellationToken);
                result.PackagesProcessed++;
            }

            var services = await _context.Services.AsNoTracking().ToListAsync(cancellationToken);
            foreach (var service in services)
            {
                await EnsureServiceTranslationsAsync(service.Id, service.Name, service.Description, cancellationToken);
                result.ServicesProcessed++;
            }

            return result;
        }

        private bool IsEnabled()
        {
            return _configuration.GetValue<bool>("AutoTranslation:Enabled", true);
        }

        private string SourceLanguage()
        {
            return (_configuration["AutoTranslation:SourceLanguage"] ?? "en").Trim().ToLowerInvariant();
        }

        private IReadOnlyList<string> TargetLanguages()
        {
            var langs = _configuration.GetSection("AutoTranslation:TargetLanguages").Get<string[]>();
            if (langs == null || langs.Length == 0) return new[] { "ar", "de" };
            return langs.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim().ToLowerInvariant()).Distinct().ToArray();
        }

        private async Task EnsureTranslationsAsync(
            string tableName,
            int entityId,
            string sourceName,
            string? sourceDescription,
            CancellationToken cancellationToken)
        {
            var sourceLanguage = SourceLanguage();
            var targets = TargetLanguages().Where(l => l != sourceLanguage).ToArray();

            foreach (var lang in targets)
            {
                try
                {
                    var translatedName = await TranslateTextAsync(sourceName, sourceLanguage, lang, cancellationToken);
                    var translatedDescription = string.IsNullOrWhiteSpace(sourceDescription)
                        ? null
                        : await TranslateTextAsync(sourceDescription, sourceLanguage, lang, cancellationToken);

                                        var sql = tableName == "package_translations"
                                                ? @"
INSERT INTO ""package_translations"" (""PackageId"", ""Language"", ""Name"", ""Description"", ""CreatedAt"", ""UpdatedAt"")
VALUES (@p0, @p1, @p2, @p3, NOW(), NOW())
ON CONFLICT (""PackageId"", ""Language"")
DO UPDATE SET
    ""Name"" = EXCLUDED.""Name"",
    ""Description"" = EXCLUDED.""Description"",
    ""UpdatedAt"" = NOW();"
                                                : @"
INSERT INTO ""service_translations"" (""ServiceId"", ""Language"", ""Name"", ""Description"", ""CreatedAt"", ""UpdatedAt"")
VALUES (@p0, @p1, @p2, @p3, NOW(), NOW())
ON CONFLICT (""ServiceId"", ""Language"")
DO UPDATE SET
    ""Name"" = EXCLUDED.""Name"",
    ""Description"" = EXCLUDED.""Description"",
    ""UpdatedAt"" = NOW();";

                                        await _context.Database.ExecuteSqlRawAsync(
                                                sql,
                                                new object[] { entityId, lang, translatedName, translatedDescription ?? (object)DBNull.Value },
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Auto-translation upsert failed for table {TableName}, id {EntityId}, lang {Lang}", tableName, entityId, lang);
                }
            }
        }

        private async Task<string> TranslateTextAsync(string text, string sourceLang, string targetLang, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(text)) return text;

            var provider = (_configuration["AutoTranslation:Provider"] ?? "MyMemory").Trim().ToLowerInvariant();
            if (provider == "libretranslate")
            {
                var libre = await TranslateWithLibreTranslateAsync(text, sourceLang, targetLang, cancellationToken);
                if (!string.IsNullOrWhiteSpace(libre)) return libre;

                var fallback = await TranslateWithMyMemoryAsync(text, sourceLang, targetLang, cancellationToken);
                return string.IsNullOrWhiteSpace(fallback) ? text : fallback;
            }

            var myMemory = await TranslateWithMyMemoryAsync(text, sourceLang, targetLang, cancellationToken);
            if (!string.IsNullOrWhiteSpace(myMemory)) return myMemory;

            var libreFallback = await TranslateWithLibreTranslateAsync(text, sourceLang, targetLang, cancellationToken);
            return string.IsNullOrWhiteSpace(libreFallback) ? text : libreFallback;
        }

        private async Task<string?> TranslateWithLibreTranslateAsync(string text, string sourceLang, string targetLang, CancellationToken cancellationToken)
        {
            try
            {
                var url = _configuration["AutoTranslation:LibreTranslateUrl"] ?? "https://libretranslate.com/translate";
                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(_configuration.GetValue<int>("AutoTranslation:RequestTimeoutSeconds", 15));

                var payload = new
                {
                    q = text,
                    source = sourceLang,
                    target = targetLang,
                    format = "text",
                    api_key = _configuration["AutoTranslation:LibreTranslateApiKey"]
                };

                using var response = await client.PostAsJsonAsync(url, payload, cancellationToken);
                if (!response.IsSuccessStatusCode) return null;

                using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
                if (doc.RootElement.TryGetProperty("translatedText", out var translatedText))
                {
                    return translatedText.GetString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "LibreTranslate failed for lang {TargetLang}", targetLang);
            }

            return null;
        }

        private async Task<string?> TranslateWithMyMemoryAsync(string text, string sourceLang, string targetLang, CancellationToken cancellationToken)
        {
            try
            {
                var baseUrl = _configuration["AutoTranslation:MyMemoryUrl"] ?? "https://api.mymemory.translated.net/get";
                var encodedText = WebUtility.UrlEncode(text);
                var url = $"{baseUrl}?q={encodedText}&langpair={sourceLang}|{targetLang}";

                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(_configuration.GetValue<int>("AutoTranslation:RequestTimeoutSeconds", 15));

                using var response = await client.GetAsync(url, cancellationToken);
                if (!response.IsSuccessStatusCode) return null;

                using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
                if (doc.RootElement.TryGetProperty("responseData", out var responseData)
                    && responseData.TryGetProperty("translatedText", out var translatedText))
                {
                    return translatedText.GetString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "MyMemory translation failed for lang {TargetLang}", targetLang);
            }

            return null;
        }
    }
}
