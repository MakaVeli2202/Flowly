using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Glanz.API.Data;

public static class AdminAccountBootstrapper
{
    public static async Task EnsureAdminUserAsync(IServiceProvider sp, IConfiguration configuration, IHostEnvironment environment)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AdminAccountBootstrapper");

        var adminEmail = (configuration["AdminUser:Email"] ?? "admin@glanz.qa").Trim().ToLowerInvariant();
        var adminPassword = configuration["AdminUser:Password"] ?? "Admin123!";
        var adminFirstName = configuration["AdminUser:FirstName"] ?? "Admin";
        var adminLastName = configuration["AdminUser:LastName"] ?? "User";
        var adminPhone = configuration["AdminUser:Phone"] ?? "+97444444444";

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == adminEmail);
        var now = DateTime.UtcNow;

        if (user == null)
        {
            user = new User
            {
                FirstName = adminFirstName,
                LastName = adminLastName,
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Phone = adminPhone,
                Role = "Admin",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now,
            };

            db.Users.Add(user);
            await db.SaveChangesAsync();
            logger.LogInformation("Admin account created for {Email} in {Environment}", adminEmail, environment.EnvironmentName);
            return;
        }

        var changed = false;

        if (!string.Equals(user.FirstName, adminFirstName, StringComparison.Ordinal))
        {
            user.FirstName = adminFirstName;
            changed = true;
        }

        if (!string.Equals(user.LastName, adminLastName, StringComparison.Ordinal))
        {
            user.LastName = adminLastName;
            changed = true;
        }

        if (!string.Equals(user.Phone, adminPhone, StringComparison.Ordinal))
        {
            user.Phone = adminPhone;
            changed = true;
        }

        if (!string.Equals(user.Email?.Trim(), adminEmail, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = adminEmail;
            changed = true;
        }

        if (!string.Equals(user.Role?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase))
        {
            user.Role = "Admin";
            changed = true;
        }

        if (!user.IsActive)
        {
            user.IsActive = true;
            changed = true;
        }

        var storedHash = user.PasswordHash?.Trim() ?? string.Empty;
        var passwordMatches = false;

        if (!string.IsNullOrWhiteSpace(storedHash) && storedHash.StartsWith("$2", StringComparison.Ordinal))
        {
            passwordMatches = BCrypt.Net.BCrypt.Verify(adminPassword, storedHash);
        }
        else
        {
            passwordMatches = string.Equals(storedHash, adminPassword, StringComparison.Ordinal);
        }

        if (!passwordMatches)
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
            changed = true;
        }

        if (!changed)
        {
            logger.LogInformation("Admin account already in sync for {Email}", adminEmail);
            return;
        }

        user.UpdatedAt = now;
        await db.SaveChangesAsync();
        logger.LogInformation("Admin account synced for {Email} in {Environment}", adminEmail, environment.EnvironmentName);
    }
}