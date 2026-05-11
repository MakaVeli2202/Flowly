using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/admin/translations")]
    [Authorize(Roles = "Admin")]
    public class AdminTranslationsController : ControllerBase
    {
        private readonly IAutoTranslationService _autoTranslationService;
        private readonly AppDbContext _context;

        private static readonly HashSet<string> EditableLanguages = new(StringComparer.OrdinalIgnoreCase)
        {
            "ar", "de"
        };

        public AdminTranslationsController(IAutoTranslationService autoTranslationService, AppDbContext context)
        {
            _autoTranslationService = autoTranslationService;
            _context = context;
        }

        private static string NormalizeLanguage(string? lang)
        {
            if (string.IsNullOrWhiteSpace(lang)) return "en";
            return lang.Trim().Split(',')[0].Split('-')[0].ToLowerInvariant();
        }

        [HttpGet("packages")]
        public async Task<ActionResult> GetPackageTranslations([FromQuery] string? lang, CancellationToken cancellationToken)
        {
            var language = NormalizeLanguage(lang);
            if (!EditableLanguages.Contains(language))
            {
                return BadRequest(new { message = "Only ar and de are editable languages." });
            }

            var packages = await _context.Packages
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    id = p.Id,
                    sourceName = p.Name,
                    sourceDescription = p.Description
                })
                .ToListAsync(cancellationToken);

            var translations = await _context.Database.SqlQueryRaw<PackageTranslationRow>(
                @"SELECT ""PackageId"", ""Name"", ""Description""
                  FROM ""package_translations""
                  WHERE lower(""Language"") = {0}",
                language
            ).ToListAsync(cancellationToken);

            var translationMap = translations.ToDictionary(t => t.PackageId, t => t);

            return Ok(packages.Select(r => new
            {
                r.id,
                r.sourceName,
                r.sourceDescription,
                name = translationMap.TryGetValue(r.id, out var row) ? row.Name : null,
                description = translationMap.TryGetValue(r.id, out row) ? row.Description : null,
                language
            }));
        }

        [HttpGet("services")]
        public async Task<ActionResult> GetServiceTranslations([FromQuery] string? lang, CancellationToken cancellationToken)
        {
            var language = NormalizeLanguage(lang);
            if (!EditableLanguages.Contains(language))
            {
                return BadRequest(new { message = "Only ar and de are editable languages." });
            }

            var services = await _context.Services
                .AsNoTracking()
                .OrderBy(s => s.Name)
                .Select(s => new
                {
                    id = s.Id,
                    sourceName = s.Name,
                    sourceDescription = s.Description
                })
                .ToListAsync(cancellationToken);

            var translations = await _context.Database.SqlQueryRaw<ServiceTranslationRow>(
                @"SELECT ""ServiceId"", ""Name"", ""Description""
                  FROM ""service_translations""
                  WHERE lower(""Language"") = {0}",
                language
            ).ToListAsync(cancellationToken);

            var translationMap = translations.ToDictionary(t => t.ServiceId, t => t);

            return Ok(services.Select(r => new
            {
                r.id,
                r.sourceName,
                r.sourceDescription,
                name = translationMap.TryGetValue(r.id, out var row) ? row.Name : null,
                description = translationMap.TryGetValue(r.id, out row) ? row.Description : null,
                language
            }));
        }

        [HttpPut("packages/{id:int}")]
        public async Task<ActionResult> UpsertPackageTranslation(int id, [FromQuery] string? lang, [FromBody] UpsertTranslationDto dto, CancellationToken cancellationToken)
        {
            var language = NormalizeLanguage(lang);
            if (!EditableLanguages.Contains(language))
            {
                return BadRequest(new { message = "Only ar and de are editable languages." });
            }

            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { message = "Translated name is required." });
            }

            var packageExists = await _context.Packages.AnyAsync(p => p.Id == id, cancellationToken);
            if (!packageExists)
            {
                return NotFound(new { message = "Package not found." });
            }

            await _context.Database.ExecuteSqlRawAsync(
                @"INSERT INTO ""package_translations"" (""PackageId"", ""Language"", ""Name"", ""Description"", ""CreatedAt"", ""UpdatedAt"")
                  VALUES ({0}, {1}, {2}, {3}, NOW(), NOW())
                  ON CONFLICT (""PackageId"", ""Language"")
                  DO UPDATE SET
                    ""Name"" = EXCLUDED.""Name"",
                    ""Description"" = EXCLUDED.""Description"",
                    ""UpdatedAt"" = NOW();",
                new object[] { id, language, dto.Name.Trim(), string.IsNullOrWhiteSpace(dto.Description) ? DBNull.Value : dto.Description.Trim() },
                cancellationToken
            );

            return Ok(new { message = "Package translation saved." });
        }

        [HttpPut("services/{id:int}")]
        public async Task<ActionResult> UpsertServiceTranslation(int id, [FromQuery] string? lang, [FromBody] UpsertTranslationDto dto, CancellationToken cancellationToken)
        {
            var language = NormalizeLanguage(lang);
            if (!EditableLanguages.Contains(language))
            {
                return BadRequest(new { message = "Only ar and de are editable languages." });
            }

            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { message = "Translated name is required." });
            }

            var serviceExists = await _context.Services.AnyAsync(s => s.Id == id, cancellationToken);
            if (!serviceExists)
            {
                return NotFound(new { message = "Service not found." });
            }

            await _context.Database.ExecuteSqlRawAsync(
                @"INSERT INTO ""service_translations"" (""ServiceId"", ""Language"", ""Name"", ""Description"", ""CreatedAt"", ""UpdatedAt"")
                  VALUES ({0}, {1}, {2}, {3}, NOW(), NOW())
                  ON CONFLICT (""ServiceId"", ""Language"")
                  DO UPDATE SET
                    ""Name"" = EXCLUDED.""Name"",
                    ""Description"" = EXCLUDED.""Description"",
                    ""UpdatedAt"" = NOW();",
                new object[] { id, language, dto.Name.Trim(), string.IsNullOrWhiteSpace(dto.Description) ? DBNull.Value : dto.Description.Trim() },
                cancellationToken
            );

            return Ok(new { message = "Service translation saved." });
        }

        [HttpPost("backfill")]
        public async Task<ActionResult> Backfill(CancellationToken cancellationToken)
        {
            var result = await _autoTranslationService.BackfillAllAsync(cancellationToken);
            return Ok(new
            {
                message = "Translations backfill completed",
                result.PackagesProcessed,
                result.ServicesProcessed
            });
        }

        public class UpsertTranslationDto
        {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
        }

        private sealed class PackageTranslationRow
        {
            public int PackageId { get; set; }
            public string? Name { get; set; }
            public string? Description { get; set; }
        }

        private sealed class ServiceTranslationRow
        {
            public int ServiceId { get; set; }
            public string? Name { get; set; }
            public string? Description { get; set; }
        }
    }
}
