using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Modules.Booking;

namespace Flowly.API.Modules.RecurringBookings
{
    public class RecurringBookingService : IRecurringBookingService
    {
        private readonly AppDbContext _context;
        private readonly IBookingService _bookingService;
        private readonly ILogger<RecurringBookingService> _logger;

        public RecurringBookingService(
            AppDbContext context,
            IBookingService bookingService,
            ILogger<RecurringBookingService> logger)
        {
            _context = context;
            _bookingService = bookingService;
            _logger = logger;
        }

        public async Task<IEnumerable<RecurringRuleDto>> GetMyRulesAsync(int userId)
        {
            var rules = await _context.RecurringBookingRules
                .AsNoTracking()
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
            return rules.Select(ToDto);
        }

        public async Task<(RecurringRuleDto? Result, string? Error, int StatusCode)> CreateRuleAsync(int userId, int orgId, CreateRecurringRuleDto dto)
        {
            if (!Enum.TryParse<RecurringFrequency>(dto.Frequency, true, out var freq))
                return (null, "Frequency must be 'Weekly' or 'Monthly'.", 400);

            if (freq == RecurringFrequency.Weekly && (dto.DayOfWeek == null || dto.DayOfWeek < 0 || dto.DayOfWeek > 6))
                return (null, "DayOfWeek (0-6) required for weekly frequency.", 400);

            if (freq == RecurringFrequency.Monthly && (dto.DayOfMonth == null || dto.DayOfMonth < 1 || dto.DayOfMonth > 28))
                return (null, "DayOfMonth (1-28) required for monthly frequency.", 400);

            if (dto.PackageIds == null || dto.PackageIds.Count == 0)
                return (null, "At least one package is required.", 400);

            var nextDate = ComputeNextDate(freq, dto.DayOfWeek, dto.DayOfMonth);

            var rule = new RecurringBookingRule
            {
                OrgId              = orgId,
                UserId             = userId,
                Frequency          = freq,
                DayOfWeek          = dto.DayOfWeek,
                DayOfMonth         = dto.DayOfMonth,
                PreferredTimeSlot  = dto.PreferredTimeSlot,
                PackageIdsJson     = JsonSerializer.Serialize(dto.PackageIds),
                PreferredWorkerId  = dto.PreferredWorkerId,
                VehicleType        = dto.VehicleType,
                VehicleMake        = dto.VehicleMake,
                VehicleModel       = dto.VehicleModel,
                VehicleYear        = dto.VehicleYear,
                CustomerAddress    = dto.CustomerAddress,
                NextScheduledDate  = nextDate,
                IsActive           = true,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow,
            };

            _context.RecurringBookingRules.Add(rule);
            await _context.SaveChangesAsync();
            return (ToDto(rule), null, 201);
        }

