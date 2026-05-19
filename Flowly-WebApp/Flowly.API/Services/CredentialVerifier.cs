namespace Flowly.API.Services;

public class CredentialVerifier : ICredentialVerifier
{
    public PasswordVerificationResult Verify(string incomingPassword, string? storedHash)
    {
        if (string.IsNullOrWhiteSpace(incomingPassword) || string.IsNullOrWhiteSpace(storedHash))
            return new PasswordVerificationResult { IsValid = false };

        var normalizedStoredHash = storedHash.Trim();
        var trimmedIncoming = incomingPassword.Trim();
        var usedTrimmedInput = !string.Equals(trimmedIncoming, incomingPassword, StringComparison.Ordinal);

        if (normalizedStoredHash.StartsWith("$2", StringComparison.Ordinal))
        {
            var bcryptMatch = BCrypt.Net.BCrypt.Verify(incomingPassword, normalizedStoredHash);
            if (!bcryptMatch && usedTrimmedInput)
                bcryptMatch = BCrypt.Net.BCrypt.Verify(trimmedIncoming, normalizedStoredHash);

            return new PasswordVerificationResult
            {
                IsValid = bcryptMatch,
                UsedTrimmedInput = bcryptMatch && usedTrimmedInput,
            };
        }

        var plainMatch = string.Equals(normalizedStoredHash, incomingPassword, StringComparison.Ordinal)
                         || (usedTrimmedInput && string.Equals(normalizedStoredHash, trimmedIncoming, StringComparison.Ordinal));

        if (!plainMatch)
            return new PasswordVerificationResult { IsValid = false };

        return new PasswordVerificationResult
        {
            IsValid = true,
            UsedTrimmedInput = usedTrimmedInput,
            RequiresUpgrade = true,
            UpgradedHash = BCrypt.Net.BCrypt.HashPassword(trimmedIncoming),
        };
    }
}
