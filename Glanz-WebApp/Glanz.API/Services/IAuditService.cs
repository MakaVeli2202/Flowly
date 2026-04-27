namespace Glanz.API.Services
{
    public interface IAuditService
    {
        Task LogAsync(
            string action,
            int?   userId     = null,
            string? userEmail = null,
            string? entityType = null,
            string? entityId   = null,
            object? metadata   = null,
            bool    success    = true);
    }
}
