using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Data;

public static class AdminAccountBootstrapper
{
    public static async Task SyncFromConfigurationAsync(IServiceProvider services, IConfiguration configuration)
    {
        using var scope = services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminAccountBootstrapper");

        try
        {
            var autoSyncOnStartup = configuration.GetValue("AdminUser:AutoSyncOnStartup", false);
            if (!autoSyncOnStartup)
                return;

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

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
                    IsEmailVerified = true,
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
            var passwordMatches = false;

            if (!string.IsNullOrWhiteSpace(currentHash) && currentHash.StartsWith("$2", StringComparison.Ordinal))
            {
                try
                {
                    passwordMatches = BCrypt.Net.BCrypt.Verify(password, currentHash);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Admin auto-sync found malformed password hash for {Email}; forcing rehash.", existing.Email);
                    passwordMatches = false;
                }
            }

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

            if (!existing.IsEmailVerified)
            {
                existing.IsEmailVerified = true;
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
        catch (Exception ex)
        {
            logger.LogError(ex, "Admin auto-sync failed unexpectedly; startup will continue without sync.");
        }
    }
}