using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Data;

public static class AdminAccountBootstrapper
{
    public static async Task SyncFromConfigurationAsync(IServiceProvider services, IConfiguration configuration)
    {
        var autoSyncOnStartup = configuration.GetValue("AdminUser:AutoSyncOnStartup", false);
        if (!autoSyncOnStartup)
            return;

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminAccountBootstrapper");

        var email = configuration["AdminUser:Email"]?.Trim();
        var password = configuration["AdminUser:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Admin auto-sync skipped: AdminUser:Email or AdminUser:Password is missing.");
            return;
        }

        var firstName = configuration["AdminUser:FirstName"] ?? "Admin";
        var lastName = configuration["AdminUser:LastName"] ?? "User";
        var phone = configuration["AdminUser:Phone"] ?? "+97444444444";
        var normalizedEmail = email.ToLowerInvariant();
        var now = DateTime.UtcNow;

        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (existing == null)
        {
            db.Users.Add(new User
            {
                FirstName = firstName,
                LastName = lastName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Phone = phone,
                Role = "Admin",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            });

            await db.SaveChangesAsync();
            logger.LogInformation("Admin auto-sync created account for {Email}.", email);
            return;
        }

        if (!string.Equals(existing.Role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError("Admin auto-sync aborted: existing account {Email} is role {Role}.", existing.Email, existing.Role);
            return;
        }

        var shouldUpdate = false;

        if (!existing.IsActive)
        {
            existing.IsActive = true;
            shouldUpdate = true;
        }

        var currentHash = existing.PasswordHash?.Trim() ?? string.Empty;
        var passwordMatches = !string.IsNullOrWhiteSpace(currentHash)
            && currentHash.StartsWith("$2")
            && BCrypt.Net.BCrypt.Verify(password, currentHash);

        if (!passwordMatches)
        {
            existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            shouldUpdate = true;
        }

        if (!string.Equals(existing.FirstName, firstName, StringComparison.Ordinal))
        {
            existing.FirstName = firstName;
            shouldUpdate = true;
        }

        if (!string.Equals(existing.LastName, lastName, StringComparison.Ordinal))
        {
            existing.LastName = lastName;
            shouldUpdate = true;
        }

        if (!string.Equals(existing.Phone, phone, StringComparison.Ordinal))
        {
            existing.Phone = phone;
            shouldUpdate = true;
        }

        if (!string.Equals(existing.Email, email, StringComparison.Ordinal))
        {
            existing.Email = email;
            shouldUpdate = true;
        }

        if (shouldUpdate)
        {
            existing.UpdatedAt = now;
            await db.SaveChangesAsync();
            logger.LogInformation("Admin auto-sync updated account for {Email}.", existing.Email);
        }
        else
        {
            logger.LogInformation("Admin auto-sync verified account for {Email}; no update required.", existing.Email);
        }
    }
}