        public async Task<(string? Error, int StatusCode)> PauseRuleAsync(int userId, int id)
        {
            var rule = await _context.RecurringBookingRules.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (rule == null) return ("Rule not found.", 404);
            rule.IsActive  = false;
            rule.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> ResumeRuleAsync(int userId, int id)
        {
            var rule = await _context.RecurringBookingRules.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (rule == null) return ("Rule not found.", 404);
            rule.IsActive         = true;
            rule.NextScheduledDate = ComputeNextDate(rule.Frequency, rule.DayOfWeek, rule.DayOfMonth);
            rule.UpdatedAt        = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteRuleAsync(int userId, int id)
        {
            var rule = await _context.RecurringBookingRules.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (rule == null) return ("Rule not found.", 404);
            _context.RecurringBookingRules.Remove(rule);
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<RecurringRuleDto>> GetAllRulesAdminAsync(int orgId)
        {
            var rules = await _context.RecurringBookingRules
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(r => r.OrgId == orgId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
            return rules.Select(ToDto);
        }

        public async Task ProcessDueRulesAsync(CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;

            var dueRules = await _context.RecurringBookingRules
                .IgnoreQueryFilters()
                .Include(r => r.User)
                .Where(r => r.IsActive && r.NextScheduledDate.Date <= today)
                .ToListAsync(ct);

            foreach (var rule in dueRules)
            {
                try
                {
                    await CreateBookingFromRuleAsync(rule, ct);

                    rule.NextScheduledDate = ComputeNextDate(rule.Frequency, rule.DayOfWeek, rule.DayOfMonth, rule.NextScheduledDate);
                    rule.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process recurring rule {RuleId}", rule.Id);
                }
            }
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private async Task CreateBookingFromRuleAsync(RecurringBookingRule rule, CancellationToken ct)
        {
            if (rule.User == null) return;

            var packageIds = JsonSerializer.Deserialize<List<int>>(rule.PackageIdsJson) ?? new List<int>();
            if (packageIds.Count == 0) return;

            var dto = new DTOs.CreateBookingDto
            {
                ScheduledDate   = rule.NextScheduledDate,
                TimeSlot        = rule.PreferredTimeSlot,
                CustomerName    = $"{rule.User.FirstName} {rule.User.LastName}".Trim(),
                CustomerEmail   = rule.User.Email,
                CustomerPhone   = rule.User.Phone ?? string.Empty,
                CustomerAddress = rule.CustomerAddress ?? rule.User.HomeAddress ?? string.Empty,
                VehicleType     = Enum.TryParse<VehicleType>(rule.VehicleType, true, out var vt) ? vt : VehicleType.Sedan,
                VehicleMake     = rule.VehicleMake,
                VehicleModel    = rule.VehicleModel,
                VehicleYear     = rule.VehicleYear,
                Packages        = packageIds.Select(id => new DTOs.BookingPackageDto { PackageId = id, Quantity = 1 }).ToList(),
                PreferredWorkerId = rule.PreferredWorkerId,
            };

            var (result, error, _) = await _bookingService.CreateBookingAsync(dto, rule.UserId, "en", ct);
            if (result == null)
                _logger.LogWarning("Recurring booking creation failed for rule {RuleId}: {Error}", rule.Id, error);
            else
                _logger.LogInformation("Created recurring booking {BookingNumber} for rule {RuleId}", result.BookingNumber, rule.Id);
        }

        private static DateTime ComputeNextDate(
            RecurringFrequency freq, int? dayOfWeek, int? dayOfMonth, DateTime? from = null)
        {
            var start = (from ?? DateTime.UtcNow).Date.AddDays(1); // always at least tomorrow

            if (freq == RecurringFrequency.Weekly && dayOfWeek.HasValue)
            {
                var targetDow = (DayOfWeek)dayOfWeek.Value;
                var days = ((int)targetDow - (int)start.DayOfWeek + 7) % 7;
                if (days == 0) days = 7;
                return start.AddDays(days);
            }

            if (freq == RecurringFrequency.Monthly && dayOfMonth.HasValue)
            {
                var target = new DateTime(start.Year, start.Month, Math.Min(dayOfMonth.Value, DateTime.DaysInMonth(start.Year, start.Month)), 0, 0, 0, DateTimeKind.Utc);
                if (target <= start) target = target.AddMonths(1);
                return target;
            }

            return start.AddDays(7); // fallback
        }

        private static RecurringRuleDto ToDto(RecurringBookingRule r)
        {
            var packageIds = new List<int>();
            try { packageIds = JsonSerializer.Deserialize<List<int>>(r.PackageIdsJson) ?? new List<int>(); } catch { }

            return new RecurringRuleDto
            {
                Id                = r.Id,
                Frequency         = r.Frequency.ToString(),
                DayOfWeek         = r.DayOfWeek,
                DayOfMonth        = r.DayOfMonth,
                PreferredTimeSlot = r.PreferredTimeSlot,
                PackageIds        = packageIds,
                PreferredWorkerId = r.PreferredWorkerId,
                VehicleType       = r.VehicleType,
                VehicleMake       = r.VehicleMake,
                VehicleModel      = r.VehicleModel,
                VehicleYear       = r.VehicleYear,
                CustomerAddress   = r.CustomerAddress,
                NextScheduledDate = r.NextScheduledDate,
                IsActive          = r.IsActive,
                CreatedAt         = r.CreatedAt,
            };
        }
    }
}
