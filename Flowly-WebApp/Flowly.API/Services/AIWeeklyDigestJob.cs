using Flowly.API.Data;
using Flowly.API.Modules.AI;
using Microsoft.EntityFrameworkCore;

namespace Flowly.API.Services
{
    /// <summary>
    /// Runs every Monday at 08:00 UTC.
    /// For each active org with an admin email, calls AIService.BusinessInsightsAsync
    /// and emails the digest to every Admin user in that org.
    /// Graceful: skips if Anthropic:ApiKey or Email:SmtpHost is not configured.
    /// </summary>
    public class AIWeeklyDigestJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<AIWeeklyDigestJob> _logger;

        public AIWeeklyDigestJob(IServiceScopeFactory scopes, ILogger<AIWeeklyDigestJob> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            // Initial startup delay so the app is fully ready
            await Task.Delay(TimeSpan.FromMinutes(3), ct);

            while (!ct.IsCancellationRequested)
            {
                var now = DateTime.UtcNow;
                var nextMonday = GetNextMonday(now);
                var delay = nextMonday - now;

                _logger.LogInformation("AIWeeklyDigestJob: next run at {NextRun} UTC (in {Hours:F1}h)",
                    nextMonday, delay.TotalHours);

                try
                {
                    await Task.Delay(delay, ct);
                }
                catch (TaskCanceledException)
                {
                    break;
                }

                try
                {
                    await RunAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AIWeeklyDigestJob: error during run");
                }
            }
        }

        private async Task RunAsync(CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ai = scope.ServiceProvider.GetRequiredService<IAIService>();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

            var anthropicKey = config["Anthropic:ApiKey"];
            if (string.IsNullOrWhiteSpace(anthropicKey) || anthropicKey == "YOUR_ANTHROPIC_API_KEY_HERE")
            {
                _logger.LogWarning("AIWeeklyDigestJob: Anthropic:ApiKey not configured. Skipping.");
                return;
            }

            // Get all active orgs
            var orgs = await db.Organizations
                .Where(o => o.IsActive)
                .Select(o => new { o.Id, o.Name })
                .ToListAsync(ct);

            foreach (var org in orgs)
            {
                if (ct.IsCancellationRequested) break;

                try
                {
                    // Get admin emails for this org
                    var admins = await db.Users
                        .Where(u => u.OrgId == org.Id && u.Role == "Admin" && u.IsActive && u.Email != null)
                        .Select(u => new { u.Email, u.FirstName, u.LastName })
                        .ToListAsync(ct);

                    if (admins.Count == 0) continue;

                    // Generate insights
                    var insights = await ai.BusinessInsightsAsync(org.Id, ct);

                    var html = BuildDigestHtml(org.Name, insights, DateTime.UtcNow);

                    foreach (var admin in admins)
                    {
                        if (string.IsNullOrWhiteSpace(admin.Email)) continue;
                        var name = $"{admin.FirstName} {admin.LastName}".Trim();
                        await email.SendRawAsync(admin.Email, name,
                            $"Weekly Business Digest - {org.Name} - {DateTime.UtcNow:dd MMM yyyy}",
                            html);
                    }

                    _logger.LogInformation("AIWeeklyDigestJob: sent digest for org {OrgId} ({OrgName}) to {Count} admin(s)",
                        org.Id, org.Name, admins.Count);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AIWeeklyDigestJob: failed for org {OrgId}", org.Id);
                }
            }
        }

        private static string BuildDigestHtml(string orgName, string insights, DateTime runAt)
        {
            var insightsHtml = string.Join("<br>",
                insights.Split('\n').Select(l => System.Net.WebUtility.HtmlEncode(l)));

            return $"""
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
                  <div style="background:#1a1a2e;padding:24px 32px;border-radius:12px 12px 0 0">
                    <h1 style="color:#c8a96b;margin:0;font-size:22px">Weekly Business Digest</h1>
                    <p style="color:#aaa;margin:6px 0 0">{System.Net.WebUtility.HtmlEncode(orgName)} &mdash; {runAt:dddd, dd MMMM yyyy}</p>
                  </div>
                  <div style="background:#f9f9f9;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0">
                    <h2 style="color:#333;font-size:16px;margin-top:0">AI Business Insights (last 30 days)</h2>
                    <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e8e8e8;
                                font-size:14px;line-height:1.7;white-space:pre-wrap">
                      {insightsHtml}
                    </div>
                    <p style="color:#888;font-size:12px;margin-top:20px">
                      Generated by Flowly AI &mdash; {runAt:yyyy-MM-dd HH:mm} UTC.<br>
                      Visit your admin dashboard for full analytics.
                    </p>
                  </div>
                </div>
                """;
        }

        private static DateTime GetNextMonday(DateTime from)
        {
            // Next Monday at 08:00 UTC
            var daysUntilMonday = ((int)DayOfWeek.Monday - (int)from.DayOfWeek + 7) % 7;
            if (daysUntilMonday == 0 && from.Hour >= 8) daysUntilMonday = 7;
            var next = from.Date.AddDays(daysUntilMonday).AddHours(8);
            return DateTime.SpecifyKind(next, DateTimeKind.Utc);
        }
    }
}
