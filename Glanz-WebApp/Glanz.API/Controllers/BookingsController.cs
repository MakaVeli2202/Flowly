using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;
using System.Data;
using System.Text.Json;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class BookingsController : ControllerBase
    {
        private static readonly TimeSpan WorkerArrivalNotificationCooldown = TimeSpan.FromMinutes(5);
        private const int DefaultWorkerTravelBufferMinutes = 30; // fallback only â€” runtime value read from SystemSettings
        private static TimeZoneInfo BusinessTimeZone = ResolveBusinessTimeZone(null);

        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IAdminNotificationService _adminNotificationService;
        private readonly IPricingService _pricingService;
        private readonly IAuditService _audit;
        private readonly CouponRateLimiter _couponLimiter;
        private readonly IWebHostEnvironment _env;
        private readonly IObjectStorageService _objectStorage;
        private readonly IReferralService _referralService;
        private readonly ILocalizationTextResolver _localizationTextResolver;

        public BookingsController(
            AppDbContext context,
            IConfiguration configuration,
            IAdminNotificationService adminNotificationService,
            IPricingService pricingService,
            IAuditService audit,
            CouponRateLimiter couponLimiter,
            IWebHostEnvironment env,
            IObjectStorageService objectStorage,
            IReferralService referralService,
            ILocalizationTextResolver localizationTextResolver)
        {
            _context = context;
            _configuration = configuration;
            _adminNotificationService = adminNotificationService;
            _pricingService = pricingService;
            _audit = audit;
            _couponLimiter = couponLimiter;
            _env = env;
            _objectStorage = objectStorage;
            _referralService = referralService;
            _localizationTextResolver = localizationTextResolver;
        }

        private string ResolveRequestedLanguage()
        {
            var queryLang = Request.Query["lang"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(queryLang))
                return queryLang;

            var header = Request.Headers["Accept-Language"].FirstOrDefault()
                         ?? Request.Headers["X-Language"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(header)) return "en";

            return header.Split(',')[0].Split('-')[0].Trim().ToLowerInvariant();
        }

        private int? GetUserId() => User.GetCurrentUserId();

        // Business-hours window that defines the bookable day.
        // Configurable via BusinessSettings:DayStart / DayEnd in appsettings.json.
        // Rebuilt once at startup by ApplyConfiguredTimeZone (same call that sets the timezone).
        private static readonly Dictionary<string, List<string>> DefaultDailyTimeSlotsByDay = new()
        {
            { "Sunday",    BuildDailyTimeSlots("09:00", "18:00") },
            { "Monday",    BuildDailyTimeSlots("09:00", "18:00") },
            { "Tuesday",   BuildDailyTimeSlots("09:00", "18:00") },
            { "Wednesday", BuildDailyTimeSlots("09:00", "18:00") },
            { "Thursday",  BuildDailyTimeSlots("09:00", "18:00") },
            { "Friday",    BuildDailyTimeSlots("09:00", "18:00") },
            { "Saturday",  BuildDailyTimeSlots("09:00", "18:00") },
        };

        private static readonly Dictionary<string, (string Start, string End)> DefaultDayBounds = new()
        {
            { "Sunday",    ("09:00", "18:00") },
            { "Monday",    ("09:00", "18:00") },
            { "Tuesday",   ("09:00", "18:00") },
            { "Wednesday", ("09:00", "18:00") },
            { "Thursday",  ("09:00", "18:00") },
            { "Friday",    ("00:00", "00:00") },
            { "Saturday",  ("10:00", "16:00") },
        };

        private static Dictionary<string, List<string>> _dailyTimeSlotsByDay = new(DefaultDailyTimeSlotsByDay);
        private static Dictionary<string, (string Start, string End)> _dayBounds = new(DefaultDayBounds);

        internal static void ApplyConfiguredBusinessHours(string? dayStart, string? dayEnd)
        {
            var start = string.IsNullOrWhiteSpace(dayStart) ? "09:00" : dayStart.Trim();
            var end   = string.IsNullOrWhiteSpace(dayEnd)   ? "18:00" : dayEnd.Trim();

            foreach (var day in _dailyTimeSlotsByDay.Keys.ToList())
            {
                _dailyTimeSlotsByDay[day] = BuildDailyTimeSlots(start, end);
            }

            foreach (var day in _dayBounds.Keys.ToList())
            {
                _dayBounds[day] = (start, end);
            }
        }

        private static List<string> GetDailyTimeSlots(string dayName)
        {
            return _dailyTimeSlotsByDay.TryGetValue(dayName, out var slots) ? slots : new List<string>();
        }

        private static (string Start, string End) GetDayBounds(string dayName)
        {
            return _dayBounds.TryGetValue(dayName, out var bounds) ? bounds : ("09:00", "18:00");
        }

        internal static void SetBusinessHoursFromSettings(BusinessHoursPerDayDto? hours)
        {
            if (hours == null) return;

            var dayMap = new Dictionary<string, string>
            {
                { "Sunday",    hours.Sunday    ?? "09:00-18:00" },
                { "Monday",    hours.Monday    ?? "09:00-18:00" },
                { "Tuesday",   hours.Tuesday   ?? "09:00-18:00" },
                { "Wednesday", hours.Wednesday ?? "09:00-18:00" },
                { "Thursday",  hours.Thursday  ?? "09:00-18:00" },
                { "Friday",    hours.Friday    ?? "00:00-00:00" },
                { "Saturday",  hours.Saturday  ?? "10:00-16:00" },
            };

            foreach (var (day, range) in dayMap)
            {
                var parts = range.Split('-');
                if (parts.Length == 2)
                {
                    var s = parts[0].Trim();
                    var e = parts[1].Trim();
                    _dailyTimeSlotsByDay[day] = BuildDailyTimeSlots(s, e);
                    _dayBounds[day] = (s, e);
                }
            }
        }

        private static List<string> BuildDailyTimeSlots(string dayStart, string dayEnd)
        {
            if (!TimeSpan.TryParse(dayStart, out var start) || !TimeSpan.TryParse(dayEnd, out var end) || end <= start)
            {
                return new List<string>();
            }

            var slots = new List<string>();
            var current = start;
            var stepHour = TimeSpan.FromHours(1);
            while (current + stepHour <= end)
            {
                var next = current + stepHour;
                slots.Add($"{(int)current.TotalHours:00}:{current.Minutes:00}-{(int)next.TotalHours:00}:{next.Minutes:00}");
                current = next;
            }
            return slots;
        }

        private const int SlotSelectionStepMinutes = 30;

        private const int DefaultMaxBookingsPerSlot = 3;
        private const string AutoAssignSettingKey = "bookings.autoAssignEnabled";

        private class AppliedOfferResult
        {
            public Offer Offer { get; set; } = null!;
            public UserOffer? UserOffer { get; set; }
            public string AppliedCode { get; set; } = string.Empty;
        }

        private static bool TryParseTimeSlot(string slot, out TimeSpan start, out TimeSpan end)
        {
            start = default;
            end = default;

            var parts = slot.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
            {
                return false;
            }

            return TimeSpan.TryParse(parts[0], out start) && TimeSpan.TryParse(parts[1], out end);
        }

        private static bool TryGetBusinessDayBounds(string dayName, out int dayStartMinutes, out int dayEndMinutes)
        {
            var (start, end) = GetDayBounds(dayName);
            if (!TimeSpan.TryParse(start, out var shiftStart) || !TimeSpan.TryParse(end, out var shiftEnd))
            {
                dayStartMinutes = 0;
                dayEndMinutes = 0;
                return false;
            }
            dayStartMinutes = (int)shiftStart.TotalMinutes;
            dayEndMinutes = (int)shiftEnd.TotalMinutes;
            return dayEndMinutes > dayStartMinutes;
        }

        private static bool TryGetBusinessDayBounds(out int dayStartMinutes, out int dayEndMinutes)
        {
            var nowBusiness = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone);
            var dayName = nowBusiness.DayOfWeek.ToString();
            return TryGetBusinessDayBounds(dayName, out dayStartMinutes, out dayEndMinutes);
        }

        private static string FormatTimeSlotStart(TimeSpan start)
        {
            return $"{(int)start.TotalHours:00}:{start.Minutes:00}";
        }

        private static List<string> BuildCandidateStartSlots(int durationMinutes, string? dayName = null)
        {
            var candidateSlots = new List<string>();
            int dayStartMinutes, dayEndMinutes;

            if (dayName != null)
            {
                if (!TryGetBusinessDayBounds(dayName, out dayStartMinutes, out dayEndMinutes))
                    return candidateSlots;
            }
            else
            {
                if (!TryGetBusinessDayBounds(out dayStartMinutes, out dayEndMinutes))
                    return candidateSlots;
            }

            for (var startMinutes = dayStartMinutes; startMinutes + durationMinutes <= dayEndMinutes; startMinutes += SlotSelectionStepMinutes)
            {
                candidateSlots.Add(FormatTimeSlotStart(TimeSpan.FromMinutes(startMinutes)));
            }

            return candidateSlots;
        }


        private static bool TryParseSlotStart(string slot, out TimeSpan slotStart)
        {
            slotStart = default;

            if (string.IsNullOrWhiteSpace(slot))
            {
                return false;
            }

            var normalized = slot.Trim();

            if (normalized.Contains('-'))
            {
                return TryParseTimeSlot(normalized, out slotStart, out _);
            }

            return TimeSpan.TryParse(normalized, out slotStart);
        }

        internal static void ApplyConfiguredTimeZone(string? tzId)
        {
            if (!string.IsNullOrWhiteSpace(tzId))
                BusinessTimeZone = ResolveBusinessTimeZone(tzId);
        }

        private static TimeZoneInfo ResolveBusinessTimeZone(string? tzId)
        {
            // Try IANA or Windows timezone ID from config first.
            if (!string.IsNullOrWhiteSpace(tzId))
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); } catch { }
            }
            // Fallback: Arab Standard Time (Qatar, UTC+3) â€” kept for backward compat.
            try { return TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"); } catch { }
            return TimeZoneInfo.Utc;
        }

        private static bool IsSlotInPastForBusinessDay(DateTime targetDateUtc, string startSlot)
        {
            if (!TryParseSlotStart(startSlot, out var slotStart))
            {
                return true;
            }

            var nowBusiness = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone);
            var targetBusinessDate = TimeZoneInfo.ConvertTimeFromUtc(targetDateUtc, BusinessTimeZone).Date;

            if (targetBusinessDate < nowBusiness.Date)
            {
                return true;
            }

            if (targetBusinessDate > nowBusiness.Date)
            {
                return false;
            }

            return slotStart <= nowBusiness.TimeOfDay;
        }

        private static bool WorkerWorksOnDay(string? workingDays, DayOfWeek targetDay)
        {
            if (string.IsNullOrWhiteSpace(workingDays))
            {
                return targetDay is not DayOfWeek.Friday and not DayOfWeek.Saturday;
            }

            var targetFull = targetDay.ToString();
            var targetShort = targetFull[..3];

            var tokens = workingDays
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(d => d.Trim())
                .Where(d => !string.IsNullOrWhiteSpace(d));

            return tokens.Any(day =>
                day.Equals(targetFull, StringComparison.OrdinalIgnoreCase) ||
                day.Equals(targetShort, StringComparison.OrdinalIgnoreCase));
        }

        private static readonly JsonSerializerOptions _dayScheduleJsonOpts = AppJsonOptions.CaseInsensitive;

        /// <summary>
        /// Returns (shiftStart, shiftEnd) for a worker on a specific day,
        /// using per-day overrides from DaySchedulesJson if present.
        /// </summary>
        private static (string ShiftStart, string ShiftEnd) GetWorkerShiftForDay(Staff worker, DayOfWeek dayOfWeek)
        {
            if (!string.IsNullOrWhiteSpace(worker.DaySchedulesJson))
            {
                try
                {
                    var entries = JsonSerializer.Deserialize<List<WorkerDayScheduleEntry>>(
                        worker.DaySchedulesJson, _dayScheduleJsonOpts);
                    var dayName = dayOfWeek.ToString();
                    var entry = entries?.FirstOrDefault(e =>
                        e.Day.Equals(dayName, StringComparison.OrdinalIgnoreCase) ||
                        (dayName.Length >= 3 && e.Day.Equals(dayName[..3], StringComparison.OrdinalIgnoreCase)));
                    if (entry != null && !string.IsNullOrWhiteSpace(entry.ShiftStart) && !string.IsNullOrWhiteSpace(entry.ShiftEnd))
                        return (entry.ShiftStart, entry.ShiftEnd);
                }
                catch { /* fall through */ }
            }
            return (worker.ShiftStart ?? "09:00", worker.ShiftEnd ?? "18:00");
        }

        // Check if a booking time slot falls within a worker's shift.
        // workerTravelBuffer is subtracted from the effective shift start â€” the worker needs
        // this time to travel/prep before the first job. If the shift starts early enough
        // that shiftStart + buffer <= businessOpen, the business-hours floor (enforced by
        // BuildCandidateStartSlots) already satisfies the constraint at no cost to the customer.
        private static bool TimeSlotInWorkerShift(string startSlot, int durationMinutes, string shiftStart, string shiftEnd,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryParseSlotStart(startSlot, out var slotStart))
                return false;
            if (!TimeSpan.TryParse(shiftStart, out var shiftStartTime) || !TimeSpan.TryParse(shiftEnd, out var shiftEndTime))
                return false;

            var slotStartMinutes = slotStart.TotalMinutes;
            var slotEndMinutes = slotStartMinutes + durationMinutes;
            var shiftStartMinutes = shiftStartTime.TotalMinutes;
            var shiftEndMinutes = shiftEndTime.TotalMinutes;

            // Handle overnight shifts (e.g., 20:00 to 06:00)
            if (shiftEndMinutes < shiftStartMinutes)
            {
                if (slotStartMinutes >= shiftStartMinutes + workerTravelBuffer)
                    return slotEndMinutes <= shiftEndMinutes + TimeSpan.FromDays(1).TotalMinutes;
                return slotStartMinutes < shiftEndMinutes && slotEndMinutes <= shiftEndMinutes;
            }

            return slotStartMinutes >= shiftStartMinutes + workerTravelBuffer
                && slotEndMinutes <= shiftEndMinutes;
        }

        private static List<string>? BuildRequiredTimeSlots(string selectedTimeSlot, int totalDurationMinutes, out string error, string? businessDayName = null)
        {
            error = string.Empty;

            var dayName = string.IsNullOrWhiteSpace(businessDayName)
                ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone).DayOfWeek.ToString()
                : businessDayName.Trim();

            if (totalDurationMinutes <= 0)
            {
                error = "Total duration must be greater than zero.";
                return null;
            }

            if (!TryGetBusinessDayBounds(dayName, out var dayStartMinutes, out var dayEndMinutes)
                || !TryParseSlotStart(selectedTimeSlot, out var requestedStart))
            {
                error = "Selected time slot is invalid.";
                return null;
            }

            var requestedStartMinutes = (int)requestedStart.TotalMinutes;
            var requestedEndMinutes = requestedStartMinutes + totalDurationMinutes;

            if (requestedStartMinutes < dayStartMinutes || requestedStartMinutes >= dayEndMinutes)
            {
                error = "Selected time slot is invalid.";
                return null;
            }

            if (requestedEndMinutes > dayEndMinutes)
            {
                error = "Selected time slot does not have enough remaining time for this service duration.";
                return null;
            }

            var requiredSlots = new List<string>();
            foreach (var slot in GetDailyTimeSlots(dayName))
            {
                if (!TryParseTimeSlot(slot, out var slotStart, out var slotEnd))
                {
                    continue;
                }

                var slotStartMinutes = (int)slotStart.TotalMinutes;
                var slotEndMinutes = (int)slotEnd.TotalMinutes;
                var overlapsRequestedWindow = requestedStartMinutes < slotEndMinutes && slotStartMinutes < requestedEndMinutes;
                if (overlapsRequestedWindow)
                {
                    requiredSlots.Add(slot);
                }
            }

            if (requiredSlots.Count == 0)
            {
                error = "Selected time slot is invalid.";
                return null;
            }

            return requiredSlots;
        }

        private static bool TryBuildBookingWindowMinutes(string startSlot, int durationMinutes, out int startMinutes, out int endMinutes)
        {
            startMinutes = 0;
            endMinutes = 0;

            if (durationMinutes <= 0 || !TryParseSlotStart(startSlot, out var slotStart))
            {
                return false;
            }

            startMinutes = (int)slotStart.TotalMinutes;
            endMinutes = startMinutes + durationMinutes;
            return true;
        }

        private static int ResolveBookingDurationMinutes(Booking booking)
        {
            // 1. Range-format TimeSlots (e.g. "10:00-11:00") are authoritative â€”
            //    the range IS the scheduled window regardless of the package estimate.
            if (TryParseTimeSlot(booking.TimeSlot, out var rangeStart, out var rangeEnd))
            {
                var fromSlotRange = (int)Math.Round((rangeEnd - rangeStart).TotalMinutes);
                if (fromSlotRange > 0)
                {
                    return fromSlotRange;
                }
            }

            // 2. Per-item snapshot captured at booking creation time (start-only slots
            //    like "10:00"). Falls back to the live package value for legacy rows
            //    where SnapshotDurationMinutes is 0.
            var durationFromItems = booking.BookingItems?.Sum(bi =>
                bi.SnapshotDurationMinutes > 0 ? bi.SnapshotDurationMinutes : bi.Package.EstimatedDurationMinutes) ?? 0;
            if (durationFromItems > 0)
            {
                return durationFromItems;
            }

            // 3. Legacy fallback: treat unknown duration bookings as one-hour jobs.
            return 60;
        }

        private static bool TryParseShiftWindowMinutes(string shiftStart, string shiftEnd, out int shiftStartMinutes, out int shiftEndMinutes)
        {
            shiftStartMinutes = 0;
            shiftEndMinutes = 0;

            if (!TimeSpan.TryParse(shiftStart, out var start) || !TimeSpan.TryParse(shiftEnd, out var end))
            {
                return false;
            }

            shiftStartMinutes = (int)start.TotalMinutes;
            shiftEndMinutes = (int)end.TotalMinutes;
            return shiftEndMinutes > shiftStartMinutes;
        }

        private static int ComputeStartCapacity(int windowMinutes, int minimumJobDurationMinutes)
        {
            if (windowMinutes < minimumJobDurationMinutes)
            {
                return 0;
            }

            return ((windowMinutes - minimumJobDurationMinutes) / SlotSelectionStepMinutes) + 1;
        }

        private static void CalculateWorkerFreeCapacity(
            IEnumerable<Booking> workerBookings,
            int shiftStartMinutes,
            int shiftEndMinutes,
            int minimumJobDurationMinutes,
            out int usableFreeMinutes,
            out int availableStartCount,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            usableFreeMinutes = 0;
            availableStartCount = 0;

            var blockedIntervals = new List<(int Start, int End)>();

            foreach (var booking in workerBookings)
            {
                var bookingDuration = ResolveBookingDurationMinutes(booking);
                if (!TryBuildBookingWindowMinutes(booking.TimeSlot, bookingDuration, out var bookingStart, out var bookingEnd))
                {
                    continue;
                }

                var blockedStart = Math.Max(shiftStartMinutes, bookingStart - workerTravelBuffer);
                var blockedEnd = Math.Min(shiftEndMinutes, bookingEnd + workerTravelBuffer);
                if (blockedEnd > blockedStart)
                {
                    blockedIntervals.Add((blockedStart, blockedEnd));
                }
            }

            if (blockedIntervals.Count == 0)
            {
                // The buffer from shift start is unavailable (worker travels to first job).
                var fullWindow = shiftEndMinutes - (shiftStartMinutes + workerTravelBuffer);
                if (fullWindow > 0)
                {
                    usableFreeMinutes = fullWindow;
                    availableStartCount = ComputeStartCapacity(fullWindow, minimumJobDurationMinutes);
                }
                return;
            }

            var mergedBlocked = blockedIntervals
                .OrderBy(i => i.Start)
                .ToList();

            var merged = new List<(int Start, int End)>();
            foreach (var interval in mergedBlocked)
            {
                if (merged.Count == 0)
                {
                    merged.Add(interval);
                    continue;
                }

                var last = merged[^1];
                if (interval.Start <= last.End)
                {
                    merged[^1] = (last.Start, Math.Max(last.End, interval.End));
                }
                else
                {
                    merged.Add(interval);
                }
            }

            // Effective available window starts after the pre-shift travel buffer.
            var cursor = shiftStartMinutes + DefaultWorkerTravelBufferMinutes;
            foreach (var interval in merged)
            {
                if (interval.Start > cursor)
                {
                    var freeWindow = interval.Start - cursor;
                    if (freeWindow >= minimumJobDurationMinutes)
                    {
                        usableFreeMinutes += freeWindow;
                        availableStartCount += ComputeStartCapacity(freeWindow, minimumJobDurationMinutes);
                    }
                }

                cursor = Math.Max(cursor, interval.End);
            }

            if (cursor < shiftEndMinutes)
            {
                var trailingFreeWindow = shiftEndMinutes - cursor;
                if (trailingFreeWindow >= minimumJobDurationMinutes)
                {
                    usableFreeMinutes += trailingFreeWindow;
                    availableStartCount += ComputeStartCapacity(trailingFreeWindow, minimumJobDurationMinutes);
                }
            }
        }

        private async Task<int> GetMinimumJobDurationMinutesAsync()
        {
            var minimumPackageDuration = await _context.Packages
                .AsNoTracking()
                .Where(p => p.IsActive && p.EstimatedDurationMinutes > 0)
                .Select(p => (int?)p.EstimatedDurationMinutes)
                .MinAsync();

            return Math.Max(30, minimumPackageDuration ?? 60);
        }

        private static bool HasWorkerTimeConflict(IEnumerable<Booking> workerBookings, string requestedStartSlot, int requestedDurationMinutes,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryBuildBookingWindowMinutes(requestedStartSlot, requestedDurationMinutes, out var requestedStart, out var requestedEnd))
            {
                return true;
            }

            foreach (var existingBooking in workerBookings)
            {
                var existingDuration = ResolveBookingDurationMinutes(existingBooking);
                if (!TryBuildBookingWindowMinutes(existingBooking.TimeSlot, existingDuration, out var existingStart, out var existingEnd))
                {
                    continue;
                }

                var hasEnoughGapBefore = requestedEnd + workerTravelBuffer <= existingStart;
                var hasEnoughGapAfter = requestedStart >= existingEnd + workerTravelBuffer;

                if (!hasEnoughGapBefore && !hasEnoughGapAfter)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool HasBookingTimeOverlap(IEnumerable<Booking> bookings, string requestedStartSlot, int requestedDurationMinutes)
        {
            if (!TryBuildBookingWindowMinutes(requestedStartSlot, requestedDurationMinutes, out var requestedStart, out var requestedEnd))
            {
                return true;
            }

            foreach (var booking in bookings)
            {
                var existingDuration = ResolveBookingDurationMinutes(booking);
                if (!TryBuildBookingWindowMinutes(booking.TimeSlot, existingDuration, out var existingStart, out var existingEnd))
                {
                    continue;
                }

                var overlaps = requestedStart < existingEnd && existingStart < requestedEnd;
                if (overlaps)
                {
                    return true;
                }
            }

            return false;
        }

        private async Task<bool> HasCustomerOverlapBookingAsync(int? userId, string? customerEmail, DateTime scheduledDate, string startSlot, int totalDurationMinutes)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var normalizedEmail = string.IsNullOrWhiteSpace(customerEmail)
                ? null
                : customerEmail.Trim().ToLowerInvariant();

            var bookingDayEnd = bookingDate.AddDays(1);
            var existingBookings = await _context.Bookings
                .Where(b =>
                    b.ScheduledDate >= bookingDate && b.ScheduledDate < bookingDayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed
                    && (
                        (userId.HasValue && (b.UserId == userId.Value || (b.UserId == null && !string.IsNullOrWhiteSpace(normalizedEmail) && b.CustomerEmail.ToLower() == normalizedEmail)))
                        || (!userId.HasValue && !string.IsNullOrWhiteSpace(normalizedEmail) && b.CustomerEmail.ToLower() == normalizedEmail)
                    ))
                .Include(b => b.BookingItems)
                    .ThenInclude(bi => bi.Package)
                .ToListAsync();

            return HasBookingTimeOverlap(existingBookings, startSlot, totalDurationMinutes);
        }

        private async Task<Staff?> FindAutoAssignableWorkerAsync(DateTime scheduledDate, string startSlot, int totalDurationMinutes,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var bookingDay = bookingDate.DayOfWeek;

            var workers = await _context.Staff
                .Where(s => s.IsActive)
                .ToListAsync();

            var eligibleWorkers = workers
                .Where(w => WorkerWorksOnDay(w.WorkingDays, bookingDay))
                .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, bookingDay); return TimeSlotInWorkerShift(startSlot, totalDurationMinutes, ss, se, workerTravelBuffer); })
                .ToList();

            if (eligibleWorkers.Count == 0)
            {
                return null;
            }

            var eligibleWorkerIds = eligibleWorkers.Select(w => w.Id).ToList();

            var autoAssignDayEnd = bookingDate.AddDays(1);
            var sameDayBookings = await _context.Bookings
                .Where(b =>
                    b.AssignedWorkerId.HasValue
                    && eligibleWorkerIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= bookingDate && b.ScheduledDate < autoAssignDayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems)
                    .ThenInclude(bi => bi.Package)
                .ToListAsync();

            var bookingCountByWorker = new Dictionary<int, int>();

            foreach (var sameDayBooking in sameDayBookings)
            {
                if (!sameDayBooking.AssignedWorkerId.HasValue)
                {
                    continue;
                }

                var workerId = sameDayBooking.AssignedWorkerId.Value;
                bookingCountByWorker.TryGetValue(workerId, out var currentCount);
                bookingCountByWorker[workerId] = currentCount + 1;
            }

            var bookingsByWorker = sameDayBookings
                .Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var availableWorkers = eligibleWorkers
                .Where(worker =>
                {
                    var workerBookings = bookingsByWorker.TryGetValue(worker.Id, out var assignedBookings)
                        ? assignedBookings
                        : new List<Booking>();

                    if (HasWorkerTimeConflict(workerBookings, startSlot, totalDurationMinutes, workerTravelBuffer))
                    {
                        return false;
                    }

                    return true;
                })
                .OrderBy(worker => bookingCountByWorker.TryGetValue(worker.Id, out var count) ? count : 0)
                .ThenBy(worker => worker.Id)
                .ToList();

            return availableWorkers.FirstOrDefault();
        }

        private async Task<bool> HasManualPoolCapacityAsync(DateTime scheduledDate, string startSlot, int totalDurationMinutes,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var dayOfWeek = bookingDate.DayOfWeek;

            var workers = await _context.Staff
                .AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var eligibleWorkers = workers
                .Where(w => WorkerWorksOnDay(w.WorkingDays, dayOfWeek))
                .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, dayOfWeek); return TimeSlotInWorkerShift(startSlot, totalDurationMinutes, ss, se, workerTravelBuffer); })
                .ToList();

            if (eligibleWorkers.Count == 0)
            {
                return false;
            }

            var workerIds = eligibleWorkers.Select(w => w.Id).ToList();
            var capacityDayEnd = bookingDate.AddDays(1);
            var sameDayBookings = await _context.Bookings
                .AsNoTracking()
                .Where(b =>
                    b.ScheduledDate >= bookingDate && b.ScheduledDate < capacityDayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed
                    && (!b.AssignedWorkerId.HasValue || workerIds.Contains(b.AssignedWorkerId.Value)))
                .Include(b => b.BookingItems)
                    .ThenInclude(bi => bi.Package)
                .ToListAsync();

            var overlappingBookings = sameDayBookings
                .Where(b => HasBookingTimeOverlap(new[] { b }, startSlot, totalDurationMinutes))
                .ToList();

            var busyWorkerIds = overlappingBookings
                .Where(b => b.AssignedWorkerId.HasValue)
                .Select(b => b.AssignedWorkerId!.Value)
                .Distinct()
                .ToHashSet();

            var unassignedOverlaps = overlappingBookings.Count(b => !b.AssignedWorkerId.HasValue);
            var freeWorkerPool = eligibleWorkers.Count(w => !busyWorkerIds.Contains(w.Id));

            return freeWorkerPool > unassignedOverlaps;
        }

        private static decimal CalculateDiscountAmount(Offer offer, decimal subtotal)
        {
            if (subtotal <= 0)
            {
                return 0;
            }

            return offer.DiscountType switch
            {
                DiscountType.Percentage => Math.Round(subtotal * (offer.DiscountValue / 100m), 2),
                DiscountType.FixedAmount => Math.Round(Math.Min(offer.DiscountValue, subtotal), 2),
                DiscountType.FreeBooking => Math.Round(subtotal, 2),
                _ => 0
            };
        }

        // Vehicle multiplier is now owned by PricingService (reads from SystemSettings).
        // This local helper is kept only for legacy code paths not yet migrated.
        [Obsolete("Use IPricingService.CalculateAsync instead.")]
        private static decimal GetVehicleMultiplier(VehicleType vehicleType) => vehicleType switch
        {
            VehicleType.Motorcycle => 0.8m,
            VehicleType.Sedan => 1.0m,
            VehicleType.SUV => 1.25m,
            VehicleType.Pickup => 1.5m,
            _ => 1.0m
        };

        private static decimal ApplyPercentageDiscount(decimal subtotal, decimal discountPercent)
        {
            if (subtotal <= 0 || discountPercent <= 0)
            {
                return 0;
            }

            return Math.Round(subtotal * (discountPercent / 100m), 2);
        }

        private static string NormalizeAddressType(string? addressType)
        {
            return addressType?.Trim().ToLowerInvariant() switch
            {
                "work" => "Work",
                "other" => "Other",
                _ => "Home"
            };
        }

        private static string? GetAddressByType(User user, string addressType)
        {
            return addressType switch
            {
                "Work" => user.WorkAddress,
                "Other" => user.OtherAddress,
                _ => user.HomeAddress
            };
        }

        private static DateTime NormalizeUtcDate(DateTime value)
        {
            var businessDate = value.Kind switch
            {
                DateTimeKind.Utc => TimeZoneInfo.ConvertTimeFromUtc(value, BusinessTimeZone).Date,
                DateTimeKind.Local => TimeZoneInfo.ConvertTime(value, BusinessTimeZone).Date,
                _ => value.Date
            };

            // Persist normalized booking dates as UTC-midnight values to keep storage consistent.
            return DateTime.SpecifyKind(businessDate, DateTimeKind.Utc);
        }

        private async Task<User?> ResolveBookingUserByEmailAsync(string customerEmail)
        {
            if (string.IsNullOrWhiteSpace(customerEmail))
            {
                return null;
            }

            var normalizedEmail = customerEmail.Trim().ToLowerInvariant();
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
        }

        private async Task<(UserSubscription? Subscription, string? Error)> ResolveApplicableSubscriptionAsync(
            int? bookingUserId,
            int? requestedSubscriptionId,
            VehicleType vehicleType)
        {
            if (!bookingUserId.HasValue && !requestedSubscriptionId.HasValue)
            {
                return (null, null);
            }

            var query = _context.UserSubscriptions
                .AsNoTracking()
                .Include(s => s.Plan)
                .Where(s => s.Status == UserSubscriptionStatus.Active)
                .AsQueryable();

            if (requestedSubscriptionId.HasValue)
            {
                query = query.Where(s => s.Id == requestedSubscriptionId.Value);
            }
            else if (bookingUserId.HasValue)
            {
                query = query.Where(s => s.UserId == bookingUserId.Value);
            }

            var subscription = await query
                .OrderByDescending(s => s.StartDate)
                .FirstOrDefaultAsync();

            if (subscription == null)
            {
                return requestedSubscriptionId.HasValue
                    ? (null, "Selected subscription is no longer active.")
                    : (null, null);
            }

            if (bookingUserId.HasValue && subscription.UserId != bookingUserId.Value)
            {
                return (null, "Selected subscription does not belong to this customer.");
            }

            if (subscription.Plan.VehicleType != vehicleType)
            {
                return (null, $"The active {subscription.Plan.Name} plan only applies to {subscription.Plan.VehicleType} bookings.");
            }

            return (subscription, null);
        }

        private async Task<int> CountValidSlotsForDayAsync(DateTime targetDateUtc, int durationMinutes,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (BookingSlotHelper.IsDateClosed(DateOnly.FromDateTime(targetDateUtc)))
                return 0;

            var dayName = targetDateUtc.DayOfWeek.ToString();
            var workers = await _context.Staff
                .AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var availableWorkers = workers
                .Where(w => WorkerWorksOnDay(w.WorkingDays, targetDateUtc.DayOfWeek))
                .ToList();

            if (availableWorkers.Count == 0)
                return 0;

            var workerIds = availableWorkers.Select(w => w.Id).ToList();

            var countDayEnd = targetDateUtc.AddDays(1);
            var assignedBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue
                    && workerIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= targetDateUtc && b.ScheduledDate < countDayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var unassignedBookings = await _context.Bookings
                .Where(b => !b.AssignedWorkerId.HasValue
                    && b.ScheduledDate >= targetDateUtc && b.ScheduledDate < countDayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var autoAssign = await IsAutoAssignEnabledAsync();
            var bookingsByWorker = assignedBookings
                .Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var count = 0;
            foreach (var startSlot in BuildCandidateStartSlots(durationMinutes, dayName))
            {
                if (IsSlotInPastForBusinessDay(targetDateUtc, startSlot))
                    continue;

                var hasCoverage = availableWorkers.Any(worker =>
                {
                    var (ss, se) = GetWorkerShiftForDay(worker, targetDateUtc.DayOfWeek);
                    if (!TimeSlotInWorkerShift(startSlot, durationMinutes, ss, se, workerTravelBuffer))
                        return false;
                    var wb = bookingsByWorker.TryGetValue(worker.Id, out var a) ? a : new List<Booking>();
                    return !HasWorkerTimeConflict(wb, startSlot, durationMinutes, workerTravelBuffer);
                });

                if (!hasCoverage)
                    continue;

                if (!autoAssign)
                {
                    var eligible = availableWorkers
                        .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, targetDateUtc.DayOfWeek); return TimeSlotInWorkerShift(startSlot, durationMinutes, ss, se, workerTravelBuffer); })
                        .ToList();
                    if (eligible.Count == 0)
                        continue;

                    var busyIds = eligible
                        .Where(w => HasWorkerTimeConflict(
                            bookingsByWorker.TryGetValue(w.Id, out var wb2) ? wb2 : new List<Booking>(),
                            startSlot, durationMinutes, workerTravelBuffer))
                        .Select(w => w.Id)
                        .ToHashSet();

                    var overlaps = unassignedBookings.Count(b => HasBookingTimeOverlap(new[] { b }, startSlot, durationMinutes));
                    var freePool = eligible.Count(w => !busyIds.Contains(w.Id));
                    if (freePool <= overlaps)
                        continue;
                }

                count++;
            }

            return count;
        }

        private async Task<bool> IsAutoAssignEnabledAsync()
        {
            var setting = await _context.SystemSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == AutoAssignSettingKey);

            if (setting == null || string.IsNullOrWhiteSpace(setting.Value))
            {
                return _configuration.GetValue("Bookings:AutoAssignEnabled", true);
            }

            return bool.TryParse(setting.Value, out var parsed)
                ? parsed
                : _configuration.GetValue("Bookings:AutoAssignEnabled", true);
        }

        /// <summary>
        /// Checks whether a named feature flag is enabled.
        /// Looks up "features.{flagName}" in SystemSettings first;
        /// falls back to appsettings.json Features:{FlagName} (default false = safe off).
        /// </summary>
        private async Task<bool> IsFeatureFlagEnabledAsync(string flagName)
        {
            var key = $"features.{flagName}";
            var setting = await _context.SystemSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == key);

            if (setting != null && !string.IsNullOrWhiteSpace(setting.Value))
            {
                return bool.TryParse(setting.Value, out var parsed) && parsed;
            }

            // Fall back to appsettings; default false keeps feature off until explicitly enabled
            return _configuration.GetValue($"Features:{flagName}", false);
        }

        /// <summary>
        /// Returns the minimum advance-notice minutes required for same-day bookings.
        /// Reads from SystemSettings key "booking.defaultBufferMinutes" (set by SettingsController seed).
        /// Falls back to 90 minutes if the key is absent.
        /// </summary>
        /// <summary>
        /// Returns the inter-job travel/prep buffer for workers.
        /// Reads from SystemSettings key "booking.workerTravelBufferMinutes" (set by SettingsController seed).
        /// Falls back to 30 minutes if the key is absent.
        /// </summary>
        private async Task<int> GetWorkerTravelBufferMinutesAsync()
        {
            var setting = await _context.SystemSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "booking.workerTravelBufferMinutes");

            if (setting != null && int.TryParse(setting.Value, out var parsed) && parsed >= 0)
                return parsed;

            return DefaultWorkerTravelBufferMinutes;
        }

        private async Task SetAutoAssignEnabledAsync(bool enabled)
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == AutoAssignSettingKey);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    Key = AutoAssignSettingKey,
                    Value = enabled.ToString(),
                    UpdatedAt = DateTime.UtcNow,
                };
                _context.SystemSettings.Add(setting);
            }
            else
            {
                setting.Value = enabled.ToString();
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        private static Dictionary<int, decimal> BuildProductUsageMap(Booking booking)
        {
            var usageByProduct = new Dictionary<int, decimal>();

            foreach (var bookingItem in booking.BookingItems)
            {
                var itemQuantity = Math.Max(1, bookingItem.Quantity);
                var packageServices = bookingItem.Package?.PackageServices ?? new List<PackageService>();

                foreach (var packageService in packageServices)
                {
                    var serviceProducts = packageService.Service?.ServiceProducts ?? new List<ServiceProduct>();
                    foreach (var serviceProduct in serviceProducts)
                    {
                        if (serviceProduct.ProductId <= 0 || serviceProduct.QuantityUsed <= 0)
                        {
                            continue;
                        }

                        var requiredQty = serviceProduct.QuantityUsed * itemQuantity;
                        usageByProduct.TryGetValue(serviceProduct.ProductId, out var currentQty);
                        usageByProduct[serviceProduct.ProductId] = currentQty + requiredQty;
                    }
                }
            }

            return usageByProduct;
        }

        private static int ToStockUnits(decimal quantity)
        {
            if (quantity <= 0)
            {
                return 0;
            }

            return (int)Math.Ceiling(quantity);
        }

        private static List<BookingChecklistItem> BuildChecklistItems(IEnumerable<BookingPackageDto> selectedPackages, IReadOnlyDictionary<int, Package> packages)
        {
            var checklistItems = new List<BookingChecklistItem>();
            var displayOrder = 1;

            foreach (var selectedPackage in selectedPackages)
            {
                if (!packages.TryGetValue(selectedPackage.PackageId, out var package))
                {
                    continue;
                }

                var serviceNames = package.PackageServices
                    .Select(ps => ps.Service.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(name => name)
                    .ToList();

                if (serviceNames.Count == 0)
                {
                    checklistItems.Add(new BookingChecklistItem
                    {
                        Label = selectedPackage.Quantity > 1
                            ? $"{package.Name} x{selectedPackage.Quantity}: Complete package"
                            : $"{package.Name}: Complete package",
                        DisplayOrder = displayOrder++
                    });
                    continue;
                }

                foreach (var serviceName in serviceNames)
                {
                    checklistItems.Add(new BookingChecklistItem
                    {
                        Label = $"{package.Name}: {serviceName}",
                        DisplayOrder = displayOrder++
                    });
                }
            }

            return checklistItems;
        }

        private static List<BookingChecklistItemDto> MapChecklistItems(IEnumerable<BookingChecklistItem> checklistItems)
        {
            return checklistItems
                .OrderBy(ci => ci.DisplayOrder)
                .Select(ci => new BookingChecklistItemDto
                {
                    Id = ci.Id,
                    Label = ci.Label,
                    DisplayOrder = ci.DisplayOrder,
                    IsCompleted = ci.IsCompleted,
                    CompletedAt = ci.CompletedAt
                })
                .ToList();
        }

        private static BookingDto MapBookingToDto(
            Booking b,
            int estimatedDurationMinutes,
            Dictionary<int, LocalizedText>? packageTextMap = null)
        {
            return new BookingDto
            {
                Id = b.Id,
                BookingNumber = b.BookingNumber,
                ScheduledDate = b.ScheduledDate,
                TimeSlot = b.TimeSlot,
                EstimatedDurationMinutes = estimatedDurationMinutes,
                Status = b.Status.ToString(),
                PaymentStatus = b.PaymentStatus.ToString(),
                TotalAmount = b.TotalAmount,
                DiscountAmount = b.DiscountAmount,
                AppliedOfferCode = b.AppliedOfferCode,
                EstimatedCost = b.EstimatedCost,
                EstimatedProfit = b.EstimatedProfit,
                CustomerName = b.CustomerName,
                CustomerEmail = b.CustomerEmail,
                CustomerPhone = b.CustomerPhone,
                CustomerAddress = b.CustomerAddress,
                AddressType = b.AddressType,
                VehicleMake = b.VehicleMake,
                VehicleModel = b.VehicleModel,
                VehicleYear = b.VehicleYear,
                VehicleType = b.VehicleType.ToString(),
                AssignedWorkerId = b.AssignedWorkerId,
                AssignedWorkerName = b.AssignedWorker == null
                    ? null
                    : $"{b.AssignedWorker.FirstName} {b.AssignedWorker.LastName}".Trim(),
                SpecialInstructions = b.SpecialInstructions,
                WorkerArrivedAt = b.WorkerArrivedAt,
                WorkerRunningLateAt = b.WorkerRunningLateAt,
                WorkStartedAt = b.WorkStartedAt,
                WorkCompletedAt = b.WorkCompletedAt,
                WorkDurationSeconds = b.WorkDurationSeconds,
                CreatedAt = b.CreatedAt,
                CancellationRequested = b.CancellationRequested,
                CancellationRequestReason = b.CancellationRequestReason,
                CancellationRequestedAt = b.CancellationRequestedAt,
                RescheduleRequested = b.RescheduleRequested,
                RescheduleRequestNote = b.RescheduleRequestNote,
                ReschedulePreferredDate = b.ReschedulePreferredDate,
                RescheduleRequestedAt = b.RescheduleRequestedAt,
                ChecklistItems = MapChecklistItems(b.ChecklistItems),
                Items = b.BookingItems.Select(bi => new BookingItemDetailDto
                {
                    PackageId = bi.PackageId,
                    PackageName = packageTextMap != null && packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                        ? (packageText.Name ?? bi.Package?.Name ?? string.Empty)
                        : (bi.Package?.Name ?? string.Empty),
                    PackageTier = bi.Package?.Tier ?? string.Empty,
                    Price = bi.Price,
                    Quantity = bi.Quantity,
                    Subtotal = bi.Price * bi.Quantity,
                    ItemCost = bi.ItemCost,
                    ItemProfit = (bi.Price * bi.Quantity) - bi.ItemCost,
                }).ToList(),
            };
        }

        private async Task<(AppliedOfferResult? Result, string? Error)> ResolveOfferAsync(string? offerCode, int? userId, decimal subtotal)
        {
            if (string.IsNullOrWhiteSpace(offerCode))
            {
                return (null, null);
            }

            var normalizedCode = offerCode.Trim().ToUpperInvariant();
            var now = DateTime.UtcNow;

            UserOffer? matchedUserOffer = null;
            if (userId.HasValue)
            {
                matchedUserOffer = await _context.UserOffers
                    .Include(uo => uo.Offer)
                    .Include(uo => uo.User)
                    .FirstOrDefaultAsync(uo =>
                        uo.PersonalCode == normalizedCode &&
                        uo.UserId == userId.Value &&
                        !uo.IsRedeemed);
            }

            Offer? offer = matchedUserOffer?.Offer;
            if (offer == null)
            {
                offer = await _context.Offers
                    .FirstOrDefaultAsync(o =>
                        o.Code == normalizedCode &&
                        !o.IsLoyaltyProgram &&
                        o.IsActive);
            }

            // Unified "not valid" response for all lookup/status failures ï¿½ prevents code enumeration.
            if (offer == null
                || !offer.IsActive
                || (offer.StartsAt.HasValue && offer.StartsAt.Value > now)
                || (offer.EndsAt.HasValue && offer.EndsAt.Value < now)
                || (matchedUserOffer != null && matchedUserOffer.ExpiresAt.HasValue && matchedUserOffer.ExpiresAt.Value < now))
            {
                return (null, "Offer code is not valid.");
            }

            if (offer.MinBookingAmount > subtotal)
            {
                return (null, $"Offer requires a minimum booking amount of {offer.MinBookingAmount:F2} QAR.");
            }

            if (matchedUserOffer != null
                && matchedUserOffer.Offer.IsLoyaltyProgram
                && (!matchedUserOffer.User.LoyaltyGoogleReviewActivatedAt.HasValue
                    || matchedUserOffer.AssignedAt < matchedUserOffer.User.LoyaltyGoogleReviewActivatedAt.Value))
            {
                return (null, "Complete the one-time Google review unlock before using loyalty rewards.");
            }

            if (offer.MaxUsesPerUser.HasValue && userId.HasValue)
            {
                var usageCount = await _context.Bookings
                    .CountAsync(b =>
                        b.UserId == userId.Value &&
                        b.AppliedOfferCode == normalizedCode &&
                        b.Status != BookingStatus.Cancelled);

                if (usageCount >= offer.MaxUsesPerUser.Value)
                {
                    return (null, "Offer usage limit reached for this user.");
                }
            }

            return (new AppliedOfferResult
            {
                Offer = offer,
                UserOffer = matchedUserOffer,
                AppliedCode = normalizedCode
            }, null);
        }

        private async Task IssueLoyaltyCouponsAsync(int userId)
        {
            // Gate: customer must have their Google review approved first.
            var activationAt = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.LoyaltyGoogleReviewActivatedAt)
                .FirstOrDefaultAsync();

            if (!activationAt.HasValue)
            {
                return;
            }

            // Only count PAID bookings completed AFTER the review was approved.
            // Free bookings (loyalty reward redemptions, TotalAmount == 0) are excluded
            // so using a reward doesn't accidentally count toward the next cycle.
            var completedCount = await _context.Bookings
                .CountAsync(b =>
                    b.UserId == userId
                    && b.Status == BookingStatus.Completed
                    && b.TotalAmount > 0
                    && b.WorkCompletedAt.HasValue
                    && b.WorkCompletedAt.Value >= activationAt.Value);

            if (completedCount <= 0)
            {
                return;
            }

            var loyaltyOffers = await _context.Offers
                .Where(o =>
                    o.IsActive &&
                    o.IsLoyaltyProgram &&
                    o.TriggerCompletedBookings.HasValue &&
                    o.TriggerCompletedBookings.Value > 0)
                .ToListAsync();

            if (loyaltyOffers.Count == 0)
            {
                return;
            }

            var earnedCoupons = new List<(Offer Offer, string Code)>();

            foreach (var offer in loyaltyOffers)
            {
                var trigger = offer.TriggerCompletedBookings!.Value;
                if (completedCount % trigger != 0)
                {
                    continue;
                }

                var existsForMilestone = await _context.UserOffers.AnyAsync(uo =>
                    uo.UserId == userId &&
                    uo.OfferId == offer.Id &&
                    uo.EarnedAtCompletedBookingsCount == completedCount);

                if (existsForMilestone)
                {
                    continue;
                }

                var codePrefix = string.IsNullOrWhiteSpace(offer.Code) ? "LOYAL" : offer.Code.Trim().ToUpperInvariant();
                var personalCode = $"{codePrefix}-U{userId}-{completedCount}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

                _context.UserOffers.Add(new UserOffer
                {
                    UserId = userId,
                    OfferId = offer.Id,
                    PersonalCode = personalCode,
                    EarnedAtCompletedBookingsCount = completedCount,
                    AssignedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)),
                    IsRedeemed = false
                });

                earnedCoupons.Add((offer, personalCode));
            }

            if (earnedCoupons.Count == 0) return;

            await _context.SaveChangesAsync();

            foreach (var earnedCoupon in earnedCoupons)
            {
                await _adminNotificationService.NotifyLoyaltyCouponEarnedAsync(userId, earnedCoupon.Offer, earnedCoupon.Code);
            }
        }

        [HttpGet("constraints")]
        public async Task<ActionResult<BookingConstraintsDto>> GetBookingConstraints()
        {
            var minimumJobDurationMinutes = await GetMinimumJobDurationMinutesAsync();
            var workerTravelBufferMinutes = await GetWorkerTravelBufferMinutesAsync();

            TryGetBusinessDayBounds(out var dayStartMinutes, out var dayEndMinutes);
            var startTs = TimeSpan.FromMinutes(dayStartMinutes);
            var endTs   = TimeSpan.FromMinutes(dayEndMinutes);
            var hoursStart = $"{(int)startTs.TotalHours:00}:{startTs.Minutes:00}";
            var hoursEnd   = $"{(int)endTs.TotalHours:00}:{endTs.Minutes:00}";

            return Ok(new BookingConstraintsDto
            {
                MinimumJobDurationMinutes = minimumJobDurationMinutes,
                SlotStepMinutes = SlotSelectionStepMinutes,
                WorkerTravelBufferMinutes = workerTravelBufferMinutes,
                BusinessHoursStart = hoursStart,
                BusinessHoursEnd   = hoursEnd,
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/schedule")]
        public async Task<ActionResult<IEnumerable<WorkerScheduleDayDto>>> GetWorkersSchedule([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            try
            {
                var startDate = from.HasValue
                    ? NormalizeUtcDate(from.Value)
                    : NormalizeUtcDate(DateTime.UtcNow.AddDays(1));
                var endDate = to.HasValue
                    ? NormalizeUtcDate(to.Value)
                    : startDate.AddDays(31);
                var endExclusive = endDate.AddDays(1);

                if (endDate < startDate)
                {
                    return BadRequest(new { message = "The end date must be on or after the start date." });
                }

                if ((endDate - startDate).TotalDays > 120)
                {
                    return BadRequest(new { message = "Date range is too large. Please request up to 120 days." });
                }

                var minimumJobDurationMinutes = await GetMinimumJobDurationMinutesAsync();
                var workers = await _context.Staff
                    .AsNoTracking()
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.FirstName)
                    .ThenBy(s => s.LastName)
                    .ToListAsync();

                var workerIds = workers.Select(w => w.Id).ToList();
                var rangeBookings = await _context.Bookings
                    .AsNoTracking()
                    .Where(b =>
                        b.AssignedWorkerId.HasValue
                        && workerIds.Contains(b.AssignedWorkerId.Value)
                        && b.ScheduledDate >= startDate
                        && b.ScheduledDate < endExclusive
                        && b.Status != BookingStatus.Cancelled)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var bookingsByDateAndWorker = rangeBookings
                    .Where(b => b.AssignedWorkerId.HasValue)
                    .GroupBy(b => new { Date = b.ScheduledDate.Date, WorkerId = b.AssignedWorkerId!.Value })
                    .ToDictionary(g => (g.Key.Date, g.Key.WorkerId), g => g.ToList());

                var result = new List<WorkerScheduleDayDto>();

                for (var date = startDate; date <= endDate; date = date.AddDays(1))
                {
                    var dailyWorkers = new List<WorkerDailyLoadDto>();
                    var totalStartsCapacity = 0;
                    var availableStarts = 0;
                    var activeWorkersForDay = 0;

                    foreach (var worker in workers)
                    {
                        var worksOnDay = WorkerWorksOnDay(worker.WorkingDays, date.DayOfWeek);
                        var workerBookings = bookingsByDateAndWorker.TryGetValue((date.Date, worker.Id), out var existing)
                            ? existing
                            : new List<Booking>();

                        var (shiftStart, shiftEnd) = GetWorkerShiftForDay(worker, date.DayOfWeek);

                        var totalShiftMinutes = 0;
                        var usableFreeMinutes = 0;
                        var availableStartCount = 0;

                        if (worksOnDay && TryParseShiftWindowMinutes(shiftStart, shiftEnd, out var shiftStartMinutes, out var shiftEndMinutes))
                        {
                            activeWorkersForDay++;
                            totalShiftMinutes = shiftEndMinutes - shiftStartMinutes;
                            // Theoretical capacity uses the buffered window (buffer before first job is unavailable).
                            var bufferedShiftMinutes = Math.Max(0, totalShiftMinutes - DefaultWorkerTravelBufferMinutes);
                            totalStartsCapacity += ComputeStartCapacity(bufferedShiftMinutes, minimumJobDurationMinutes);

                            CalculateWorkerFreeCapacity(
                                workerBookings,
                                shiftStartMinutes,
                                shiftEndMinutes,
                                minimumJobDurationMinutes,
                                out usableFreeMinutes,
                                out availableStartCount);

                            availableStarts += availableStartCount;
                        }

                        var utilizationPercent = totalShiftMinutes > 0
                            ? Math.Round(((decimal)(totalShiftMinutes - usableFreeMinutes) / totalShiftMinutes) * 100m, 2)
                            : 0m;

                        dailyWorkers.Add(new WorkerDailyLoadDto
                        {
                            WorkerId = worker.Id,
                            FirstName = worker.FirstName,
                            LastName = worker.LastName,
                            ShiftStart = shiftStart,
                            ShiftEnd = shiftEnd,
                            WorksOnDay = worksOnDay,
                            BookingsCount = workerBookings.Count,
                            TotalShiftMinutes = totalShiftMinutes,
                            UsableFreeMinutes = usableFreeMinutes,
                            AvailableStartCount = availableStartCount,
                            UtilizationPercent = utilizationPercent,
                        });
                    }

                    var utilization = totalStartsCapacity > 0
                        ? Math.Round(((decimal)(totalStartsCapacity - availableStarts) / totalStartsCapacity) * 100m, 2)
                        : 100m;

                    var status = availableStarts == 0
                        ? DayAvailabilityStatus.Full
                        : utilization >= 70m
                            ? DayAvailabilityStatus.Medium
                            : DayAvailabilityStatus.Available;

                    result.Add(new WorkerScheduleDayDto
                    {
                        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
                        Status = status,
                        MinimumJobDurationMinutes = minimumJobDurationMinutes,
                        TotalWorkers = workers.Count,
                        ActiveWorkersForDay = activeWorkersForDay,
                        TotalStartsCapacity = totalStartsCapacity,
                        AvailableStarts = availableStarts,
                        UtilizationPercent = utilization,
                        Workers = dailyWorkers,
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting workers schedule: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve workers schedule" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("workers/day-timeline")]
        public async Task<ActionResult<IEnumerable<WorkerDayTimelineDto>>> GetWorkersDayTimeline([FromQuery] string date)
        {
            if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

            try
            {
                var targetDate = parsedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
                var dayEnd = targetDate.AddDays(1);
                var dayOfWeek = targetDate.DayOfWeek;

                var workers = await _context.Staff
                    .AsNoTracking()
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.FirstName).ThenBy(s => s.LastName)
                    .ToListAsync();

                var workerIds = workers.Select(w => w.Id).ToList();
                var dayBookings = await _context.Bookings
                    .AsNoTracking()
                    .Where(b =>
                        b.AssignedWorkerId.HasValue
                        && workerIds.Contains(b.AssignedWorkerId.Value)
                        && b.ScheduledDate >= targetDate
                        && b.ScheduledDate < dayEnd
                        && b.Status != BookingStatus.Cancelled)
                    .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var bookingsByWorker = dayBookings
                    .Where(b => b.AssignedWorkerId.HasValue)
                    .GroupBy(b => b.AssignedWorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var result = workers.Select(worker =>
                {
                    var worksOnDay = WorkerWorksOnDay(worker.WorkingDays, dayOfWeek);
                    var (shiftStart, shiftEnd) = GetWorkerShiftForDay(worker, dayOfWeek);
                    var wb = bookingsByWorker.TryGetValue(worker.Id, out var assigned) ? assigned : new List<Booking>();

                    var slots = wb.Select(b =>
                    {
                        var duration = ResolveBookingDurationMinutes(b);
                        TryParseSlotStart(b.TimeSlot, out var slotStartTs);
                        var packagesSummary = string.Join(", ", b.BookingItems
                            .Where(bi => bi.Package != null)
                            .Select(bi => bi.Quantity > 1 ? $"{bi.Package!.Name} Ã—{bi.Quantity}" : bi.Package!.Name));
                        return new DayBookingSlotDto
                        {
                            BookingId = b.Id,
                            BookingNumber = b.BookingNumber,
                            StartTime = $"{(int)slotStartTs.TotalHours:00}:{slotStartTs.Minutes:00}",
                            EstimatedDurationMinutes = duration,
                            Status = b.Status.ToString(),
                            CustomerName = b.CustomerName,
                            VehicleType = b.VehicleType.ToString(),
                            PackagesSummary = packagesSummary
                        };
                    }).OrderBy(s => s.StartTime).ToList();

                    return new WorkerDayTimelineDto
                    {
                        WorkerId = worker.Id,
                        FirstName = worker.FirstName,
                        LastName = worker.LastName,
                        ShiftStart = shiftStart,
                        ShiftEnd = shiftEnd,
                        WorksOnDay = worksOnDay,
                        Bookings = slots
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting day timeline: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve day timeline" });
            }
        }

        [HttpGet("availability-calendar")]
        public async Task<ActionResult<IEnumerable<DayAvailabilityDto>>> GetAvailabilityCalendar(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int? durationMinutes)
        {
            // If a specific duration is given, return duration-aware accurate slot counts
            if (durationMinutes.HasValue && durationMinutes.Value > 0)
            {
                var start = from.HasValue ? from.Value.Date : DateTime.UtcNow.Date;
                var end = to.HasValue ? to.Value.Date : start.AddDays(30);
                var result = new List<DayAvailabilityDto>();

                var workerTravelBuffer = await GetWorkerTravelBufferMinutesAsync();

                for (var d = start; d <= end; d = d.AddDays(1))
                {
                    var targetUtc = DateTime.SpecifyKind(d, DateTimeKind.Utc);
                    var validCount = await CountValidSlotsForDayAsync(targetUtc, durationMinutes.Value, workerTravelBuffer);

                    var status = validCount == 0 ? DayAvailabilityStatus.Full
                        : validCount <= 2 ? DayAvailabilityStatus.Medium
                        : DayAvailabilityStatus.Available;

                    result.Add(new DayAvailabilityDto
                    {
                        Date = d,
                        Status = status,
                        FreeSlots = validCount,
                        TotalSlots = validCount, // accurate count shown as available
                        Capacity = validCount,
                        Reserved = 0,
                        UtilizationPercent = validCount == 0 ? 100 : 0,
                    });
                }

                return Ok(result);
            }

            // Fallback: original worker-schedule-based calendar (no duration filter)
            var scheduleResult = await GetWorkersSchedule(from, to);
            if (scheduleResult.Result is ObjectResult objectResult)
            {
                if ((objectResult.StatusCode ?? 200) >= 400)
                    return StatusCode(objectResult.StatusCode ?? 500, objectResult.Value);

                if (objectResult.Value is IEnumerable<WorkerScheduleDayDto> objectValueSchedule)
                {
                    var dayDtos2 = objectValueSchedule.Select(day => new DayAvailabilityDto
                    {
                        Date = day.Date,
                        Status = day.Status,
                        TotalSlots = day.TotalStartsCapacity,
                        FreeSlots = day.AvailableStarts,
                        Capacity = day.TotalStartsCapacity,
                        Reserved = Math.Max(0, day.TotalStartsCapacity - day.AvailableStarts),
                        UtilizationPercent = day.UtilizationPercent,
                    }).ToList();
                    return Ok(dayDtos2);
                }
            }

            var scheduleDays = scheduleResult.Value?.ToList() ?? new List<WorkerScheduleDayDto>();
            var dayDtos = scheduleDays.Select(day => new DayAvailabilityDto
            {
                Date = day.Date,
                Status = day.Status,
                TotalSlots = day.TotalStartsCapacity,
                FreeSlots = day.AvailableStarts,
                Capacity = day.TotalStartsCapacity,
                Reserved = Math.Max(0, day.TotalStartsCapacity - day.AvailableStarts),
                UtilizationPercent = day.UtilizationPercent,
            }).ToList();

            return Ok(dayDtos);
        }

        [HttpGet("available-slots")]
        public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots([FromQuery] string date, [FromQuery] int? durationMinutes, [FromQuery] VehicleType? vehicleType, [FromQuery] int? preferredWorkerId)
        {
            // All times are evaluated in BusinessTimeZone (Arab Standard Time = Qatar UTC+3 by default; overridable via appsettings BusinessSettings:TimeZone)

            // 1. Parse date; fall back slotDuration to 60 if not provided.
            if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

            var slotDuration = (durationMinutes.HasValue && durationMinutes.Value > 0) ? durationMinutes.Value : 60;

            // Check if the business has marked this date as a closed/off day.
            if (BookingSlotHelper.IsDateClosed(parsedDate))
                return Ok(new List<string>());

            // 2. Read workerTravelBuffer from SystemSettings (also acts as same-day lead time for first job).
            var workerTravelBuffer = await GetWorkerTravelBufferMinutesAsync();

            try
            {
                // 3. Convert parsedDate to business-local date. Get dayName.
                var targetDate        = DateTime.SpecifyKind(parsedDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
                var nowLocal          = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone);
                var targetLocalDate   = TimeZoneInfo.ConvertTimeFromUtc(targetDate, BusinessTimeZone).Date;
                var dayOfWeek         = targetLocalDate.DayOfWeek;
                var dayName           = dayOfWeek.ToString();

                // 4. Check if business is open that day (end <= start â†’ closed).
                var (dayBoundsStart, dayBoundsEnd) = GetDayBounds(dayName);
                if (!TimeSpan.TryParse(dayBoundsStart, out var boundsStartTs) ||
                    !TimeSpan.TryParse(dayBoundsEnd,   out var boundsEndTs)   ||
                    boundsEndTs <= boundsStartTs)
                {
                    return Ok(new List<string>());
                }

                // 5. Load active workers working on that day.
                var workers = await _context.Staff
                    .AsNoTracking()
                    .Where(s => s.IsActive)
                    .ToListAsync();

                var availableWorkers = workers
                    .Where(w => WorkerWorksOnDay(w.WorkingDays, dayOfWeek))
                    .ToList();

                // If a specific preferred worker was requested, restrict to that worker only.
                if (preferredWorkerId.HasValue)
                    availableWorkers = availableWorkers.Where(w => w.Id == preferredWorkerId.Value).ToList();

                // 6. If none â†’ return empty.
                if (availableWorkers.Count == 0)
                    return Ok(new List<string>());

                // 7. Load that day's bookings (assigned + unassigned, non-cancelled/completed).
                var workerIds   = availableWorkers.Select(w => w.Id).ToList();
                var slotsDayEnd = targetDate.AddDays(1);

                var sameDayWorkerBookings = await _context.Bookings
                    .Where(b =>
                        b.AssignedWorkerId.HasValue
                        && workerIds.Contains(b.AssignedWorkerId.Value)
                        && b.ScheduledDate >= targetDate && b.ScheduledDate < slotsDayEnd
                        && b.Status != BookingStatus.Cancelled
                        && b.Status != BookingStatus.Completed)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var sameDayUnassignedBookings = await _context.Bookings
                    .Where(b =>
                        !b.AssignedWorkerId.HasValue
                        && b.ScheduledDate >= targetDate && b.ScheduledDate < slotsDayEnd
                        && b.Status != BookingStatus.Cancelled
                        && b.Status != BookingStatus.Completed)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var autoAssignEnabled = await IsAutoAssignEnabledAsync();

                var bookingsByWorker = sameDayWorkerBookings
                    .Where(b => b.AssignedWorkerId.HasValue)
                    .GroupBy(b => b.AssignedWorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // 8. Build candidate start slots.
                var candidateStartSlots = BuildCandidateStartSlots(slotDuration, dayName);

                // 11. Determine whether the requested date is today (business-local).
                var isSameDay = targetLocalDate == nowLocal.Date;

                // WorkerCanTakeSlot: returns true if the given worker is free to take the slot.
                bool WorkerCanTakeSlot(Staff worker, string startSlot)
                {
                    if (!TryParseSlotStart(startSlot, out var slotStartTime))
                        return false;

                    var (ss, se) = GetWorkerShiftForDay(worker, dayOfWeek);

                    // Slot must fit within worker shift (buffer applied to shift start).
                    if (!TimeSlotInWorkerShift(startSlot, slotDuration, ss, se, workerTravelBuffer))
                        return false;

                    var workerBookings = bookingsByWorker.TryGetValue(worker.Id, out var assigned)
                        ? assigned
                        : new List<Booking>();

                    if (HasWorkerTimeConflict(workerBookings, startSlot, slotDuration, workerTravelBuffer))
                        return false;

                    return true;
                }

                var validStartSlots = new List<string>();

                foreach (var startSlot in candidateStartSlots)
                {
                    if (!TryParseSlotStart(startSlot, out var slotStartTime))
                        continue;

                    // 12a. Same-day: first bookable slot must be >= now + travel buffer.
                    if (isSameDay && slotStartTime < nowLocal.TimeOfDay + TimeSpan.FromMinutes(workerTravelBuffer))
                        continue;

                    // 12b. Count workers that are actually free for this slot (assigned-booking conflicts only).
                    var freeWorkerCount = availableWorkers.Count(w => WorkerCanTakeSlot(w, startSlot));
                    if (freeWorkerCount == 0)
                        continue;

                    // 12c. Each unassigned booking will consume one free worker when auto-assigned.
                    //      Subtract their demand from the free-worker pool.
                    var unassignedConflicts = sameDayUnassignedBookings.Count(b =>
                        HasWorkerTimeConflict(new List<Booking> { b }, startSlot, slotDuration, workerTravelBuffer));

                    if (freeWorkerCount <= unassignedConflicts)
                        continue;

                    // 12e. Manual-assign mode: require at least one free worker after unassigned demand.
                    if (!autoAssignEnabled)
                    {
                        var eligibleWorkersForSlot = availableWorkers
                            .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, dayOfWeek); return TimeSlotInWorkerShift(startSlot, slotDuration, ss, se, workerTravelBuffer); })
                            .ToList();

                        if (eligibleWorkersForSlot.Count == 0)
                            continue;

                        var busyWorkerIds = eligibleWorkersForSlot
                            .Where(w => HasWorkerTimeConflict(
                                bookingsByWorker.TryGetValue(w.Id, out var wb) ? wb : new List<Booking>(),
                                startSlot, slotDuration, workerTravelBuffer))
                            .Select(w => w.Id)
                            .ToHashSet();

                        var freePool = eligibleWorkersForSlot.Count(w => !busyWorkerIds.Contains(w.Id));
                        if (freePool <= unassignedConflicts)
                            continue;
                    }

                    // 13. Slot passed all checks â€” add it.
                    validStartSlots.Add(startSlot);
                }

                return Ok(validStartSlots);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting available slots: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve available slots" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("assignment-mode")]
        public async Task<ActionResult<AssignmentModeDto>> GetAssignmentMode()
        {
            var enabled = await IsAutoAssignEnabledAsync();
            return Ok(new AssignmentModeDto
            {
                AutoAssignEnabled = enabled,
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("assignment-mode")]
        public async Task<ActionResult<AssignmentModeDto>> UpdateAssignmentMode([FromBody] UpdateAssignmentModeDto dto)
        {
            await SetAutoAssignEnabledAsync(dto.AutoAssignEnabled);

            return Ok(new AssignmentModeDto
            {
                AutoAssignEnabled = dto.AutoAssignEnabled,
            });
        }

        // â”€â”€ POST /api/Bookings/quote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Returns a server-authoritative price breakdown for the current selection
        // (packages + vehicle type + subscription + offer code) WITHOUT creating a booking.
        // Mobile calls this whenever pricing inputs change so the displayed total is always
        // accurate and matches what the backend will charge at booking creation time.
        [HttpPost("quote")]
        public async Task<ActionResult<BookingQuoteDto>> GetBookingQuote([FromBody] BookingQuoteRequestDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                // Load requested packages
                var packageIds = dto.Packages.Select(p => p.PackageId).Distinct().ToList();
                var packages = await _context.Packages
                    .AsNoTracking()
                    .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                    .ToDictionaryAsync(p => p.Id);

                if (packages.Count != packageIds.Count)
                    return BadRequest(new { message = "One or more packages not found." });

                // Resolve subscription discount
                var bookingUserId = GetUserId();
                var (subscription, subError) = await ResolveApplicableSubscriptionAsync(
                    bookingUserId, dto.CustomerSubscriptionId, dto.VehicleType);

                if (subError != null)
                    return BadRequest(new { message = subError });

                var subscriptionDiscount = subscription?.Plan?.DiscountPercent ?? 0m;

                // Check for referral discount for referred user (first booking discount)
                decimal referralDiscount = 0m;
                if (bookingUserId.HasValue)
                {
                    var (referralDiscountPercent, _) = await _referralService.GetReferralDiscountForUserAsync(bookingUserId.Value);
                    if (referralDiscountPercent.HasValue && referralDiscountPercent.Value > 0)
                    {
                        referralDiscount = referralDiscountPercent.Value;
                    }
                }

                // Combine subscription and referral discounts
                var combinedDiscountPercent = subscriptionDiscount + referralDiscount;

                // Build item list for pricing service
                var items = dto.Packages
                    .Select(p => new PackagePricingItem(p.PackageId, packages[p.PackageId].Price, p.Quantity))
                    .ToList();

                // Estimate subtotal (pre-offer) for offer minimum-amount validation
                var prelimSubtotal = items.Sum(i => Math.Round(i.BasePrice, 2) * i.Quantity);

                // Resolve offer (if any)
                var (offerResult, offerError) = await ResolveOfferAsync(dto.OfferCode, bookingUserId, prelimSubtotal);
                if (offerError != null)
                    return BadRequest(new { message = offerError });

                // â”€â”€ Single pricing authority â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                var pricing = await _pricingService.CalculateAsync(
                    items,
                    dto.VehicleType,
                    combinedDiscountPercent,
                    offerResult?.Offer,
                    offerResult?.AppliedCode);

                return Ok(new BookingQuoteDto
                {
                    BaseAmount                 = pricing.BaseAmount,
                    VehicleMultiplier          = pricing.VehicleMultiplier,
                    SubscriptionDiscountPercent = pricing.SubscriptionDiscountPercent,
                    SubscriptionDiscountAmount  = pricing.SubscriptionDiscountAmount,
                    OfferDiscountAmount        = pricing.OfferDiscountAmount,
                    TotalDiscountAmount        = pricing.TotalDiscountAmount,
                    FinalPrice                 = pricing.FinalAmount,
                    AppliedOfferCode           = pricing.AppliedOfferCode,
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error calculating booking quote: {ex.Message}");
                return StatusCode(500, new { message = "Failed to calculate booking quote." });
            }
        }

        [HttpPost("create-payment-intent")]
        public Task<ActionResult<PaymentIntentResponseDto>> CreatePaymentIntent([FromBody] CreateBookingDto dto)
        {
            // Stripe payment flow has been replaced by Tap Payments.
            // Use POST /api/Payments/create-charge instead.
            return Task.FromResult<ActionResult<PaymentIntentResponseDto>>(
                StatusCode(410, new { message = "Stripe payment flow is no longer supported. Use POST /api/Payments/create-charge for Tap Payments." }));
        }

        [HttpPost]
        public async Task<ActionResult<BookingDto>> CreateBooking([FromBody] CreateBookingDto dto)
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);

                // â”€â”€ Idempotency check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // If the client sent a key and a booking already exists with that key, return
                // the original booking instead of creating a duplicate. This handles the case
                // where the network fails mid-request and the app retries.
                var normalizedIdempotencyKey = string.IsNullOrWhiteSpace(dto.IdempotencyKey)
                    ? null
                    : dto.IdempotencyKey.Trim();

                if (normalizedIdempotencyKey != null)
                {
                    var existingByKey = await _context.Bookings
                        .AsNoTracking()
                        .Where(b => b.IdempotencyKey == normalizedIdempotencyKey
                                    && b.CustomerEmail.ToLower() == dto.CustomerEmail.Trim().ToLowerInvariant())
                        .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                        .Include(b => b.ChecklistItems)
                        .Include(b => b.AssignedWorker)
                        .FirstOrDefaultAsync();

                    if (existingByKey != null)
                    {
                        // Idempotent replay â€” return the original booking
                        var existingDuration = ResolveBookingDurationMinutes(existingByKey);
                        return Ok(MapBookingToDto(existingByKey, existingDuration, packageTextMap));
                    }
                }
                // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

                var bookingUser = await ResolveBookingUserByEmailAsync(dto.CustomerEmail);
                var userId = bookingUser?.Id;

                // Ensure ScheduledDate has UTC kind
                var scheduledDate = dto.ScheduledDate.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(dto.ScheduledDate, DateTimeKind.Utc)
                    : dto.ScheduledDate;
                var scheduledBookingDate = NormalizeUtcDate(scheduledDate);

                // Validate packages
                var packageIds = dto.Packages.Select(p => p.PackageId).ToList();
                var packages = await _context.Packages
                    .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .ToDictionaryAsync(p => p.Id);

                if (packages.Count != packageIds.Count)
                {
                    return BadRequest(new { message = "One or more packages not found" });
                }

                // Duration comes from package definition only â€” Quantity scales price/cost, not time.
                var totalDurationMinutes = dto.Packages
                    .Sum(item => packages[item.PackageId].EstimatedDurationMinutes);

                var bookingDayName = TimeZoneInfo.ConvertTimeFromUtc(scheduledBookingDate, BusinessTimeZone).DayOfWeek.ToString();
                var requiredTimeSlots = BuildRequiredTimeSlots(dto.TimeSlot, totalDurationMinutes, out var availabilityError, bookingDayName);
                if (requiredTimeSlots == null)
                {
                    return BadRequest(new { message = availabilityError });
                }

                if (IsSlotInPastForBusinessDay(scheduledBookingDate, dto.TimeSlot))
                {
                    return BadRequest(new { message = "Selected time slot is in the past. Please choose a future time." });
                }


                // â”€â”€ Slot reservation conflict check (Phase 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                var slotReservationEnabled = await IsFeatureFlagEnabledAsync("slotReservation");
                if (slotReservationEnabled)
                {
                    var normalizedIntentId = dto.StripePaymentIntentId?.Trim();
                    var hasConflictingReservation = await _context.SlotReservations
                        .AnyAsync(r => r.ScheduledDate == scheduledBookingDate
                                    && r.TimeSlot      == dto.TimeSlot
                                    && r.ExpiresAt     > DateTime.UtcNow
                                    && (normalizedIntentId == null || r.PaymentIntentId != normalizedIntentId));
                    if (hasConflictingReservation)
                    {
                        return Conflict(new
                        {
                            message = "This slot is temporarily held by another customer completing payment. Please try again in a few minutes or choose a different time."
                        });
                    }
                }
                // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

                var autoAssignEnabled = await IsAutoAssignEnabledAsync();
                var workerTravelBufferCB = await GetWorkerTravelBufferMinutesAsync();
                Staff? autoAssignedWorker = null;
                if (autoAssignEnabled)
                {
                    autoAssignedWorker = await FindAutoAssignableWorkerAsync(scheduledDate, dto.TimeSlot, totalDurationMinutes, workerTravelBufferCB);
                    if (autoAssignedWorker == null)
                    {
                        return BadRequest(new { message = "No detailer is available for the selected time and duration. Please choose a different slot." });
                    }
                }
                else
                {
                    var hasManualCapacity = await HasManualPoolCapacityAsync(scheduledDate, dto.TimeSlot, totalDurationMinutes, workerTravelBufferCB);
                    if (!hasManualCapacity)
                    {
                        return BadRequest(new { message = "Manual queue is at capacity for this time. Please choose a different slot." });
                    }
                }

                // Ensure slot rows exist before the transaction (new rows start at
                // CurrentBookings = 0, so pre-creation is race-safe).
                var existingSlotKeys = await _context.Availabilities
                    .AsNoTracking()
                    .Where(a => a.Date == scheduledBookingDate && requiredTimeSlots.Contains(a.TimeSlot))
                    .Select(a => a.TimeSlot)
                    .ToListAsync();

                var missingSlots = requiredTimeSlots.Where(slot => !existingSlotKeys.Contains(slot)).ToList();
                if (missingSlots.Count > 0)
                {
                    _context.Availabilities.AddRange(missingSlots.Select(slot => new Availability
                    {
                        Date = scheduledBookingDate,
                        TimeSlot = slot,
                        MaxBookings = DefaultMaxBookingsPerSlot,
                        CurrentBookings = 0,
                        IsAvailable = true
                    }));
                    await _context.SaveChangesAsync();
                }
                // â”€â”€ Pricing via PricingService (single source of truth) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Backend ALWAYS recalculates price â€” never trusts any client value.
                var checklistItems = BuildChecklistItems(dto.Packages, packages);

                decimal totalCost = 0;
                var bookingItemsRaw = new List<(int PackageId, decimal BasePrice, int Quantity, decimal ItemCost)>();

                foreach (var item in dto.Packages)
                {
                    var package = packages[item.PackageId];
                    var packageCost = package.PackageServices
                        .Sum(ps => ps.Service.ServiceProducts
                            .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));
                    var itemCost = packageCost * item.Quantity;
                    totalCost += itemCost;
                    bookingItemsRaw.Add((package.Id, package.Price, item.Quantity, itemCost));
                }

                var applicableSubscription = await ResolveApplicableSubscriptionAsync(userId, dto.CustomerSubscriptionId, dto.VehicleType);
                if (applicableSubscription.Error != null)
                {
                    return BadRequest(new { message = applicableSubscription.Error });
                }

                var subscriptionDiscount = applicableSubscription.Subscription?.Plan?.DiscountPercent ?? 0m;

                // Check for referral discount for referred user (first booking discount)
                decimal referralDiscount = 0m;
                if (userId.HasValue)
                {
                    var (referralDiscountPercent, _) = await _referralService.GetReferralDiscountForUserAsync(userId.Value);
                    if (referralDiscountPercent.HasValue && referralDiscountPercent.Value > 0)
                    {
                        referralDiscount = referralDiscountPercent.Value;
                    }
                }

                // Combine subscription and referral discounts (both are percentage-based)
                var combinedDiscountPercent = subscriptionDiscount + referralDiscount;

                var pricingItems = bookingItemsRaw
                    .Select(r => new PackagePricingItem(r.PackageId, r.BasePrice, r.Quantity))
                    .ToList();

                // Rough subtotal for offer minimum-amount validation
                var prelimSubtotal = pricingItems.Sum(i => Math.Round(i.BasePrice, 2) * i.Quantity);

                if (!string.IsNullOrWhiteSpace(dto.OfferCode) && userId.HasValue && _couponLimiter.IsBlocked(userId.Value))
                    return BadRequest(new { message = "Too many invalid offer code attempts. Please wait before trying again." });

                var offerResolution = await ResolveOfferAsync(dto.OfferCode, userId, prelimSubtotal);
                if (offerResolution.Error != null)
                {
                    if (!string.IsNullOrWhiteSpace(dto.OfferCode) && userId.HasValue)
                        _couponLimiter.RecordFailure(userId.Value);
                    await _audit.LogAsync("CouponRejected", userId, dto.CustomerEmail?.Trim(), "Offer",
                        dto.OfferCode?.Trim(), new { offerCode = dto.OfferCode, reason = offerResolution.Error }, success: false);
                    return BadRequest(new { message = offerResolution.Error });
                }

                if (offerResolution.Result != null && userId.HasValue)
                    _couponLimiter.RecordSuccess(userId.Value);

                var pricing = await _pricingService.CalculateAsync(
                    pricingItems,
                    dto.VehicleType,
                    combinedDiscountPercent,
                    offerResolution.Result?.Offer,
                    offerResolution.Result?.AppliedCode);

                var finalAmount    = pricing.FinalAmount;
                var discountAmount = pricing.TotalDiscountAmount;

                // â”€â”€ Apply Referral Points only if customer chooses to use them â”€â”€
                decimal referralPointsUsed = 0;
                if (dto.UseReferralPoints && userId.HasValue && finalAmount > 0)
                {
                    var user = await _context.Users.FindAsync(userId.Value);
                    if (user != null && user.ReferralPoints > 0)
                    {
                        // Use up to the final amount or all points, whichever is less
                        referralPointsUsed = Math.Min(finalAmount, user.ReferralPoints);
                        if (referralPointsUsed > 0)
                        {
                            finalAmount = finalAmount - referralPointsUsed;
                            discountAmount = discountAmount + referralPointsUsed;
                        }
                    }
                }

                // Payment intent ID (Tap charge ID) is stored for reference only.
                // Amount verification is handled by Tap Payments on their hosted page.
                // The Tap charge ID is stored in StripePaymentIntentId field (reused).

                // Build BookingItems with the PricingService-derived per-item price
                var vehicleMultiplierUsed = pricing.VehicleMultiplier;
                var bookingItems = bookingItemsRaw.Select(r => new BookingItem
                {
                    PackageId               = r.PackageId,
                    Price                   = Math.Round(r.BasePrice * vehicleMultiplierUsed, 2),
                    Quantity                = r.Quantity,
                    ItemCost                = r.ItemCost,
                    SnapshotDurationMinutes = packages[r.PackageId].EstimatedDurationMinutes,
                }).ToList();

                var addressType     = NormalizeAddressType(dto.AddressType);
                var customerAddress = string.IsNullOrWhiteSpace(dto.CustomerAddress) ? null : dto.CustomerAddress.Trim();

                if (bookingUser != null)
                {
                    var preferredAddressType = NormalizeAddressType(bookingUser.PreferredAddressType);
                    var preferredAddress = GetAddressByType(bookingUser, preferredAddressType);

                    if (!string.IsNullOrWhiteSpace(preferredAddress))
                    {
                        addressType     = preferredAddressType;
                        customerAddress = preferredAddress.Trim();
                    }
                }

                if (string.IsNullOrWhiteSpace(customerAddress))
                {
                    return BadRequest(new { message = "Please provide a service address before booking." });
                }

                // Create booking
                var booking = new Booking
                {
                    BookingNumber = $"BOOK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}",
                    UserId = userId,
                    StripePaymentIntentId = dto.StripePaymentIntentId,
                    IdempotencyKey = normalizedIdempotencyKey,
                    ScheduledDate = scheduledBookingDate,
                    TimeSlot = dto.TimeSlot,
                    Status = BookingStatus.Pending,
                    PaymentStatus = finalAmount == 0 ? PaymentStatus.Paid : PaymentStatus.PreAuthorized,
                    TotalAmount = finalAmount,
                    DiscountAmount = discountAmount,
                    AppliedOfferCode = offerResolution.Result?.AppliedCode,
                    EstimatedCost = totalCost,
                    EstimatedProfit = finalAmount - totalCost,
                    CustomerName = dto.CustomerName,
                    CustomerEmail = dto.CustomerEmail,
                    CustomerPhone = dto.CustomerPhone,
                    CustomerAddress = customerAddress,
                    AddressType = addressType,
                    VehicleMake = dto.VehicleMake,
                    VehicleModel = dto.VehicleModel,
                    VehicleYear = dto.VehicleYear,
                    VehicleType = dto.VehicleType,
                    AssignedWorkerId = autoAssignedWorker?.Id,
                    PreferredWorkerId = dto.PreferredWorkerId,
                    SpecialInstructions = dto.SpecialInstructions,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    BookingItems = bookingItems,
                    ChecklistItems = checklistItems
                };

                if (booking.AssignedWorkerId.HasValue)
                {
                    booking.Status = BookingStatus.Confirmed;
                }

                await using (var bookingTransaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable))
                {
                    if (booking.AssignedWorkerId.HasValue)
                    {
                        var latestWorkerBookings = await _context.Bookings
                            .Where(b =>
                                b.AssignedWorkerId == booking.AssignedWorkerId.Value
                                && b.ScheduledDate.Date == scheduledBookingDate.Date
                                && b.Status != BookingStatus.Cancelled
                                && b.Status != BookingStatus.Completed)
                            .Include(b => b.BookingItems)
                                .ThenInclude(bi => bi.Package)
                            .ToListAsync();

                        if (HasWorkerTimeConflict(latestWorkerBookings, booking.TimeSlot, totalDurationMinutes))
                        {
                            return BadRequest(new { message = "No detailer is available for the selected time and duration. Please choose a different slot." });
                        }
                    }

                    _context.Bookings.Add(booking);

                    // Re-read availabilities inside the serializable transaction so the read
                    // is part of the conflict-detection set ï¿½ prevents overbooking under
                    // concurrent load (Serializable isolation will abort one of two racing txns).
                    var availabilities = await _context.Availabilities
                        .Where(a => a.Date == scheduledBookingDate && requiredTimeSlots.Contains(a.TimeSlot))
                        .ToListAsync();

                    var fullSlot = availabilities.FirstOrDefault(a => a.CurrentBookings >= a.MaxBookings);
                    if (fullSlot != null)
                    {
                        return Conflict(new { message = "This time slot just became fully booked. Please choose a different slot." });
                    }

                    // Reserve all required slots for the full service duration.
                    foreach (var slotAvailability in availabilities)
                    {
                        slotAvailability.CurrentBookings++;
                        if (slotAvailability.CurrentBookings >= slotAvailability.MaxBookings)
                        {
                            slotAvailability.IsAvailable = false;
                        }
                    }

                    if (offerResolution.Result?.UserOffer != null)
                    {
                        offerResolution.Result.UserOffer.IsRedeemed = true;
                        offerResolution.Result.UserOffer.RedeemedAt = DateTime.UtcNow;
                    }

                    await _context.SaveChangesAsync();
                    await bookingTransaction.CommitAsync();

                    // Deduct used referral points
                    if (userId.HasValue && referralPointsUsed > 0)
                    {
                        var userForDeduction = await _context.Users.FindAsync(userId.Value);
                        if (userForDeduction != null && userForDeduction.ReferralPoints >= referralPointsUsed)
                        {
                            userForDeduction.ReferralPoints -= referralPointsUsed;
                            await _context.SaveChangesAsync();
                        }
                    }
                }

                await _adminNotificationService.NotifyNewBookingAsync(booking);

                // Audit: booking created
                await _audit.LogAsync(
                    action:     finalAmount == 0 ? "FreeBookingCreated" : "BookingCreated",
                    userId:     userId,
                    userEmail:  booking.CustomerEmail,
                    entityType: "Booking",
                    entityId:   booking.BookingNumber,
                    metadata: new
                    {
                        bookingNumber = booking.BookingNumber,
                        totalAmount   = finalAmount,
                        couponCode    = booking.AppliedOfferCode,
                        isFree        = finalAmount == 0,
                    });

                // Return booking details
                var bookingDto = new BookingDto
                {
                    Id = booking.Id,
                    BookingNumber = booking.BookingNumber,
                    ScheduledDate = booking.ScheduledDate,
                    TimeSlot = booking.TimeSlot,
                    EstimatedDurationMinutes = totalDurationMinutes,
                    Status = booking.Status.ToString(),
                    PaymentStatus = booking.PaymentStatus.ToString(),
                    TotalAmount = booking.TotalAmount,
                    DiscountAmount = booking.DiscountAmount,
                    AppliedOfferCode = booking.AppliedOfferCode,
                    EstimatedCost = booking.EstimatedCost,
                    EstimatedProfit = booking.EstimatedProfit,
                    CustomerName = booking.CustomerName,
                    CustomerEmail = booking.CustomerEmail,
                    CustomerPhone = booking.CustomerPhone,
                    CustomerAddress = booking.CustomerAddress,
                    AddressType = booking.AddressType,
                    VehicleMake = booking.VehicleMake,
                    VehicleModel = booking.VehicleModel,
                    VehicleYear = booking.VehicleYear,
                    VehicleType = booking.VehicleType.ToString(),
                    AssignedWorkerId = booking.AssignedWorkerId,
                    AssignedWorkerName = autoAssignedWorker == null ? null : $"{autoAssignedWorker.FirstName} {autoAssignedWorker.LastName}".Trim(),
                    SpecialInstructions = booking.SpecialInstructions,
                    WorkerArrivedAt = booking.WorkerArrivedAt,
                    WorkerRunningLateAt = booking.WorkerRunningLateAt,
                    WorkerOnMyWayAt = booking.WorkerOnMyWayAt,
                    WorkStartedAt = booking.WorkStartedAt,
                    WorkCompletedAt = booking.WorkCompletedAt,
                    WorkDurationSeconds = booking.WorkDurationSeconds,
                    CreatedAt = booking.CreatedAt,
                    CancellationRequested = booking.CancellationRequested,
                    CancellationRequestReason = booking.CancellationRequestReason,
                    CancellationRequestedAt = booking.CancellationRequestedAt,
                    RescheduleRequested = booking.RescheduleRequested,
                    RescheduleRequestNote = booking.RescheduleRequestNote,
                    ReschedulePreferredDate = booking.ReschedulePreferredDate,
                    RescheduleRequestedAt = booking.RescheduleRequestedAt,
                    ChecklistItems = MapChecklistItems(checklistItems),
                    Items = bookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? packages[bi.PackageId].Name)
                            : packages[bi.PackageId].Name,
                        PackageTier = packages[bi.PackageId].Tier,
                        Price = bi.Price,
                        Quantity = bi.Quantity,
                        Subtotal = bi.Price * bi.Quantity,
                        ItemCost = bi.ItemCost,
                        ItemProfit = (bi.Price * bi.Quantity) - bi.ItemCost
                    }).ToList()
                };

                return Ok(bookingDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating booking: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to create booking: {ex.Message}" });
            }
        }

        [Authorize]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetMyBookings()
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);

                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized();
                }

                var currentUser = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId.Value);

                if (currentUser == null)
                {
                    return Unauthorized();
                }

                var normalizedEmail = currentUser.Email.Trim().ToLowerInvariant();

                var bookings = await _context.Bookings
                    .Where(b => b.UserId == userId.Value || b.CustomerEmail.ToLower() == normalizedEmail)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .Include(b => b.ChecklistItems)
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();

                var bookingDtos = bookings.Select(b => new BookingDto
                {
                    Id = b.Id,
                    BookingNumber = b.BookingNumber,
                    ScheduledDate = b.ScheduledDate,
                    TimeSlot = b.TimeSlot,
                    EstimatedDurationMinutes = b.BookingItems.Sum(bi => bi.Package.EstimatedDurationMinutes * bi.Quantity),
                    Status = b.Status.ToString(),
                    PaymentStatus = b.PaymentStatus.ToString(),
                    TotalAmount = b.TotalAmount,
                    DiscountAmount = b.DiscountAmount,
                    AppliedOfferCode = b.AppliedOfferCode,
                    EstimatedCost = b.EstimatedCost,
                    EstimatedProfit = b.EstimatedProfit,
                    CustomerName = b.CustomerName,
                    CustomerEmail = b.CustomerEmail,
                    CustomerPhone = b.CustomerPhone,
                    CustomerAddress = b.CustomerAddress,
                    AddressType = b.AddressType,
                    VehicleMake = b.VehicleMake,
                    VehicleModel = b.VehicleModel,
                    VehicleYear = b.VehicleYear,
                    VehicleType = b.VehicleType.ToString(),
                    WorkerArrivedAt = b.WorkerArrivedAt,
                    WorkerRunningLateAt = b.WorkerRunningLateAt,
                    WorkerOnMyWayAt = b.WorkerOnMyWayAt,
                    WorkStartedAt = b.WorkStartedAt,
                    WorkCompletedAt = b.WorkCompletedAt,
                    WorkDurationSeconds = b.WorkDurationSeconds,
                    CreatedAt = b.CreatedAt,
                    CancellationRequested = b.CancellationRequested,
                    CancellationRequestReason = b.CancellationRequestReason,
                    CancellationRequestedAt = b.CancellationRequestedAt,
                    RescheduleRequested = b.RescheduleRequested,
                    RescheduleRequestNote = b.RescheduleRequestNote,
                    ReschedulePreferredDate = b.ReschedulePreferredDate,
                    RescheduleRequestedAt = b.RescheduleRequestedAt,
                    ChecklistItems = MapChecklistItems(b.ChecklistItems),
                    Items = b.BookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? bi.Package.Name)
                            : bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        Price = bi.Price,
                        Quantity = bi.Quantity,
                        Subtotal = bi.Price * bi.Quantity,
                        ItemCost = bi.ItemCost,
                        ItemProfit = (bi.Price * bi.Quantity) - bi.ItemCost
                    }).ToList()
                }).ToList();

                return Ok(bookingDtos);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting bookings: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve bookings" });
            }
        }

        [Authorize]
        [HttpGet("{bookingNumber}")]
        public async Task<ActionResult<BookingDto>> GetBooking(string bookingNumber)
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);

                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .Include(b => b.ChecklistItems)
                    .FirstOrDefaultAsync(b => b.BookingNumber == bookingNumber);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                // Customers may only read their own bookings.
                if (User.IsInRole("Customer"))
                {
                    var currentUserId = GetUserId();
                    if (!currentUserId.HasValue || booking.UserId != currentUserId.Value)
                        return Forbid();
                }

                // Get user info for referral tracking
                bool isFirstCompletedWash = false;
                bool referralCodeUnlocked = false;
                if (booking.UserId.HasValue)
                {
                    var user = await _context.Users.FindAsync(booking.UserId.Value);
                    if (user != null)
                    {
                        // Check if this is the user's first completed wash
                        isFirstCompletedWash = user.FirstWashCompletedAt.HasValue && 
                            booking.WorkCompletedAt.HasValue &&
                            user.FirstWashCompletedAt.Value.AddMinutes(-1) <= booking.WorkCompletedAt.Value &&
                            booking.WorkCompletedAt.Value <= user.FirstWashCompletedAt.Value.AddMinutes(1);
                        
                        // Referral code is unlocked if user has FirstWashCompletedAt set OR has ever completed any booking
                        referralCodeUnlocked = user.FirstWashCompletedAt.HasValue || user.TotalBookingsCount > 0;
                    }
                }

                var bookingDto = new BookingDto
                {
                    Id = booking.Id,
                    BookingNumber = booking.BookingNumber,
                    ScheduledDate = booking.ScheduledDate,
                    TimeSlot = booking.TimeSlot,
                    EstimatedDurationMinutes = booking.BookingItems.Sum(bi => bi.Package.EstimatedDurationMinutes * bi.Quantity),
                    Status = booking.Status.ToString(),
                    PaymentStatus = booking.PaymentStatus.ToString(),
                    TotalAmount = booking.TotalAmount,
                    DiscountAmount = booking.DiscountAmount,
                    AppliedOfferCode = booking.AppliedOfferCode,
                    EstimatedCost = booking.EstimatedCost,
                    EstimatedProfit = booking.EstimatedProfit,
                    CustomerName = booking.CustomerName,
                    CustomerEmail = booking.CustomerEmail,
                    CustomerPhone = booking.CustomerPhone,
                    CustomerAddress = booking.CustomerAddress,
                    AddressType = booking.AddressType,
                    VehicleMake = booking.VehicleMake,
                    VehicleModel = booking.VehicleModel,
                    VehicleYear = booking.VehicleYear,
                    VehicleType = booking.VehicleType.ToString(),
                    SpecialInstructions = booking.SpecialInstructions,
                    WorkerArrivedAt = booking.WorkerArrivedAt,
                    WorkerRunningLateAt = booking.WorkerRunningLateAt,
                    WorkStartedAt = booking.WorkStartedAt,
                    WorkCompletedAt = booking.WorkCompletedAt,
                    WorkDurationSeconds = booking.WorkDurationSeconds,
                    CreatedAt = booking.CreatedAt,
                    CancellationRequested = booking.CancellationRequested,
                    CancellationRequestReason = booking.CancellationRequestReason,
                    CancellationRequestedAt = booking.CancellationRequestedAt,
                    RescheduleRequested = booking.RescheduleRequested,
                    RescheduleRequestNote = booking.RescheduleRequestNote,
                    ReschedulePreferredDate = booking.ReschedulePreferredDate,
                    RescheduleRequestedAt = booking.RescheduleRequestedAt,
                    IsFirstCompletedWash = isFirstCompletedWash,
                    ReferralCodeUnlocked = referralCodeUnlocked,
                    ChecklistItems = MapChecklistItems(booking.ChecklistItems),
                    Items = booking.BookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? bi.Package.Name)
                            : bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        Price = bi.Price,
                        Quantity = bi.Quantity,
                        Subtotal = bi.Price * bi.Quantity,
                        ItemCost = bi.ItemCost,
                        ItemProfit = (bi.Price * bi.Quantity) - bi.ItemCost
                    }).ToList()
                };

                return Ok(bookingDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting booking: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve booking" });
            }
        }

    }
}
