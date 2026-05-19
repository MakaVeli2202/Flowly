using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;

namespace Flowly.API.Services
{
    public sealed class LocalizedText
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
    }

    public interface ILocalizationTextResolver
    {
        Task<Dictionary<int, LocalizedText>> GetPackageTextsAsync(string? lang, CancellationToken cancellationToken = default);
        Task<Dictionary<int, LocalizedText>> GetServiceTextsAsync(string? lang, CancellationToken cancellationToken = default);
    }

    public class LocalizationTextResolver : ILocalizationTextResolver
    {
        private readonly AppDbContext _context;

        public LocalizationTextResolver(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Dictionary<int, LocalizedText>> GetPackageTextsAsync(string? lang, CancellationToken cancellationToken = default)
        {
            var language = NormalizeLanguage(lang);
            if (language == "en") return new Dictionary<int, LocalizedText>();

            var fromTranslationTable = await ReadFromTranslationTableAsync(
                entityPrefix: "package",
                language,
                cancellationToken
            );

            var fromEntityColumns = await ReadFromEntityTableColumnsAsync(
                preferredTableName: "Packages",
                language,
                cancellationToken
            );

            return Merge(fromEntityColumns, fromTranslationTable);
        }

        public async Task<Dictionary<int, LocalizedText>> GetServiceTextsAsync(string? lang, CancellationToken cancellationToken = default)
        {
            var language = NormalizeLanguage(lang);
            if (language == "en") return new Dictionary<int, LocalizedText>();

            var fromTranslationTable = await ReadFromTranslationTableAsync(
                entityPrefix: "service",
                language,
                cancellationToken
            );

            var fromEntityColumns = await ReadFromEntityTableColumnsAsync(
                preferredTableName: "Services",
                language,
                cancellationToken
            );

            return Merge(fromEntityColumns, fromTranslationTable);
        }

        private static string NormalizeLanguage(string? lang)
        {
            if (string.IsNullOrWhiteSpace(lang)) return "en";
            return lang.Trim().Split(',', ';')[0].Split('-')[0].ToLowerInvariant();
        }

        private async Task<Dictionary<int, LocalizedText>> ReadFromEntityTableColumnsAsync(
            string preferredTableName,
            string lang,
            CancellationToken cancellationToken)
        {
            var result = new Dictionary<int, LocalizedText>();

            var connection = _context.Database.GetDbConnection();
            var shouldClose = false;
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
                shouldClose = true;
            }

            try
            {
                var table = await GetActualTableNameAsync(connection, preferredTableName, cancellationToken);
                if (string.IsNullOrWhiteSpace(table)) return result;

                var columns = await GetTableColumnsAsync(connection, table, cancellationToken);
                var idColumn = columns.FirstOrDefault(c => c.Equals("Id", StringComparison.OrdinalIgnoreCase));
                if (idColumn == null) return result;

                var nameColumn = FindLocalizedColumn(columns, "name", lang);
                var descriptionColumn = FindLocalizedColumn(columns, "description", lang);

                if (nameColumn == null && descriptionColumn == null) return result;

                await using var command = connection.CreateCommand();
                var selectedColumns = new List<string> { QuoteIdentifier(idColumn) };
                if (nameColumn != null) selectedColumns.Add(QuoteIdentifier(nameColumn));
                if (descriptionColumn != null) selectedColumns.Add(QuoteIdentifier(descriptionColumn));

                command.CommandText = $"SELECT {string.Join(", ", selectedColumns)} FROM {QuoteIdentifier(table)}";

                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    var id = Convert.ToInt32(reader[0]);
                    var name = nameColumn != null ? reader[nameColumn] as string : null;
                    var description = descriptionColumn != null ? reader[descriptionColumn] as string : null;

                    if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(description)) continue;
                    result[id] = new LocalizedText { Name = name, Description = description };
                }
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }

            return result;
        }

        private async Task<Dictionary<int, LocalizedText>> ReadFromTranslationTableAsync(
            string entityPrefix,
            string lang,
            CancellationToken cancellationToken)
        {
            var result = new Dictionary<int, LocalizedText>();

            var connection = _context.Database.GetDbConnection();
            var shouldClose = false;
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
                shouldClose = true;
            }

            try
            {
                var candidateTables = new[]
                {
                    $"{entityPrefix}translations",
                    $"{entityPrefix}translation",
                    $"{entityPrefix}_translations",
                    $"{entityPrefix}_translation",
                };

                var table = await GetActualTableNameAsync(connection, candidateTables, cancellationToken);
                if (string.IsNullOrWhiteSpace(table)) return result;

                var columns = await GetTableColumnsAsync(connection, table, cancellationToken);

                var idColumn = columns.FirstOrDefault(c =>
                    c.EndsWith("Id", StringComparison.OrdinalIgnoreCase) &&
                    c.Contains(entityPrefix, StringComparison.OrdinalIgnoreCase));

                var langColumn = columns.FirstOrDefault(c =>
                    c.Equals("Language", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals("Lang", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals("Locale", StringComparison.OrdinalIgnoreCase));

                var nameColumn = columns.FirstOrDefault(c =>
                    c.Equals("Name", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals($"{entityPrefix}Name", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals("Title", StringComparison.OrdinalIgnoreCase));

                var descriptionColumn = columns.FirstOrDefault(c =>
                    c.Equals("Description", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals($"{entityPrefix}Description", StringComparison.OrdinalIgnoreCase) ||
                    c.Equals("Text", StringComparison.OrdinalIgnoreCase));

                if (idColumn == null || langColumn == null || (nameColumn == null && descriptionColumn == null))
                {
                    return result;
                }

                await using var command = connection.CreateCommand();
                var selectedColumns = new List<string> { QuoteIdentifier(idColumn) };
                if (nameColumn != null) selectedColumns.Add(QuoteIdentifier(nameColumn));
                if (descriptionColumn != null) selectedColumns.Add(QuoteIdentifier(descriptionColumn));

                command.CommandText =
                    $"SELECT {string.Join(", ", selectedColumns)} " +
                    $"FROM {QuoteIdentifier(table)} " +
                    $"WHERE lower({QuoteIdentifier(langColumn)}) = @lang";

                var pLang = command.CreateParameter();
                pLang.ParameterName = "@lang";
                pLang.Value = lang;
                command.Parameters.Add(pLang);

                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    var id = Convert.ToInt32(reader[0]);
                    var name = nameColumn != null ? reader[nameColumn] as string : null;
                    var description = descriptionColumn != null ? reader[descriptionColumn] as string : null;

                    if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(description)) continue;
                    result[id] = new LocalizedText { Name = name, Description = description };
                }
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }

            return result;
        }

        private static string? FindLocalizedColumn(IEnumerable<string> columns, string baseName, string lang)
        {
            var candidates = new[]
            {
                $"{baseName}_{lang}",
                $"{baseName}{lang}",
                $"{baseName}{char.ToUpperInvariant(lang[0])}{lang.Substring(1)}",
                $"{baseName}_{lang.ToUpperInvariant()}",
            };

            return columns.FirstOrDefault(c => candidates.Any(candidate => c.Equals(candidate, StringComparison.OrdinalIgnoreCase)));
        }

        private static Dictionary<int, LocalizedText> Merge(
            Dictionary<int, LocalizedText> first,
            Dictionary<int, LocalizedText> second)
        {
            var merged = new Dictionary<int, LocalizedText>(first);
            foreach (var kv in second)
            {
                if (!merged.TryGetValue(kv.Key, out var existing))
                {
                    merged[kv.Key] = kv.Value;
                    continue;
                }

                existing.Name ??= kv.Value.Name;
                existing.Description ??= kv.Value.Description;
            }

            return merged;
        }

        private static async Task<string?> GetActualTableNameAsync(DbConnection connection, string preferred, CancellationToken cancellationToken)
        {
            var names = await GetActualTableNamesAsync(connection, new[] { preferred }, cancellationToken);
            return names.FirstOrDefault();
        }

        private static async Task<string?> GetActualTableNameAsync(DbConnection connection, string[] preferred, CancellationToken cancellationToken)
        {
            var names = await GetActualTableNamesAsync(connection, preferred, cancellationToken);
            return names.FirstOrDefault();
        }

        private static async Task<List<string>> GetActualTableNamesAsync(DbConnection connection, IEnumerable<string> preferredNames, CancellationToken cancellationToken)
        {
            var result = new List<string>();

            foreach (var preferred in preferredNames)
            {
                await using var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND lower(table_name) = @table";

                var pName = command.CreateParameter();
                pName.ParameterName = "@table";
                pName.Value = preferred.ToLowerInvariant();
                command.Parameters.Add(pName);

                var tableName = (string?)await command.ExecuteScalarAsync(cancellationToken);
                if (!string.IsNullOrWhiteSpace(tableName))
                {
                    result.Add(tableName);
                }
            }

            return result;
        }

        private static async Task<List<string>> GetTableColumnsAsync(DbConnection connection, string tableName, CancellationToken cancellationToken)
        {
            var columns = new List<string>();

            await using var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = @tableName";

            var pTable = command.CreateParameter();
            pTable.ParameterName = "@tableName";
            pTable.Value = tableName;
            command.Parameters.Add(pTable);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                columns.Add(reader.GetString(0));
            }

            return columns;
        }

        private static string QuoteIdentifier(string identifier)
        {
            return $"\"{identifier.Replace("\"", "\"\"")}\"";
        }
    }
}
