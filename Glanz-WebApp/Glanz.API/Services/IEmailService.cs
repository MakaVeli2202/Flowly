namespace Glanz.API.Services
{
    public interface IEmailService
    {
        /// <summary>Sends a 6-digit OTP to verify the user's email address on registration.</summary>
        Task SendEmailVerificationAsync(string toEmail, string toName, string otp);

        /// <summary>Sends a password-reset link containing a signed token.</summary>
        Task SendPasswordResetAsync(string toEmail, string toName, string resetUrl);
    }
}
