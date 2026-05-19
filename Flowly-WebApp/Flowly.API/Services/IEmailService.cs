namespace Flowly.API.Services
{
    public interface IEmailService
    {
        Task SendEmailVerificationAsync(string toEmail, string toName, string otp);
        Task SendPasswordResetAsync(string toEmail, string toName, string resetUrl);
        Task SendInvoiceAsync(string toEmail, string toName, string bookingNumber, string? invoicePdfUrl);
        Task SendRawAsync(string toEmail, string toName, string subject, string htmlBody);
    }
}
