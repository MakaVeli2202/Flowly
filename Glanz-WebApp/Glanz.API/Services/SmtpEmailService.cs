using System.Net;
using System.Net.Mail;

namespace Glanz.API.Services
{
    /// <summary>
    /// Sends transactional emails via SMTP.
    ///
    /// Configuration (appsettings.json → "Email" section):
    ///   SmtpHost     — e.g. "smtp.gmail.com" or "smtp.sendgrid.net"
    ///   SmtpPort     — typically 587 (STARTTLS) or 465 (SSL)
    ///   SmtpUser     — SMTP username / SendGrid API key
    ///   SmtpPassword — SMTP password / SendGrid API key
    ///   FromAddress  — sender address shown to recipients
    ///   FromName     — sender display name
    ///
    /// In development (or when SmtpHost is not configured) the email is NOT sent —
    /// the OTP / reset URL is written to the application log instead so you can test
    /// the full flow without an SMTP account.
    ///
    /// TODO: Free SMTP options:
    ///   - Gmail:      smtp.gmail.com:587  (500 emails/day with App Password)
    ///   - SendGrid:   smtp.sendgrid.net:587 (100 emails/day on free tier)
    ///   - Resend.com: SMTP or HTTP API (3 000 emails/month free)
    ///   - Mailpit:    local dev SMTP catcher (https://mailpit.axllent.org)
    /// </summary>
    public class SmtpEmailService : IEmailService
    {
        private readonly IConfiguration      _config;
        private readonly ILogger<SmtpEmailService> _logger;
        private readonly IWebHostEnvironment _env;

        public SmtpEmailService(
            IConfiguration config,
            ILogger<SmtpEmailService> logger,
            IWebHostEnvironment env)
        {
            _config = config;
            _logger = logger;
            _env    = env;
        }

        public async Task SendEmailVerificationAsync(string toEmail, string toName, string otp)
        {
            var subject = "Verify your Glanz account";
            var html = $"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#c8a96b">Verify your email</h2>
                  <p>Hi {WebUtility.HtmlEncode(toName)},</p>
                  <p>Use the code below to verify your Glanz account. It expires in 24 hours.</p>
                  <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                              text-align:center;padding:20px;background:#f5f5f5;
                              border-radius:8px;margin:24px 0">{otp}</div>
                  <p style="color:#888;font-size:13px">
                    If you didn't create an account you can safely ignore this email.
                  </p>
                </div>
                """;

            await SendAsync(toEmail, subject, html,
                devLogMessage: $"[EMAIL VERIFICATION] To: {toEmail}  OTP: {otp}");
        }

        public async Task SendPasswordResetAsync(string toEmail, string toName, string resetUrl)
        {
            var subject = "Reset your Glanz password";
            var html = $"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#c8a96b">Reset your password</h2>
                  <p>Hi {WebUtility.HtmlEncode(toName)},</p>
                  <p>Click the button below to set a new password. This link expires in 1 hour.</p>
                  <a href="{resetUrl}" style="display:inline-block;padding:12px 28px;
                     background:#c8a96b;color:#fff;text-decoration:none;border-radius:6px;
                     font-weight:bold;margin:16px 0">Reset password</a>
                  <p style="color:#888;font-size:13px">
                    If you didn't request a password reset you can safely ignore this email.
                  </p>
                  <p style="color:#aaa;font-size:12px;word-break:break-all">{resetUrl}</p>
                </div>
                """;

            await SendAsync(toEmail, subject, html,
                devLogMessage: $"[PASSWORD RESET] To: {toEmail}  URL: {resetUrl}");
        }

        public async Task SendInvoiceAsync(string toEmail, string toName, string bookingNumber, string? invoicePdfUrl)
        {
            var subject = $"Your invoice – Booking #{bookingNumber}";
            var downloadSection = string.IsNullOrEmpty(invoicePdfUrl)
                ? "<p style='color:#888;font-size:13px'>Your invoice is being prepared and will be available shortly.</p>"
                : $"""<a href="{invoicePdfUrl}" style="display:inline-block;padding:12px 28px;background:#c8a96b;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0">Download Invoice PDF</a><p style='color:#aaa;font-size:12px;word-break:break-all'>{invoicePdfUrl}</p>""";

            var html = $"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#c8a96b">Thank you for your booking!</h2>
                  <p>Hi {WebUtility.HtmlEncode(toName)},</p>
                  <p>Your service has been completed. Please find your invoice below for booking <strong>#{bookingNumber}</strong>.</p>
                  {downloadSection}
                  <p style="color:#888;font-size:13px">Thank you for choosing us. We look forward to serving you again.</p>
                </div>
                """;

            await SendAsync(toEmail, subject, html,
                devLogMessage: $"[INVOICE EMAIL] To: {toEmail}  Booking: #{bookingNumber}  PDF: {invoicePdfUrl ?? "N/A"}");
        }

        // ── Internal ──────────────────────────────────────────────────────────

        private async Task SendAsync(string toEmail, string subject, string htmlBody, string devLogMessage)
        {
            var host = _config["Email:SmtpHost"];

            // Dev mode or SMTP not configured: print directly to console so the OTP
            // is always visible regardless of log level or filtering.
            if (_env.IsDevelopment() || string.IsNullOrWhiteSpace(host)
                || host.StartsWith("TODO", StringComparison.OrdinalIgnoreCase))
            {
                var border = new string('=', 64);
                Console.WriteLine();
                Console.WriteLine(border);
                Console.WriteLine($"  DEV EMAIL (not sent)");
                Console.WriteLine($"  {devLogMessage}");
                Console.WriteLine(border);
                Console.WriteLine();
                return;
            }

            var port     = _config.GetValue<int>("Email:SmtpPort", 587);
            var user     = _config["Email:SmtpUser"]     ?? "";
            var password = _config["Email:SmtpPassword"] ?? "";
            var from     = _config["Email:FromAddress"]  ?? "noreply@glanz.qa";
            var fromName = _config["Email:FromName"]     ?? "Glanz";

            using var client = new SmtpClient(host, port)
            {
                EnableSsl   = true,
                Credentials = new NetworkCredential(user, password),
            };

            using var message = new MailMessage
            {
                From       = new MailAddress(from, fromName),
                Subject    = subject,
                Body       = htmlBody,
                IsBodyHtml = true,
            };
            message.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(message);
                _logger.LogInformation("[Email] Sent '{Subject}' to {Email}", subject, toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Email] Failed to send '{Subject}' to {Email}", subject, toEmail);
                throw;
            }
        }
    }
}
