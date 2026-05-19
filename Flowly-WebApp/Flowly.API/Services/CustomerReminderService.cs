using Flowly.API.Data;
using Flowly.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Flowly.API.Services
{
    public class CustomerReminderService : BackgroundService
    {
        private readonly ILogger<CustomerReminderService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TimeSpan _checkInterval = TimeSpan.FromDays(1);

        public CustomerReminderService(ILogger<CustomerReminderService> logger, IServiceScopeFactory scopeFactory)
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
                    await ProcessRemindersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in CustomerReminderService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task ProcessRemindersAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notificationService = scope.ServiceProvider.GetRequiredService<IAdminNotificationService>();

            var orgIds = await context.Organizations.Select(o => o.Id).ToListAsync();

            int processed = 0;
            foreach (var orgId in orgIds)
            {
                // Rules drive reminder schedule: DelayMinutes stores inactivity threshold in minutes
                var rules = await context.AutomationRules
                    .AsNoTracking()
                    .Where(r => r.OrgId == orgId && r.TriggerEvent == "CustomerInactive" && r.IsActive)
                    .OrderBy(r => r.DelayMinutes)
                    .ToListAsync();

                if (!rules.Any()) continue;

                var customers = await context.Users
                    .Where(u => u.Role == "Customer" && u.IsActive && u.TotalBookingsCount > 0)
                    .ToListAsync();

                foreach (var customer in customers)
                {
                    if (!customer.LastBookedDate.HasValue) continue;

                    var inactiveMinutes = (int)(DateTime.UtcNow - customer.LastBookedDate.Value).TotalMinutes;

                    foreach (var rule in rules)
                    {
                        var tagKey = $"AutoReminder-{rule.Id}";

                        if (inactiveMinutes >= rule.DelayMinutes && customer.Tags?.Contains(tagKey) != true)
                        {
                            await ExecuteRuleAsync(context, notificationService, customer, rule);
                            customer.Tags = AppendTag(customer.Tags, tagKey);
                            processed++;
                            break; // one rule per run per customer
                        }
                    }
                }

                await context.SaveChangesAsync();
            }

            _logger.LogInformation("CustomerReminderService processed {Count} reminders", processed);
        }

        private async Task ExecuteRuleAsync(
            AppDbContext context,
            IAdminNotificationService notificationService,
            User customer,
            AutomationRule rule)
        {
            try
            {
                string message = "We miss you! It's been a while.";
                string title = "We miss you!";

                if (rule.ConfigJson != null)
                {
                    try
                    {
                        var config = JsonSerializer.Deserialize<Dictionary<string, string>>(rule.ConfigJson);
                        if (config != null)
                        {
                            config.TryGetValue("message", out message!);
                            config.TryGetValue("title", out title!);
                            message ??= "We miss you! It's been a while.";
                            title ??= "We miss you!";
                        }
                    }
                    catch { }
                }

                if (rule.ActionType == "SendReminderPush" && !string.IsNullOrEmpty(customer.ExpoPushToken))
                    await notificationService.SendPushNotificationAsync(customer.ExpoPushToken, title, message);

                context.Notifications.Add(new Notification
                {
                    UserId = customer.Id,
                    Message = message,
                    Type = NotificationType.SpecialOffer,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                });

                _logger.LogInformation("Executed rule {RuleId} ({Action}) for customer {CustomerId}", rule.Id, rule.ActionType, customer.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute rule {RuleId} for customer {CustomerId}", rule.Id, customer.Id);
            }
        }

        private static string AppendTag(string? existingTags, string newTag)
        {
            if (string.IsNullOrWhiteSpace(existingTags)) return newTag;
            var tags = existingTags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            if (!tags.Contains(newTag)) tags.Add(newTag);
            return string.Join(", ", tags);
        }
    }
}
