using System.Text.Json;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Services
{
    public class AuditService : IAuditService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _http;

        private static readonly JsonSerializerOptions _json =
            new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        public AuditService(AppDbContext context, IHttpContextAccessor http)
        {
            _context = context;
            _http    = http;
        }

        public async Task LogAsync(
            string  action,
            int?    userId     = null,
            string? userEmail  = null,
            string? entityType = null,
            string? entityId   = null,
            object? metadata   = null,
            bool    success    = true)
        {
            var ip = _http.HttpContext?.Connection.RemoteIpAddress?.ToString();

            _context.AuditLogs.Add(new AuditLog
            {
                Action     = action,
                UserId     = userId,
                UserEmail  = userEmail,
                IpAddress  = ip,
                EntityType = entityType,
                EntityId   = entityId,
                Metadata   = metadata is null ? null : JsonSerializer.Serialize(metadata, _json),
                Success    = success,
                Timestamp  = DateTime.UtcNow,
            });

            await _context.SaveChangesAsync();
        }
    }
}
