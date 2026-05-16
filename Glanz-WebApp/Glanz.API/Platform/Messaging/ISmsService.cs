namespace Glanz.API.Platform.Messaging
{
    public interface ISmsService
    {
        /// <summary>Send an SMS or WhatsApp message to a phone number.</summary>
        /// <param name="to">E.164 format, e.g. +97412345678</param>
        /// <param name="message">Plain text message body</param>
        /// <param name="useWhatsApp">If true, send via WhatsApp channel (provider must support it)</param>
        Task<(bool Success, string? Error)> SendAsync(string to, string message, bool useWhatsApp = false);
    }

    /// <summary>No-op implementation used when no SMS provider is configured.</summary>
    public class NullSmsService : ISmsService
    {
        public Task<(bool Success, string? Error)> SendAsync(string to, string message, bool useWhatsApp = false)
            => Task.FromResult((false, "SMS provider not configured"));
    }
}
