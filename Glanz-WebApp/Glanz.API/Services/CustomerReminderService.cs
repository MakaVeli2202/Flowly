using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Glanz.API.Services
{
    public class CustomerReminderService : BackgroundService
    {
        private readonly ILogger<CustomerReminderService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TimeSpan _checkInterval = TimeSpan.FromDays(1);
        private const int ReminderDaysThreshold = 60;
        private const int FirstReminderDays = 30;
        private const int SecondReminderDays = 45;
        private const int FinalReminderDays = 60;

        public CustomerReminderService(
            ILogger<CustomerReminderService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Customer Reminder Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndSendRemindersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in CustomerReminderService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task CheckAndSendRemindersAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notificationService = scope.ServiceProvider.GetRequiredService<IAdminNotificationService>();

            var now = DateTime.UtcNow;
            var threshold = now.AddDays(-ReminderDaysThreshold);
            var firstReminderThreshold = now.AddDays(-FirstReminderDays);
            var secondReminderThreshold = now.AddDays(-SecondReminderDays);
            var finalReminderThreshold = now.AddDays(-FinalReminderDays);

            var atRiskCustomers = await context.Users
                .Where(u => u.Role == "Customer" && u.IsActive && u.TotalBookingsCount > 0)
                .ToListAsync();

            foreach (var customer in atRiskCustomers)
            {
                if (!customer.LastBookedDate.HasValue) continue;

                var daysSinceLastBooking = (now - customer.LastBookedDate.Value).TotalDays;

                if (daysSinceLastBooking >= FinalReminderDays && !customer.Tags?.Contains("At-Risk-Notified-60") == true)
                {
                    await SendReminderAsync(context, notificationService, customer, 60);
                    customer.Tags = AppendTag(customer.Tags, "At-Risk-Notified-60");
                }
                else if (daysSinceLastBooking >= SecondReminderDays && !customer.Tags?.Contains("At-Risk-Notified-45") == true)
                {
                    await SendReminderAsync(context, notificationService, customer, 45);
                    customer.Tags = AppendTag(customer.Tags, "At-Risk-Notified-45");
                }
                else if (daysSinceLastBooking >= FirstReminderDays && !customer.Tags?.Contains("At-Risk-Notified-30") == true)
                {
                    await SendReminderAsync(context, notificationService, customer, 30);
                    customer.Tags = AppendTag(customer.Tags, "At-Risk-Notified-30");
                }
            }

            await context.SaveChangesAsync();
            _logger.LogInformation($"Checked {atRiskCustomers.Count} at-risk customers for reminders");
        }

        private async Task SendReminderAsync(
            AppDbContext context, 
            IAdminNotificationService notificationService, 
            User customer, 
            int daysAgo)
        {
            try
            {
                if (!string.IsNullOrEmpty(customer.ExpoPushToken))
                {
                    var message = daysAgo switch
                    {
                        30 => $"It's been a month since your last detail! Book now and get 10% off your next service.",
                        45 => $"We miss you! It's been 45 days. Come back and enjoy our best services.",
                        60 => $"It's been 2 months! We really miss you. Special offer just for you - 20% off this week!",
                        _ => $"It's been a while! We'd love to see you again."
                    };

                    await notificationService.SendPushNotificationAsync(
                        customer.ExpoPushToken,
                        "We miss you!",
                        message);

                    _logger.LogInformation($"Sent {daysAgo}-day reminder to customer {customer.Id}");
                }

                var notification = new Notification
                {
                    UserId = customer.Id,
                    Message = daysAgo switch
                    {
                        30 => "It's been a month since your last detail. Book now for 10% off!",
                        45 => "It's been 45 days. Come back and enjoy 15% off!",
                        60 => "It's been 2 months! Special offer - 20% off this week!",
                        _ => "We'd love to see you again"
                    },
                    Type = NotificationType.SpecialOffer,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send reminder to customer {customer.Id}");
            }
        }

        private string AppendTag(string? existingTags, string newTag)
        {
            if (string.IsNullOrWhiteSpace(existingTags))
                return newTag;

            var tags = existingTags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            if (!tags.Contains(newTag))
            {
                tags.Add(newTag);
            }
            return string.Join(", ", tags);
        }
    }
}