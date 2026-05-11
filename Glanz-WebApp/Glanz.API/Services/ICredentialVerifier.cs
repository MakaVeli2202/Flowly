namespace Glanz.API.Services;

public interface ICredentialVerifier
{
    PasswordVerificationResult Verify(string incomingPassword, string? storedHash);
}

public sealed class PasswordVerificationResult
{
    public bool IsValid { get; init; }
    public bool UsedTrimmedInput { get; init; }
    public bool RequiresUpgrade { get; init; }
    public string? UpgradedHash { get; init; }
}
