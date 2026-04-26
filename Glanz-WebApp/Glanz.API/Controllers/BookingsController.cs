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
using Stripe;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BookingsController : ControllerBase
    {
        private static readonly TimeSpan WorkerArrivalNotificationCooldown = TimeSpan.FromMinutes(5);
        private const int DefaultWorkerTravelBufferMinutes = 30; // fallback only â€” runtime value read from SystemSettings
        private static TimeZoneInfo BusinessTimeZone = ResolveBusinessTimeZone(null);

        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IAdminNotificationService _adminNotificationService;
        private readonly IPricingService _pricingService;

        public BookingsController(AppDbContext context, IConfiguration configuration, IAdminNotificationService adminNotificationService, IPricingService pricingService)
        {
            _context = context;
            _configuration = configuration;
            _adminNotificationService = adminNotificationService;
            _pricingService = pricingService;
            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
            {
                return userId;
            }
            return null;
        }

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

        private static readonly JsonSerializerOptions _dayScheduleJsonOpts = new() { PropertyNameCaseInsensitive = true };

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

        private static List<string>? BuildRequiredTimeSlots(string selectedTimeSlot, int totalDurationMinutes, out string error)
        {
            error = string.Empty;

            if (totalDurationMinutes <= 0)
            {
                error = "Total duration must be greater than zero.";
                return null;
            }

            if (!TryGetBusinessDayBounds(out var dayStartMinutes, out var dayEndMinutes)
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

            var nowBusiness = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessTimeZone);
            var todayDayName = nowBusiness.DayOfWeek.ToString();
            var requiredSlots = new List<string>();
            foreach (var slot in GetDailyTimeSlots(todayDayName))
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

                for (var quantityIndex = 1; quantityIndex <= Math.Max(1, selectedPackage.Quantity); quantityIndex++)
                {
                    if (serviceNames.Count == 0)
                    {
                        checklistItems.Add(new BookingChecklistItem
                        {
                            Label = selectedPackage.Quantity > 1
                                ? $"{package.Name} #{quantityIndex}: Complete package"
                                : $"{package.Name}: Complete package",
                            DisplayOrder = displayOrder++
                        });
                        continue;
                    }

                    foreach (var serviceName in serviceNames)
                    {
                        checklistItems.Add(new BookingChecklistItem
                        {
                            Label = selectedPackage.Quantity > 1
                                ? $"{package.Name} #{quantityIndex}: {serviceName}"
                                : $"{package.Name}: {serviceName}",
                            DisplayOrder = displayOrder++
                        });
                    }
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

        private static BookingDto MapBookingToDto(Booking b, int estimatedDurationMinutes)
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
                    PackageName = bi.Package?.Name ?? string.Empty,
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

            if (offer == null)
            {
                return (null, "Offer code is invalid.");
            }

            if (!offer.IsActive)
            {
                return (null, "Offer is not active.");
            }

            if (offer.StartsAt.HasValue && offer.StartsAt.Value > now)
            {
                return (null, "Offer is not available yet.");
            }

            if (offer.EndsAt.HasValue && offer.EndsAt.Value < now)
            {
                return (null, "Offer has expired.");
            }

            if (offer.MinBookingAmount > subtotal)
            {
                return (null, $"Offer requires minimum booking amount of {offer.MinBookingAmount:F2}.");
            }

            if (matchedUserOffer != null && matchedUserOffer.ExpiresAt.HasValue && matchedUserOffer.ExpiresAt.Value < now)
            {
                return (null, "Coupon has expired.");
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
            var loyaltyActivationAt = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.LoyaltyGoogleReviewActivatedAt)
                .FirstOrDefaultAsync();

            if (!loyaltyActivationAt.HasValue)
            {
                return;
            }

            var completedCount = await _context.Bookings
                .CountAsync(b =>
                    b.UserId == userId
                    && b.Status == BookingStatus.Completed
                    && ((b.WorkCompletedAt ?? b.UpdatedAt) >= loyaltyActivationAt.Value));

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
        public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots([FromQuery] string date, [FromQuery] int? durationMinutes, [FromQuery] VehicleType? vehicleType)
        {
            // All times are evaluated in BusinessTimeZone (Arab Standard Time = Qatar UTC+3 by default; overridable via appsettings BusinessSettings:TimeZone)

            // 1. Parse date; fall back slotDuration to 60 if not provided.
            if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var parsedDate))
                return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

            var slotDuration = (durationMinutes.HasValue && durationMinutes.Value > 0) ? durationMinutes.Value : 60;

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

                    // 12b. At least one worker must be able to cover this slot.
                    var hasWorkerCoverage = availableWorkers.Any(w => WorkerCanTakeSlot(w, startSlot));
                    if (!hasWorkerCoverage)
                        continue;

                    // 12e. Manual-assign mode: require at least one free worker in the pool.
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
                        if (freePool == 0)
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
                    subscriptionDiscount,
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
        public async Task<ActionResult<PaymentIntentResponseDto>> CreatePaymentIntent([FromBody] CreateBookingDto dto)
        {
            try
            {
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

                var requiredTimeSlots = BuildRequiredTimeSlots(dto.TimeSlot, totalDurationMinutes, out var availabilityError);
                if (requiredTimeSlots == null)
                {
                    return BadRequest(new { message = availabilityError });
                }

                if (IsSlotInPastForBusinessDay(scheduledBookingDate, dto.TimeSlot))
                {
                    return BadRequest(new { message = "Selected time slot is in the past. Please choose a future time." });
                }


                var autoAssignEnabled = await IsAutoAssignEnabledAsync();
                var workerTravelBufferPI = await GetWorkerTravelBufferMinutesAsync();
                Staff? autoAssignableWorker = null;
                if (autoAssignEnabled)
                {
                    autoAssignableWorker = await FindAutoAssignableWorkerAsync(scheduledDate, dto.TimeSlot, totalDurationMinutes, workerTravelBufferPI);
                    if (autoAssignableWorker == null)
                    {
                        return BadRequest(new { message = "No detailer is available for the selected time and duration. Please choose a different slot." });
                    }
                }
                else
                {
                    var hasManualCapacity = await HasManualPoolCapacityAsync(scheduledDate, dto.TimeSlot, totalDurationMinutes, workerTravelBufferPI);
                    if (!hasManualCapacity)
                    {
                        return BadRequest(new { message = "Manual queue is at capacity for this time. Please choose a different slot." });
                    }
                }

                var availabilities = await _context.Availabilities
                    .Where(a => a.Date == scheduledBookingDate && requiredTimeSlots.Contains(a.TimeSlot))
                    .ToListAsync();

                var existingSlots = availabilities.Select(a => a.TimeSlot).ToHashSet();
                var missingSlots = requiredTimeSlots.Where(slot => !existingSlots.Contains(slot)).ToList();

                if (missingSlots.Count > 0)
                {
                    foreach (var slot in missingSlots)
                    {
                        availabilities.Add(new Availability
                        {
                            Date = scheduledBookingDate,
                            TimeSlot = slot,
                            MaxBookings = DefaultMaxBookingsPerSlot,
                            CurrentBookings = 0,
                            IsAvailable = true
                        });
                    }

                    _context.Availabilities.AddRange(availabilities.Where(a => missingSlots.Contains(a.TimeSlot)));
                    await _context.SaveChangesAsync();
                }

                // â”€â”€ Pricing via PricingService (single source of truth) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Cost calculation (for margin tracking) still happens locally
                decimal totalCost = 0;
                foreach (var item in dto.Packages)
                {
                    var package = packages[item.PackageId];
                    var packageCost = package.PackageServices
                        .Sum(ps => ps.Service.ServiceProducts
                            .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));
                    totalCost += packageCost * item.Quantity;
                }

                var applicableSubscription = await ResolveApplicableSubscriptionAsync(userId, dto.CustomerSubscriptionId, dto.VehicleType);
                if (applicableSubscription.Error != null)
                {
                    return BadRequest(new { message = applicableSubscription.Error });
                }

                var subscriptionDiscount = applicableSubscription.Subscription?.Plan?.DiscountPercent ?? 0m;

                var pricingItems = dto.Packages
                    .Select(p => new PackagePricingItem(p.PackageId, packages[p.PackageId].Price, p.Quantity))
                    .ToList();

                // Rough subtotal used only for offer minimum-amount check
                var prelimSubtotalIntent = pricingItems.Sum(i => Math.Round(i.BasePrice, 2) * i.Quantity);
                var offerResolution = await ResolveOfferAsync(dto.OfferCode, userId, prelimSubtotalIntent);
                if (offerResolution.Error != null)
                {
                    return BadRequest(new { message = offerResolution.Error });
                }

                var pricing = await _pricingService.CalculateAsync(
                    pricingItems,
                    dto.VehicleType,
                    subscriptionDiscount,
                    offerResolution.Result?.Offer,
                    offerResolution.Result?.AppliedCode);

                var finalAmount   = pricing.FinalAmount;
                var discountAmount = pricing.TotalDiscountAmount;

                // Create Stripe Payment Intent
                var paymentIntentService = new PaymentIntentService();
                var paymentIntentOptions = new PaymentIntentCreateOptions
                {
                    Amount = (long)(finalAmount * 100), // Stripe uses cents
                    Currency = "qar",
                    CaptureMethod = "manual", // Pre-authorization
                    Metadata = new Dictionary<string, string>
                    {
                        { "customer_email", dto.CustomerEmail },
                        { "customer_name", dto.CustomerName },
                        { "scheduled_date", scheduledDate.ToString("yyyy-MM-dd") },
                        { "time_slot", dto.TimeSlot },
                        { "auto_assign_enabled", autoAssignEnabled.ToString() },
                        { "offer_code", pricing.AppliedOfferCode ?? string.Empty },
                        { "discount_amount", discountAmount.ToString("F2") }
                    }
                };

                var paymentIntent = await paymentIntentService.CreateAsync(paymentIntentOptions);

                return Ok(new PaymentIntentResponseDto
                {
                    ClientSecret = paymentIntent.ClientSecret,
                    PaymentIntentId = paymentIntent.Id,
                    Amount = finalAmount,
                    DiscountAmount = discountAmount,
                    AppliedOfferCode = pricing.AppliedOfferCode,
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating payment intent: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create payment intent" });
            }
        }

        [HttpPost]
        public async Task<ActionResult<BookingDto>> CreateBooking([FromBody] CreateBookingDto dto)
        {
            try
            {
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
                        return Ok(MapBookingToDto(existingByKey, existingDuration));
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

                var requiredTimeSlots = BuildRequiredTimeSlots(dto.TimeSlot, totalDurationMinutes, out var availabilityError);
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

                var availabilities = await _context.Availabilities
                    .Where(a => a.Date == scheduledBookingDate && requiredTimeSlots.Contains(a.TimeSlot))
                    .ToListAsync();

                var existingSlots = availabilities.Select(a => a.TimeSlot).ToHashSet();
                var missingSlots = requiredTimeSlots.Where(slot => !existingSlots.Contains(slot)).ToList();

                if (missingSlots.Count > 0)
                {
                    foreach (var slot in missingSlots)
                    {
                        availabilities.Add(new Availability
                        {
                            Date = scheduledBookingDate,
                            TimeSlot = slot,
                            MaxBookings = DefaultMaxBookingsPerSlot,
                            CurrentBookings = 0,
                            IsAvailable = true
                        });
                    }

                    _context.Availabilities.AddRange(availabilities.Where(a => missingSlots.Contains(a.TimeSlot)));
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

                var pricingItems = bookingItemsRaw
                    .Select(r => new PackagePricingItem(r.PackageId, r.BasePrice, r.Quantity))
                    .ToList();

                // Rough subtotal for offer minimum-amount validation
                var prelimSubtotal = pricingItems.Sum(i => Math.Round(i.BasePrice, 2) * i.Quantity);
                var offerResolution = await ResolveOfferAsync(dto.OfferCode, userId, prelimSubtotal);
                if (offerResolution.Error != null)
                {
                    return BadRequest(new { message = offerResolution.Error });
                }

                var pricing = await _pricingService.CalculateAsync(
                    pricingItems,
                    dto.VehicleType,
                    subscriptionDiscount,
                    offerResolution.Result?.Offer,
                    offerResolution.Result?.AppliedCode);

                var finalAmount    = pricing.FinalAmount;
                var discountAmount = pricing.TotalDiscountAmount;

                // â”€â”€ Stripe amount safety gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // If a PaymentIntent was created (payments feature ON), verify its amount
                // matches the server-calculated final price. Rejects manipulated amounts.
                if (!string.IsNullOrWhiteSpace(dto.StripePaymentIntentId))
                {
                    var paymentsEnabled = await IsFeatureFlagEnabledAsync("payments");
                    if (paymentsEnabled)
                    {
                        try
                        {
                            var piService = new PaymentIntentService();
                            var pi = await piService.GetAsync(dto.StripePaymentIntentId.Trim());

                            if (pi.Status == "canceled")
                                return BadRequest(new { message = "Payment authorization has expired. Please restart the booking process." });

                            // Stripe stores amount in smallest currency unit (fils/cents).
                            var piAmountDecimal = pi.Amount / 100m;
                            var tolerance       = Math.Max(finalAmount * 0.01m, 0.01m); // 1% or 1 fils

                            if (Math.Abs(piAmountDecimal - finalAmount) > tolerance)
                            {
                                return BadRequest(new
                                {
                                    message = "Payment amount does not match the booking total. Please restart the booking process.",
                                    serverAmount = finalAmount,
                                });
                            }
                        }
                        catch (StripeException stripeEx)
                        {
                            Console.WriteLine($"Stripe validation error: {stripeEx.Message}");
                            return BadRequest(new { message = "Could not verify payment. Please try again." });
                        }
                    }
                }

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
                    PaymentStatus = PaymentStatus.PreAuthorized,
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
                }

                await _adminNotificationService.NotifyNewBookingAsync(booking);

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
                        PackageName = packages[bi.PackageId].Name,
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
                Console.WriteLine($"Error creating booking: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create booking" });
            }
        }

        [Authorize]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetMyBookings()
        {
            try
            {
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
                        PackageName = bi.Package.Name,
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

        [HttpGet("{bookingNumber}")]
        public async Task<ActionResult<BookingDto>> GetBooking(string bookingNumber)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .Include(b => b.ChecklistItems)
                    .FirstOrDefaultAsync(b => b.BookingNumber == bookingNumber);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
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
                    ChecklistItems = MapChecklistItems(booking.ChecklistItems),
                    Items = booking.BookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = bi.Package.Name,
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

        [Authorize(Roles = "Employee")]
        [HttpGet("Employee")]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetWorkerBookings()
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var bookings = await _context.Bookings
                    .Where(b =>
                        b.AssignedWorkerId == workerId.Value
                        || (
                            b.AssignedWorkerId == null
                            && b.Status != BookingStatus.Cancelled
                            && b.Status != BookingStatus.Completed
                        ))
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .OrderBy(b => b.ScheduledDate)
                    .ThenBy(b => b.TimeSlot)
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
                    AssignedWorkerId = b.AssignedWorkerId,
                    AssignedWorkerName = b.AssignedWorker == null ? null : $"{b.AssignedWorker.FirstName} {b.AssignedWorker.LastName}".Trim(),
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
                        PackageName = bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => ps.Service.Name)
                            .Distinct()
                            .OrderBy(name => name)
                            .ToList(),
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
                Console.WriteLine($"Error getting worker bookings: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve worker bookings" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/claim")]
        public async Task<ActionResult> ClaimBooking(int id)
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var worker = await _context.Staff
                    .FirstOrDefaultAsync(s => s.Id == workerId.Value && s.IsActive);

                if (worker == null)
                {
                    return Forbid();
                }

                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                {
                    return BadRequest(new { message = "This booking can no longer be claimed." });
                }

                if (booking.AssignedWorkerId.HasValue && booking.AssignedWorkerId.Value != workerId.Value)
                {
                    return Conflict(new { message = "This booking was already claimed by another worker." });
                }

                if (!booking.AssignedWorkerId.HasValue)
                {
                    var requestedDurationMinutes = booking.BookingItems.Sum(bi => bi.Package.EstimatedDurationMinutes * bi.Quantity);
                    var requestedSlots = BuildRequiredTimeSlots(booking.TimeSlot, requestedDurationMinutes, out _)
                        ?? new List<string> { booking.TimeSlot };

                    // Fall back to standard schedule when legacy workers have empty values.
                    var effectiveWorkingDays = string.IsNullOrWhiteSpace(worker.WorkingDays)
                        ? "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday"
                        : worker.WorkingDays;
                    var (effectiveShiftStart, effectiveShiftEnd) = GetWorkerShiftForDay(worker, booking.ScheduledDate.ToLocalTime().DayOfWeek);

                    // Check worker schedule: working days
                    var bookingDayName = booking.ScheduledDate.ToLocalTime().DayOfWeek.ToString();
                    var workerDays = effectiveWorkingDays
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(d => d.Trim())
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    if (!workerDays.Contains(bookingDayName))
                    {
                        return Conflict(new
                        {
                            message = $"This booking is on a {bookingDayName}, which is outside your working days ({effectiveWorkingDays}). You cannot claim it."
                        });
                    }

                    // Check worker schedule: shift hours
                    if (TimeSpan.TryParse(effectiveShiftStart, out var shiftStart) &&
                        TimeSpan.TryParse(effectiveShiftEnd, out var shiftEnd) &&
                        TryParseTimeSlot(requestedSlots.First(), out var firstSlotStart, out _) &&
                        TryParseTimeSlot(requestedSlots.Last(), out _, out var lastSlotEnd))
                    {
                        if (firstSlotStart < shiftStart || lastSlotEnd > shiftEnd)
                        {
                            return Conflict(new
                            {
                                message = $"This booking runs from {requestedSlots.First().Split('-')[0]} to {requestedSlots.Last().Split('-')[1]}, which is outside your shift hours ({effectiveShiftStart}-{effectiveShiftEnd}). You cannot claim it."
                            });
                        }
                    }

                    var workerExistingBookings = await _context.Bookings
                        .Where(b =>
                            b.AssignedWorkerId == workerId.Value
                            && b.Id != booking.Id
                            && b.ScheduledDate.Date == booking.ScheduledDate.Date
                            && b.Status != BookingStatus.Cancelled
                            && b.Status != BookingStatus.Completed)
                        .Include(b => b.BookingItems)
                            .ThenInclude(bi => bi.Package)
                        .ToListAsync();

                    foreach (var existingBooking in workerExistingBookings)
                    {
                        if (HasWorkerTimeConflict(new[] { existingBooking }, booking.TimeSlot, requestedDurationMinutes))
                        {
                            return Conflict(new
                            {
                                message = "You already have another booking too close to this time and need travel time between jobs."
                            });
                        }
                    }

                    booking.AssignedWorkerId = workerId.Value;
                    if (booking.Status == BookingStatus.Pending)
                    {
                        booking.Status = BookingStatus.Confirmed;
                    }
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    try
                    {
                        await _adminNotificationService.NotifyBookingClaimedAsync(booking, workerId.Value);
                    }
                    catch (Exception notifyEx)
                    {
                        Console.WriteLine($"Warning: booking claim notification failed for booking {booking.Id}: {notifyEx.Message}");
                    }
                }

                return Ok(new { message = "Booking claimed successfully", bookingId = booking.Id, assignedWorkerId = booking.AssignedWorkerId });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error claiming booking: {ex.Message}");
                return StatusCode(500, new { message = "Failed to claim booking" });
            }
        }

        [Authorize(Roles = "Admin,Employee")]
        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetAllBookings()
        {
            try
            {
                IQueryable<Booking> query = _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .OrderByDescending(b => b.CreatedAt);

                if (User.IsInRole("Employee"))
                {
                    var userId = GetUserId();
                    if (!userId.HasValue)
                    {
                        return Unauthorized();
                    }

                    query = query.Where(b => b.AssignedWorkerId == userId.Value);
                }

                var bookings = await query.ToListAsync();

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
                    AssignedWorkerId = b.AssignedWorkerId,
                    AssignedWorkerName = b.AssignedWorker == null ? null : $"{b.AssignedWorker.FirstName} {b.AssignedWorker.LastName}".Trim(),
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
                        PackageName = bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => ps.Service.Name)
                            .Distinct()
                            .OrderBy(name => name)
                            .ToList(),
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
                Console.WriteLine($"Error getting all bookings: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve bookings" });
            }
        }

        [Authorize(Roles = "Admin,Employee")]
        [HttpPut("{bookingId}/checklist/{checklistItemId}")]
        public async Task<ActionResult<BookingChecklistItemDto>> UpdateChecklistItem(int bookingId, int checklistItemId, [FromBody] UpdateChecklistItemDto dto)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.ChecklistItems)
                    .FirstOrDefaultAsync(b => b.Id == bookingId);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (User.IsInRole("Employee"))
                {
                    var workerId = GetUserId();
                    if (!workerId.HasValue)
                    {
                        return Unauthorized();
                    }

                    if (booking.AssignedWorkerId != workerId.Value)
                    {
                        return Forbid();
                    }
                }

                var checklistItem = booking.ChecklistItems.FirstOrDefault(ci => ci.Id == checklistItemId);
                if (checklistItem == null)
                {
                    return NotFound(new { message = "Checklist item not found for this booking" });
                }

                checklistItem.IsCompleted = dto.IsCompleted;
                checklistItem.CompletedAt = dto.IsCompleted ? DateTime.UtcNow : null;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new BookingChecklistItemDto
                {
                    Id = checklistItem.Id,
                    Label = checklistItem.Label,
                    DisplayOrder = checklistItem.DisplayOrder,
                    IsCompleted = checklistItem.IsCompleted,
                    CompletedAt = checklistItem.CompletedAt
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating checklist item: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update checklist item" });
            }
        }

        [Authorize(Roles = "Admin,Employee")]
        [HttpPut("{id}/status")]
        public async Task<ActionResult> UpdateBookingStatus(int id, UpdateBookingStatusDto dto)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                                    .ThenInclude(s => s.ServiceProducts)
                                        .ThenInclude(sp => sp.Product)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (User.IsInRole("Employee"))
                {
                    var workerId = GetUserId();
                    if (!workerId.HasValue)
                    {
                        return Unauthorized();
                    }

                    if (booking.AssignedWorkerId != workerId.Value)
                    {
                        return Forbid();
                    }

                    var allowedWorkerStatuses = new[]
                    {
                        BookingStatus.Confirmed,
                        BookingStatus.InProgress,
                        BookingStatus.Completed,
                    };

                    if (!allowedWorkerStatuses.Contains(dto.Status))
                    {
                        return BadRequest(new { message = "Workers can only set status to Confirmed, InProgress, or Completed." });
                    }
                }

                var previousStatus = booking.Status;
                booking.Status = dto.Status;
                var statusUpdateTime = DateTime.UtcNow;

                if (dto.Status == BookingStatus.InProgress)
                {
                    booking.WorkStartedAt ??= statusUpdateTime;

                    if (previousStatus == BookingStatus.Completed)
                    {
                        booking.WorkCompletedAt = null;
                        booking.WorkDurationSeconds = null;
                    }
                }

                if (dto.Status == BookingStatus.Completed)
                {
                    booking.WorkStartedAt ??= statusUpdateTime;
                    booking.WorkCompletedAt = statusUpdateTime;

                    var durationSeconds = (int)Math.Max(0,
                        Math.Round((booking.WorkCompletedAt.Value - booking.WorkStartedAt.Value).TotalSeconds));

                    booking.WorkDurationSeconds = durationSeconds;
                }

                booking.UpdatedAt = statusUpdateTime;

                await _context.SaveChangesAsync();

                if (booking.UserId.HasValue &&
                    previousStatus != BookingStatus.Completed &&
                    booking.Status == BookingStatus.Completed)
                {
                    await IssueLoyaltyCouponsAsync(booking.UserId.Value);
                }

                await _adminNotificationService.NotifyBookingStatusChangedAsync(booking, previousStatus);

                return Ok(new { message = "Booking status updated" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating booking status: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update booking status" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("assign-worker")]
        public async Task<ActionResult> AssignWorker([FromBody] AssignWorkerDto dto)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .FirstOrDefaultAsync(b => b.Id == dto.BookingId);
                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (!dto.WorkerId.HasValue)
                {
                    booking.AssignedWorkerId = null;
                    booking.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Ok(new { message = "Worker unassigned successfully" });
                }

                var worker = await _context.Staff
                    .FirstOrDefaultAsync(s =>
                        s.Id == dto.WorkerId.Value
                        && s.IsActive);

                if (worker == null)
                {
                    return BadRequest(new { message = "Worker not found or inactive" });
                }

                var requestedDurationMinutes = ResolveBookingDurationMinutes(booking);
                var bookingDate = NormalizeUtcDate(booking.ScheduledDate);
                var workerTravelBufferAssign = await GetWorkerTravelBufferMinutesAsync();

                if (!dto.ForceAssign && !WorkerWorksOnDay(worker.WorkingDays, bookingDate.DayOfWeek))
                {
                    return Conflict(new { message = "Selected worker is not scheduled to work on this day." });
                }

                var (workerShiftS, workerShiftE) = GetWorkerShiftForDay(worker, bookingDate.DayOfWeek);
                if (!dto.ForceAssign && !TimeSlotInWorkerShift(booking.TimeSlot, requestedDurationMinutes, workerShiftS, workerShiftE, workerTravelBufferAssign))
                {
                    return Conflict(new { message = "Selected worker shift does not cover this booking time and duration." });
                }

                var bookingDayStart = bookingDate; // UTC midnight of business date
                var bookingDayEnd = bookingDate.AddDays(1);
                var workerSameDayBookings = await _context.Bookings
                    .Where(b =>
                        b.AssignedWorkerId == worker.Id
                        && b.Id != booking.Id
                        && b.ScheduledDate >= bookingDayStart
                        && b.ScheduledDate < bookingDayEnd
                        && b.Status != BookingStatus.Cancelled
                        && b.Status != BookingStatus.Completed)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                if (!dto.ForceAssign && HasWorkerTimeConflict(workerSameDayBookings, booking.TimeSlot, requestedDurationMinutes, workerTravelBufferAssign))
                {
                    return Conflict(new { message = "Selected worker has a scheduling conflict (including travel buffer) at this time." });
                }

                booking.AssignedWorkerId = worker.Id;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Worker assigned successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error assigning worker: {ex.Message}");
                return StatusCode(500, new { message = "Failed to assign worker" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{id}/available-workers")]
        public async Task<ActionResult<IEnumerable<WorkerAvailabilityDto>>> GetAvailableWorkersForBooking(
            int id,
            [FromQuery] string? date = null,
            [FromQuery] string? timeSlot = null,
            [FromQuery] int? durationMinutes = null)
        {
            try
            {
                var booking = await _context.Bookings
                    .AsNoTracking()
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                var requestedDurationMinutes = durationMinutes ?? ResolveBookingDurationMinutes(booking);
                var bookingDate = date != null
                    ? NormalizeUtcDate(DateTime.Parse(date))
                    : NormalizeUtcDate(booking.ScheduledDate);
                var effectiveTimeSlot = !string.IsNullOrEmpty(timeSlot) ? timeSlot : booking.TimeSlot;
                var workerTravelBufferAW = await GetWorkerTravelBufferMinutesAsync();

                var workers = await _context.Staff
                    .AsNoTracking()
                    .OrderBy(s => s.FirstName)
                    .ThenBy(s => s.LastName)
                    .ToListAsync();

                var workerIds = workers.Select(w => w.Id).ToList();

                var dayStart = bookingDate; // UTC midnight of business date
                var dayEnd = bookingDate.AddDays(1);
                var sameDayWorkerBookings = await _context.Bookings
                    .AsNoTracking()
                    .Where(b =>
                        b.Id != booking.Id
                        && b.AssignedWorkerId.HasValue
                        && workerIds.Contains(b.AssignedWorkerId.Value)
                        && b.ScheduledDate >= dayStart
                        && b.ScheduledDate < dayEnd
                        && b.Status != BookingStatus.Cancelled
                        && b.Status != BookingStatus.Completed)
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .ToListAsync();

                var bookingsByWorker = sameDayWorkerBookings
                    .GroupBy(b => b.AssignedWorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var result = workers.Select(w =>
                {
                    if (!w.IsActive)
                    {
                        return new WorkerAvailabilityDto
                        {
                            WorkerId = w.Id,
                            FirstName = w.FirstName,
                            LastName = w.LastName,
                            Email = w.Email,
                            IsAvailable = false,
                            Note = "Inactive worker"
                        };
                    }

                    var worksOnThisDay = WorkerWorksOnDay(w.WorkingDays, bookingDate.DayOfWeek);
                    if (!worksOnThisDay)
                    {
                        return new WorkerAvailabilityDto
                        {
                            WorkerId = w.Id,
                            FirstName = w.FirstName,
                            LastName = w.LastName,
                            Email = w.Email,
                            IsAvailable = false,
                            Note = "Not scheduled on this day"
                        };
                    }

                    var (wss, wse) = GetWorkerShiftForDay(w, bookingDate.DayOfWeek);
                    var coversBookingWindow = TimeSlotInWorkerShift(effectiveTimeSlot, requestedDurationMinutes, wss, wse, workerTravelBufferAW);
                    if (!coversBookingWindow)
                    {
                        return new WorkerAvailabilityDto
                        {
                            WorkerId = w.Id,
                            FirstName = w.FirstName,
                            LastName = w.LastName,
                            Email = w.Email,
                            IsAvailable = false,
                            Note = "Outside worker shift"
                        };
                    }

                    var workerBookings = bookingsByWorker.TryGetValue(w.Id, out var assignedBookings)
                        ? assignedBookings
                        : new List<Booking>();

                    var hasConflict = HasWorkerTimeConflict(workerBookings, effectiveTimeSlot, requestedDurationMinutes);
                    return new WorkerAvailabilityDto
                    {
                        WorkerId = w.Id,
                        FirstName = w.FirstName,
                        LastName = w.LastName,
                        Email = w.Email,
                        IsAvailable = !hasConflict,
                        Note = hasConflict ? "Conflicts with another booking/travel buffer" : "Available"
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting available workers: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve worker availability" });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/payment-status")]
        public async Task<ActionResult> UpdatePaymentStatus(int id, UpdatePaymentStatusDto dto)
        {
            try
            {
                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                booking.PaymentStatus = dto.PaymentStatus;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Payment status updated" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating payment status: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update payment status" });
            }
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<ActionResult> CancelBooking(int id)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User not authenticated or invalid token" });
                }
                
                // Try to fetch the booking
                Booking? booking;
                try
                {
                    booking = await _context.Bookings
                        .Include(b => b.BookingItems)
                            .ThenInclude(bi => bi.Package)
                        .FirstOrDefaultAsync(b => b.Id == id);
                }
                catch (Exception fetchEx)
                {
                    return StatusCode(500, new { message = $"Failed to fetch booking: {fetchEx.Message}" });
                }

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.UserId != userId && !User.IsInRole("Admin"))
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Completed)
                {
                    return BadRequest(new { message = "Cannot cancel completed booking" });
                }

                // Idempotent cancellation prevents double-decrementing capacity on retried taps.
                if (booking.Status == BookingStatus.Cancelled)
                {
                    return Ok(new { message = "Booking is already cancelled" });
                }

                booking.Status = BookingStatus.Cancelled;
                booking.UpdatedAt = DateTime.UtcNow;

                // Try to build time slots
                List<string> requiredTimeSlots;
                try
                {
                    var totalDurationMinutes = booking.BookingItems.Sum(bi => bi.Package.EstimatedDurationMinutes * bi.Quantity);
                    requiredTimeSlots = BuildRequiredTimeSlots(booking.TimeSlot, totalDurationMinutes, out _)
                        ?? new List<string> { booking.TimeSlot };
                }
                catch (Exception slotsEx)
                {
                    return StatusCode(500, new { message = $"Failed to build time slots: {slotsEx.Message}" });
                }

                // Try to fetch and update availabilities
                try
                {
                    var availabilities = await _context.Availabilities
                        .Where(a => a.Date.Date == booking.ScheduledDate.Date && requiredTimeSlots.Contains(a.TimeSlot))
                        .ToListAsync();

                    foreach (var availability in availabilities)
                    {
                        availability.CurrentBookings = Math.Max(availability.CurrentBookings - 1, 0);
                        availability.IsAvailable = availability.CurrentBookings < availability.MaxBookings;
                    }
                }
                catch (Exception availEx)
                {
                    return StatusCode(500, new { message = $"Failed to update availabilities: {availEx.Message}" });
                }

                // Try to save to database
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (Exception saveEx)
                {
                    return StatusCode(500, new { message = $"Failed to save cancellation: {saveEx.Message}" });
                }

                // Notify (non-blocking)
                try
                {
                    await _adminNotificationService.NotifyBookingCancelledAsync(booking);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: booking cancellation notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new { message = "Booking cancelled successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error cancelling booking: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to cancel booking: {ex.Message}" });
            }
        }

        // â”€â”€â”€ Admin: Cancel + Stripe void/refund â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/admin-cancel-refund")]
        public async Task<ActionResult<AdminCancelRefundResultDto>> AdminCancelAndRefund(int id, [FromBody] AdminCancelRefundDto dto)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                    return NotFound(new { message = "Booking not found" });

                if (booking.Status == BookingStatus.Completed)
                    return BadRequest(new { message = "Cannot cancel a completed booking." });

                // Idempotent â€” already cancelled
                if (booking.Status == BookingStatus.Cancelled)
                {
                    return Ok(new AdminCancelRefundResultDto
                    {
                        Message       = "Booking was already cancelled.",
                        BookingStatus = booking.Status.ToString(),
                        PaymentStatus = booking.PaymentStatus.ToString(),
                        StripeAction  = "AlreadyCancelled",
                    });
                }

                // Determine refund amount
                decimal refundAmount;
                if (dto.RefundAmountOverride.HasValue)
                {
                    refundAmount = Math.Clamp(dto.RefundAmountOverride.Value, 0m, booking.TotalAmount);
                }
                else
                {
                    var feeInfo = await CalculateCancellationFeeAsync(booking);
                    refundAmount = Math.Max(0m, booking.TotalAmount - feeInfo.CalculatedFee);
                }

                // Stripe operation
                string stripeAction   = "NoPayment";
                string? stripeRefundId = null;
                decimal refundedAmount = 0m;

                if (!string.IsNullOrEmpty(booking.StripePaymentIntentId) && booking.StripePaymentIntentId.StartsWith("pi_"))
                {
                    if (booking.PaymentStatus == PaymentStatus.PreAuthorized)
                    {
                        var piService = new PaymentIntentService();
                        await piService.CancelAsync(booking.StripePaymentIntentId);
                        stripeAction = "Voided";
                    }
                    else if (booking.PaymentStatus == PaymentStatus.Paid)
                    {
                        var refundService   = new RefundService();
                        var refundOptions   = new RefundCreateOptions
                        {
                            PaymentIntent = booking.StripePaymentIntentId,
                            Amount        = (long)(refundAmount * 100), // Stripe uses cents
                        };
                        var stripeRefund = await refundService.CreateAsync(refundOptions);
                        stripeAction   = "Refunded";
                        stripeRefundId = stripeRefund.Id;
                        refundedAmount = refundAmount;
                    }
                }

                // Cancel booking + decrement availability
                booking.Status        = BookingStatus.Cancelled;
                booking.PaymentStatus = PaymentStatus.Refunded;
                booking.UpdatedAt     = DateTime.UtcNow;

                var totalDurationMinutes = booking.BookingItems
                    .Sum(bi => bi.Package?.EstimatedDurationMinutes ?? 0);
                if (totalDurationMinutes <= 0) totalDurationMinutes = 60;

                var requiredSlots = BuildRequiredTimeSlots(booking.TimeSlot, totalDurationMinutes, out _)
                    ?? new List<string> { booking.TimeSlot };

                var availabilities = await _context.Availabilities
                    .Where(a => a.Date.Date == booking.ScheduledDate.Date && requiredSlots.Contains(a.TimeSlot))
                    .ToListAsync();
                foreach (var av in availabilities)
                {
                    av.CurrentBookings = Math.Max(av.CurrentBookings - 1, 0);
                    av.IsAvailable     = av.CurrentBookings < av.MaxBookings;
                }

                await _context.SaveChangesAsync();

                // Notify (non-blocking)
                try { await _adminNotificationService.NotifyBookingCancelledAsync(booking); }
                catch (Exception notifyEx)
                { Console.WriteLine($"Cancel notification failed: {notifyEx.Message}"); }

                string message = stripeAction switch
                {
                    "Voided"   => "Booking cancelled â€” Stripe pre-authorization voided (no charge).",
                    "Refunded" => $"Booking cancelled â€” QAR {refundedAmount:N2} refunded via Stripe.",
                    _          => "Booking cancelled. No Stripe payment was on file.",
                };

                return Ok(new AdminCancelRefundResultDto
                {
                    Message        = message,
                    BookingStatus  = booking.Status.ToString(),
                    PaymentStatus  = booking.PaymentStatus.ToString(),
                    RefundedAmount = refundedAmount,
                    StripeRefundId = stripeRefundId,
                    StripeAction   = stripeAction,
                });
            }
            catch (StripeException stripeEx)
            {
                Console.WriteLine($"Stripe error during admin cancel: {stripeEx.Message}");
                return StatusCode(502, new { message = $"Stripe error: {stripeEx.StripeError?.Message ?? stripeEx.Message}" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Admin cancel/refund error: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to cancel and refund: {ex.Message}" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/start")]
        public async Task<ActionResult> StartJob(int id)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User ID not found" });
                }

                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != userId)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                {
                    return BadRequest(new { message = "Cannot start a cancelled or completed booking" });
                }

                booking.WorkStartedAt ??= DateTime.UtcNow;
                if (booking.Status != BookingStatus.InProgress)
                {
                    booking.Status = BookingStatus.InProgress;
                }
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                try
                {
                    await _adminNotificationService.NotifyJobStartedAsync(booking);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: job start notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new { message = "Job started successfully", workStartedAt = booking.WorkStartedAt });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error starting job: {ex.Message}");
                return StatusCode(500, new { message = "Failed to start job" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/on-my-way")]
        public async Task<ActionResult> MarkOnMyWay(int id)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User ID not found" });
                }

                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != userId)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                {
                    return BadRequest(new { message = "On My Way updates are not available for this job." });
                }

                if (booking.WorkStartedAt.HasValue || booking.Status == BookingStatus.InProgress)
                {
                    return BadRequest(new { message = "On My Way updates are not available after the job has started." });
                }

                var now = DateTime.UtcNow;
                booking.WorkerOnMyWayAt = now;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                try
                {
                    await _adminNotificationService.NotifyWorkerOnMyWayAsync(booking);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: On My Way notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new
                {
                    message = "On My Way marked successfully",
                    workerOnMyWayAt = booking.WorkerOnMyWayAt
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error marking On My Way: {ex.Message}");
                return StatusCode(500, new { message = "Failed to mark On My Way" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/arrived")]
        public async Task<ActionResult> MarkArrived(int id)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User ID not found" });
                }

                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != userId)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.Completed)
                {
                    return BadRequest(new { message = "Arrival updates are not available for this job." });
                }

                if (booking.WorkStartedAt.HasValue || booking.Status == BookingStatus.InProgress)
                {
                    return BadRequest(new { message = "Arrival updates are not available after the job has started." });
                }

                var now = DateTime.UtcNow;
                if (booking.WorkerArrivedAt.HasValue)
                {
                    var elapsed = now - booking.WorkerArrivedAt.Value;
                    if (elapsed < WorkerArrivalNotificationCooldown)
                    {
                        var remaining = WorkerArrivalNotificationCooldown - elapsed;
                        return StatusCode(StatusCodes.Status429TooManyRequests, new
                        {
                            message = "You can resend the arrival notification after the cooldown.",
                            workerArrivedAt = booking.WorkerArrivedAt,
                            cooldownSecondsRemaining = (int)Math.Ceiling(remaining.TotalSeconds),
                            nextAllowedAt = booking.WorkerArrivedAt.Value.Add(WorkerArrivalNotificationCooldown)
                        });
                    }
                }

                booking.WorkerArrivedAt = now;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                try
                {
                    await _adminNotificationService.NotifyWorkerArrivedAsync(booking);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: worker arrival notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new
                {
                    message = "Arrival marked successfully",
                    workerArrivedAt = booking.WorkerArrivedAt,
                    nextAllowedAt = booking.WorkerArrivedAt.Value.Add(WorkerArrivalNotificationCooldown),
                    cooldownSeconds = (int)WorkerArrivalNotificationCooldown.TotalSeconds
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error marking arrival: {ex.Message}");
                return StatusCode(500, new { message = "Failed to mark arrival" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/running-late")]
        public async Task<ActionResult> MarkRunningLate(int id, [FromBody] MarkRunningLateDto? dto)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User ID not found" });
                }

                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != userId)
                {
                    return Forbid();
                }

                var delayMinutes = Math.Clamp(dto?.DelayMinutes ?? 10, 5, 120);
                var delayReason = string.IsNullOrWhiteSpace(dto?.Reason)
                    ? "Traffic delay"
                    : dto!.Reason!.Trim();

                booking.WorkerRunningLateAt ??= DateTime.UtcNow;
                booking.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                try
                {
                    await _adminNotificationService.NotifyWorkerRunningLateAsync(booking, delayMinutes, delayReason);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: running-late notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new
                {
                    message = $"Running late notification sent to customer ({delayMinutes} minutes)",
                    workerRunningLateAt = booking.WorkerRunningLateAt,
                    delayMinutes,
                    reason = delayReason
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error marking running late: {ex.Message}");
                return StatusCode(500, new { message = "Failed to mark running late" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/finish")]
        public async Task<ActionResult> FinishJob(int id)
        {
            try
            {
                var userId = GetUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(new { message = "User ID not found" });
                }

                var booking = await _context.Bookings.FindAsync(id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != userId)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Completed && booking.StockDeductedAt.HasValue)
                {
                    return Ok(new
                    {
                        message = "Job was already finished.",
                        workCompletedAt = booking.WorkCompletedAt,
                        workDurationSeconds = booking.WorkDurationSeconds,
                        stockDeductedAt = booking.StockDeductedAt,
                    });
                }

                if (booking.Status == BookingStatus.Cancelled)
                {
                    return BadRequest(new { message = "Cannot finish a cancelled booking" });
                }

                var productUsage = BuildProductUsageMap(booking);
                var stockShortages = new List<object>();

                foreach (var usage in productUsage)
                {
                    var product = booking.BookingItems
                        .SelectMany(item => item.Package?.PackageServices ?? new List<PackageService>())
                        .SelectMany(ps => ps.Service?.ServiceProducts ?? new List<ServiceProduct>())
                        .Where(sp => sp.ProductId == usage.Key)
                        .Select(sp => sp.Product)
                        .FirstOrDefault(p => p != null);

                    if (product == null)
                    {
                        continue;
                    }

                    var requiredUnits = ToStockUnits(usage.Value);
                    var previousStock = product.StockQuantity;
                    var deductedUnits = Math.Min(previousStock, requiredUnits);

                    product.StockQuantity = Math.Max(0, previousStock - requiredUnits);
                    product.UpdatedAt = DateTime.UtcNow;

                    if (requiredUnits > previousStock)
                    {
                        stockShortages.Add(new
                        {
                            productId = product.Id,
                            productName = product.Name,
                            required = requiredUnits,
                            available = previousStock,
                            deducted = deductedUnits,
                        });
                    }
                }

                booking.Status = BookingStatus.Completed;
                booking.WorkCompletedAt ??= DateTime.UtcNow;

                if (booking.WorkStartedAt.HasValue && booking.WorkCompletedAt.HasValue)
                {
                    var durationSeconds = (int)Math.Max(0, Math.Round((booking.WorkCompletedAt.Value - booking.WorkStartedAt.Value).TotalSeconds));
                    booking.WorkDurationSeconds = durationSeconds;
                }

                booking.UpdatedAt = DateTime.UtcNow;
                booking.StockDeductedAt ??= DateTime.UtcNow;

                await _context.SaveChangesAsync();

                try
                {
                    await _adminNotificationService.NotifyJobCompletedAsync(booking);
                }
                catch (Exception notifyEx)
                {
                    Console.WriteLine($"Warning: job completion notification failed for booking {booking.Id}: {notifyEx.Message}");
                }

                return Ok(new
                {
                    message = "Job finished successfully",
                    workCompletedAt = booking.WorkCompletedAt,
                    workDurationSeconds = booking.WorkDurationSeconds,
                    stockDeductedAt = booking.StockDeductedAt,
                    stockShortages,
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error finishing job: {ex.Message}");
                return StatusCode(500, new { message = "Failed to finish job" });
            }
        }

            [Authorize(Roles = "Employee")]
        [HttpPost("{id}/pause")]
        public async Task<ActionResult> PauseJob(int id, [FromBody] PauseJobDto dto)
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var booking = await _context.Bookings
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != workerId.Value)
                {
                    return Forbid();
                }

                var pauseReason = string.IsNullOrWhiteSpace(dto.Reason) ? "No reason provided" : dto.Reason.Trim();
                booking.Status    = BookingStatus.Paused;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _adminNotificationService.NotifyJobPausedAsync(booking, pauseReason);

                return Ok(new { message = "Job paused and notifications sent." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error pausing job: {ex.Message}");
                return StatusCode(500, new { message = "Failed to pause job" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/resume")]
        public async Task<ActionResult> ResumeJob(int id)
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var booking = await _context.Bookings
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != workerId.Value)
                {
                    return Forbid();
                }

                booking.Status    = BookingStatus.InProgress;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _adminNotificationService.NotifyJobResumedAsync(booking);

                return Ok(new { message = "Job resumed and notifications sent." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error resuming job: {ex.Message}");
                return StatusCode(500, new { message = "Failed to resume job" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/add-package")]
        public async Task<ActionResult<BookingDto>> AddPackagesToBooking(int id, [FromBody] AddBookingPackageDto dto)
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != workerId.Value)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                {
                    return BadRequest(new { message = "Cannot modify a completed or cancelled booking." });
                }

                var package = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .FirstOrDefaultAsync(p => p.Id == dto.PackageId && p.IsActive);

                if (package == null)
                {
                    return NotFound(new { message = "Package not found or inactive." });
                }

                var quantityToAdd = Math.Max(1, dto.Quantity);
                var vehicleMultiplier = GetVehicleMultiplier(booking.VehicleType);
                var unitPrice = Math.Round(package.Price * vehicleMultiplier, 2);
                var packageUnitCost = package.PackageServices
                    .Sum(ps => ps.Service.ServiceProducts
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));
                var additionalItemCost = packageUnitCost * quantityToAdd;

                var existingItem = booking.BookingItems.FirstOrDefault(i => i.PackageId == package.Id);
                if (existingItem == null)
                {
                    booking.BookingItems.Add(new BookingItem
                    {
                        BookingId = booking.Id,
                        PackageId = package.Id,
                        Package = package,
                        Quantity = quantityToAdd,
                        Price = unitPrice,
                        ItemCost = additionalItemCost,
                        SnapshotDurationMinutes = package.EstimatedDurationMinutes,
                    });
                }
                else
                {
                    existingItem.Quantity += quantityToAdd;
                    existingItem.Price = unitPrice;
                    existingItem.ItemCost += additionalItemCost;
                }

                var subtotal = booking.BookingItems.Sum(item => item.Price * item.Quantity);
                var estimatedCost = booking.BookingItems.Sum(item => item.ItemCost);
                booking.TotalAmount = Math.Max(0, subtotal - booking.DiscountAmount);
                booking.EstimatedCost = estimatedCost;
                booking.EstimatedProfit = booking.TotalAmount - booking.EstimatedCost;
                booking.UpdatedAt = DateTime.UtcNow;

                var nextDisplayOrder = booking.ChecklistItems.Any()
                    ? booking.ChecklistItems.Max(ci => ci.DisplayOrder) + 1
                    : 1;

                var serviceNames = package.PackageServices
                    .Select(ps => ps.Service?.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(name => name)
                    .ToList();

                for (var quantityIndex = 1; quantityIndex <= quantityToAdd; quantityIndex++)
                {
                    if (serviceNames.Count == 0)
                    {
                        booking.ChecklistItems.Add(new BookingChecklistItem
                        {
                            BookingId = booking.Id,
                            Label = quantityToAdd > 1 ? $"{package.Name} #{quantityIndex}: Complete package" : $"{package.Name}: Complete package",
                            DisplayOrder = nextDisplayOrder++,
                        });
                        continue;
                    }

                    foreach (var serviceName in serviceNames)
                    {
                        booking.ChecklistItems.Add(new BookingChecklistItem
                        {
                            BookingId = booking.Id,
                            Label = quantityToAdd > 1
                                ? $"{package.Name} #{quantityIndex}: {serviceName}"
                                : $"{package.Name}: {serviceName}",
                            DisplayOrder = nextDisplayOrder++,
                        });
                    }
                }

                await _context.SaveChangesAsync();

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
                    AssignedWorkerId = booking.AssignedWorkerId,
                    AssignedWorkerName = booking.AssignedWorker == null ? null : $"{booking.AssignedWorker.FirstName} {booking.AssignedWorker.LastName}".Trim(),
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
                    ChecklistItems = MapChecklistItems(booking.ChecklistItems),
                    Items = booking.BookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => ps.Service.Name)
                            .Distinct()
                            .OrderBy(name => name)
                            .ToList(),
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
                Console.WriteLine($"Error adding package to booking: {ex.Message}");
                return StatusCode(500, new { message = "Failed to add package to booking" });
            }
        }

        [Authorize(Roles = "Employee")]
        [HttpPost("{id}/add-service")]
        public async Task<ActionResult<BookingDto>> AddServicesToBooking(int id, [FromBody] AddBookingServiceDto dto)
        {
            try
            {
                var workerId = GetUserId();
                if (!workerId.HasValue)
                {
                    return Unauthorized();
                }

                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Booking not found" });
                }

                if (booking.AssignedWorkerId != workerId.Value)
                {
                    return Forbid();
                }

                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                {
                    return BadRequest(new { message = "Cannot modify a completed or cancelled booking." });
                }

                var targetService = await _context.Services
                    .Include(s => s.ServiceProducts)
                        .ThenInclude(sp => sp.Product)
                    .FirstOrDefaultAsync(s => s.Id == dto.ServiceId && s.IsActive);

                if (targetService == null)
                {
                    return NotFound(new { message = "Service not found or inactive." });
                }

                var alreadyIncluded = booking.BookingItems.Any(item =>
                    item.Package.PackageServices.Any(ps => ps.ServiceId == dto.ServiceId));

                if (alreadyIncluded)
                {
                    return BadRequest(new { message = "This service is already included in the current booking." });
                }

                var packagesContainingService = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .Where(p => p.IsActive && p.PackageServices.Any(ps => ps.ServiceId == dto.ServiceId))
                    .OrderBy(p => p.Price)
                    .ThenBy(p => p.EstimatedDurationMinutes)
                    .ToListAsync();

                // Use a dedicated single-service add-on package so only selected services are added.
                var singleServiceAddonPackage = await _context.Packages
                    .Include(p => p.PackageServices)
                        .ThenInclude(ps => ps.Service)
                            .ThenInclude(s => s.ServiceProducts)
                                .ThenInclude(sp => sp.Product)
                    .Where(p => p.PackageServices.Count == 1 && p.PackageServices.Any(ps => ps.ServiceId == dto.ServiceId))
                    .OrderBy(p => p.CreatedAt)
                    .FirstOrDefaultAsync();

                if (singleServiceAddonPackage == null)
                {
                    var derivedPriceCandidates = packagesContainingService
                        .Select(p =>
                        {
                            var serviceCount = Math.Max(1, p.PackageServices.Count);
                            return p.Price / serviceCount;
                        })
                        .Where(v => v > 0)
                        .ToList();

                    var serviceEstimatedCost = targetService.ServiceProducts
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit);

                    var baseUnitPrice = derivedPriceCandidates.Count > 0
                        ? derivedPriceCandidates.Min()
                        : Math.Max(15m, serviceEstimatedCost * 2m);

                    var addonPackage = new Package
                    {
                        Name = $"Service Add-On: {targetService.Name}",
                        Description = targetService.Description,
                        Price = Math.Round(baseUnitPrice, 2),
                        Tier = "Add-On",
                        EstimatedDurationMinutes = Math.Max(5, targetService.DefaultDurationMinutes),
                        IsActive = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };

                    _context.Packages.Add(addonPackage);
                    await _context.SaveChangesAsync();

                    _context.PackageServices.Add(new PackageService
                    {
                        PackageId = addonPackage.Id,
                        ServiceId = targetService.Id,
                    });

                    await _context.SaveChangesAsync();

                    singleServiceAddonPackage = await _context.Packages
                        .Include(p => p.PackageServices)
                            .ThenInclude(ps => ps.Service)
                                .ThenInclude(s => s.ServiceProducts)
                                    .ThenInclude(sp => sp.Product)
                        .FirstAsync(p => p.Id == addonPackage.Id);
                }

                var quantityToAdd = Math.Max(1, dto.Quantity);
                var vehicleMultiplier = GetVehicleMultiplier(booking.VehicleType);
                var unitPrice = Math.Round(singleServiceAddonPackage.Price * vehicleMultiplier, 2);
                var packageUnitCost = singleServiceAddonPackage.PackageServices
                    .Sum(ps => ps.Service.ServiceProducts
                        .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit));
                var additionalItemCost = packageUnitCost * quantityToAdd;

                var existingItem = booking.BookingItems.FirstOrDefault(i => i.PackageId == singleServiceAddonPackage.Id);
                if (existingItem == null)
                {
                    booking.BookingItems.Add(new BookingItem
                    {
                        BookingId = booking.Id,
                        PackageId = singleServiceAddonPackage.Id,
                        Package = singleServiceAddonPackage,
                        Quantity = quantityToAdd,
                        Price = unitPrice,
                        ItemCost = additionalItemCost,
                        SnapshotDurationMinutes = singleServiceAddonPackage.EstimatedDurationMinutes,
                    });
                }
                else
                {
                    existingItem.Quantity += quantityToAdd;
                    existingItem.Price = unitPrice;
                    existingItem.ItemCost += additionalItemCost;
                }

                var subtotal = booking.BookingItems.Sum(item => item.Price * item.Quantity);
                var estimatedCost = booking.BookingItems.Sum(item => item.ItemCost);
                booking.TotalAmount = Math.Max(0, subtotal - booking.DiscountAmount);
                booking.EstimatedCost = estimatedCost;
                booking.EstimatedProfit = booking.TotalAmount - booking.EstimatedCost;
                booking.UpdatedAt = DateTime.UtcNow;

                var nextDisplayOrder = booking.ChecklistItems.Any()
                    ? booking.ChecklistItems.Max(ci => ci.DisplayOrder) + 1
                    : 1;

                var serviceNames = singleServiceAddonPackage.PackageServices
                    .Select(ps => ps.Service?.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(name => name)
                    .ToList();

                for (var quantityIndex = 1; quantityIndex <= quantityToAdd; quantityIndex++)
                {
                    if (serviceNames.Count == 0)
                    {
                        booking.ChecklistItems.Add(new BookingChecklistItem
                        {
                            BookingId = booking.Id,
                            Label = quantityToAdd > 1 ? $"{singleServiceAddonPackage.Name} #{quantityIndex}: Complete package" : $"{singleServiceAddonPackage.Name}: Complete package",
                            DisplayOrder = nextDisplayOrder++,
                        });
                        continue;
                    }

                    foreach (var serviceName in serviceNames)
                    {
                        booking.ChecklistItems.Add(new BookingChecklistItem
                        {
                            BookingId = booking.Id,
                            Label = quantityToAdd > 1
                                ? $"{singleServiceAddonPackage.Name} #{quantityIndex}: {serviceName}"
                                : $"{singleServiceAddonPackage.Name}: {serviceName}",
                            DisplayOrder = nextDisplayOrder++,
                        });
                    }
                }

                await _context.SaveChangesAsync();

                var totalDurationMinutes = booking.BookingItems.Sum(bi => bi.Package.EstimatedDurationMinutes * bi.Quantity);
                await _adminNotificationService.NotifyServiceAddedAsync(booking, targetService.Name, booking.TotalAmount, totalDurationMinutes);

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
                    AssignedWorkerName = booking.AssignedWorker == null ? null : $"{booking.AssignedWorker.FirstName} {booking.AssignedWorker.LastName}".Trim(),
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
                    ChecklistItems = MapChecklistItems(booking.ChecklistItems),
                    Items = booking.BookingItems.Select(bi => new BookingItemDetailDto
                    {
                        PackageId = bi.PackageId,
                        PackageName = bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => ps.Service.Name)
                            .Distinct()
                            .OrderBy(name => name)
                            .ToList(),
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
                Console.WriteLine($"Error adding service to booking: {ex.Message}");
                return StatusCode(500, new { message = "Failed to add service to booking" });
            }
        }

        // â”€â”€â”€ Worker Absence + Auto-Reassign â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize(Roles = "Admin")]
        [HttpPost("worker-absence")]
        public async Task<ActionResult<WorkerAbsenceResultDto>> MarkWorkerAbsent([FromBody] WorkerAbsenceDto dto)
        {
            try
            {
                var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == dto.WorkerId);
                if (worker == null) return NotFound(new { message = "Worker not found" });

                var fromUtc = DateTime.SpecifyKind(dto.FromDate.Date, DateTimeKind.Utc);
                var toUtc   = DateTime.SpecifyKind(dto.ToDate.Date,   DateTimeKind.Utc);

                // Find all non-terminal bookings assigned to this worker in the date range
                var affectedBookings = await _context.Bookings
                    .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                    .Where(b =>
                        b.AssignedWorkerId == worker.Id &&
                        b.ScheduledDate.Date >= fromUtc.Date &&
                        b.ScheduledDate.Date <= toUtc.Date &&
                        b.Status != BookingStatus.Completed &&
                        b.Status != BookingStatus.Cancelled)
                    .ToListAsync();

                int reassigned = 0;
                int unassigned = 0;
                var unassignedNumbers = new List<string>();

                var workerTravelBufferWA = await GetWorkerTravelBufferMinutesAsync();

                foreach (var booking in affectedBookings)
                {
                    var durationMinutes = ResolveBookingDurationMinutes(booking);
                    var replacement = await FindAutoAssignableWorkerAsync(booking.ScheduledDate, booking.TimeSlot, durationMinutes, workerTravelBufferWA);

                    if (replacement != null && replacement.Id != worker.Id)
                    {
                        booking.AssignedWorkerId = replacement.Id;
                        booking.UpdatedAt = DateTime.UtcNow;
                        reassigned++;
                        await _adminNotificationService.NotifyBookingClaimedAsync(booking, replacement.Id);
                    }
                    else
                    {
                        booking.AssignedWorkerId = null;
                        if (booking.Status == BookingStatus.Confirmed)
                            booking.Status = BookingStatus.Pending;
                        booking.UpdatedAt = DateTime.UtcNow;
                        unassigned++;
                        unassignedNumbers.Add(booking.BookingNumber);

                        // Notify admins that this booking needs manual attention
                        var workerName = $"{worker.FirstName} {worker.LastName}".Trim();
                        await _adminNotificationService.NotifyUnassignedBookingAsync(booking, workerName);
                    }
                }

                await _context.SaveChangesAsync();

                var summary = reassigned == 0 && unassigned == 0
                    ? $"{worker.FirstName} has no upcoming bookings in that period."
                    : $"{reassigned} job(s) reassigned, {unassigned} job(s) need manual attention.";

                return Ok(new WorkerAbsenceResultDto
                {
                    Reassigned = reassigned,
                    Unassigned = unassigned,
                    UnassignedBookingNumbers = unassignedNumbers,
                    Summary = summary,
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Worker absence error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to process worker absence" });
            }
        }

        // â”€â”€â”€ Customer Change Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize]
        [HttpPost("{id}/request-cancellation")]
        public async Task<ActionResult> RequestCancellation(int id, [FromBody] RequestCancellationDto dto)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdClaim?.Value, out int userId))
                    return Unauthorized();

                var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
                if (booking == null) return NotFound(new { message = "Booking not found" });

                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                    return BadRequest(new { message = "Cannot request changes on completed or cancelled bookings" });

                booking.CancellationRequested = true;
                booking.CancellationRequestReason = dto.Reason;
                booking.CancellationRequestedAt = DateTime.UtcNow;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _adminNotificationService.NotifyCancellationRequestedAsync(booking);

                return Ok(new { message = "Cancellation request submitted. Our team will review and contact you shortly." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Request cancellation error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit request" });
            }
        }

        [Authorize]
        [HttpPost("{id}/request-reschedule")]
        public async Task<ActionResult> RequestReschedule(int id, [FromBody] RequestRescheduleDto dto)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdClaim?.Value, out int userId))
                    return Unauthorized();

                var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
                if (booking == null) return NotFound(new { message = "Booking not found" });

                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                    return BadRequest(new { message = "Cannot request changes on completed or cancelled bookings" });

                booking.RescheduleRequested = true;
                booking.RescheduleRequestNote = dto.Reason;
                booking.ReschedulePreferredDate = dto.PreferredDate;
                booking.RescheduleRequestedAt = DateTime.UtcNow;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _adminNotificationService.NotifyRescheduleRequestedAsync(booking, dto.PreferredDate, dto.PreferredTime);

                return Ok(new { message = "Reschedule request submitted. Our team will contact you to confirm the new date." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Request reschedule error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit request" });
            }
        }

        // â”€â”€â”€ Reject Cancellation Request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/reject-cancellation-request")]
        public async Task<ActionResult> RejectCancellationRequest(int id)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null) return NotFound(new { message = "Booking not found" });
                if (!booking.CancellationRequested)
                    return BadRequest(new { message = "No cancellation request found for this booking" });

                booking.CancellationRequested = false;
                booking.CancellationRequestReason = null;
                booking.CancellationRequestedAt = null;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _adminNotificationService.NotifyCancellationRequestRejectedAsync(booking);

                return Ok(new { message = "Cancellation request rejected. Customer notified." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Reject cancellation request error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to reject cancellation request" });
            }
        }

        // â”€â”€â”€ Reject Reschedule Request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/reject-reschedule-request")]
        public async Task<ActionResult> RejectRescheduleRequest(int id)
        {
            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null) return NotFound(new { message = "Booking not found" });
                if (!booking.RescheduleRequested)
                    return BadRequest(new { message = "No reschedule request found for this booking" });

                booking.RescheduleRequested = false;
                booking.RescheduleRequestNote = null;
                booking.ReschedulePreferredDate = null;
                booking.RescheduleRequestedAt = null;
                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                await _adminNotificationService.NotifyRescheduleRequestRejectedAsync(booking);

                return Ok(new { message = "Reschedule request rejected. Customer notified." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Reject reschedule request error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to reject reschedule request" });
            }
        }

        // â”€â”€â”€ Cancellation Fee Calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize]
        [HttpGet("{id}/cancellation-fee")]
        public async Task<ActionResult<CancellationFeeInfoDto>> GetCancellationFee(int id)
        {
            try
            {
                var booking = await _context.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id);
                if (booking == null) return NotFound(new { message = "Booking not found" });

                var feeInfo = await CalculateCancellationFeeAsync(booking);
                return Ok(feeInfo);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Get cancellation fee error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to calculate fee" });
            }
        }

        private async Task<CancellationFeeInfoDto> CalculateCancellationFeeAsync(Booking booking)
        {
            const string FeeEnabledKey = "cancellation.feeEnabled";
            const string FeeTypeKey    = "cancellation.feeType";
            const string FeeAmountKey  = "cancellation.feeAmount";
            const string FreeWindowKey = "cancellation.freeWindowHours";

            var settings = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.Key == FeeEnabledKey || s.Key == FeeTypeKey || s.Key == FeeAmountKey || s.Key == FreeWindowKey)
                .ToListAsync();

            string GetVal(string k) => settings.FirstOrDefault(s => s.Key == k)?.Value ?? string.Empty;

            bool feeEnabled = bool.TryParse(GetVal(FeeEnabledKey), out var fe) && fe;
            string feeType  = GetVal(FeeTypeKey) is { Length: > 0 } ft ? ft : "Percent";
            decimal feeAmt  = decimal.TryParse(GetVal(FeeAmountKey), out var fa) ? fa : 20m;
            int freeHrs     = int.TryParse(GetVal(FreeWindowKey), out var fh) ? fh : 24;

            var appointmentUtc  = booking.ScheduledDate.ToUniversalTime();
            var hoursUntil      = (appointmentUtc - DateTime.UtcNow).TotalHours;
            bool withinFreeWindow = hoursUntil > freeHrs;

            decimal calculatedFee = 0m;
            if (feeEnabled && !withinFreeWindow && hoursUntil > 0)
            {
                calculatedFee = string.Equals(feeType, "Percent", StringComparison.OrdinalIgnoreCase)
                    ? Math.Round(booking.TotalAmount * (feeAmt / 100m), 2)
                    : Math.Min(feeAmt, booking.TotalAmount);
            }

            return new CancellationFeeInfoDto
            {
                FeeEnabled           = feeEnabled,
                FeeType              = feeType,
                FeeAmount            = feeAmt,
                FreeWindowHours      = freeHrs,
                BookingTotal         = booking.TotalAmount,
                CalculatedFee        = calculatedFee,
                WithinFreeWindow     = withinFreeWindow,
                HoursUntilAppointment = Math.Max(0, hoursUntil),
            };
        }

        // â”€â”€â”€ Admin: Full Booking Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize]
        [HttpPut("{id}/admin-edit")]
        public async Task<ActionResult<BookingDto>> AdminEditBooking(int id, [FromBody] AdminEditBookingDto dto)
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p!.PackageServices)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null) return NotFound(new { message = "Booking not found" });

                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                    return BadRequest(new { message = "Cannot edit completed or cancelled bookings." });

                var workerTravelBufferEdit = await GetWorkerTravelBufferMinutesAsync();

                // â”€â”€ Date / time change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                bool dateChanged = false;
                if (dto.ScheduledDate.HasValue || dto.TimeSlot != null)
                {
                    var newDate = dto.ScheduledDate?.Date ?? booking.ScheduledDate.Date;
                    var newSlot = dto.TimeSlot ?? booking.TimeSlot;

                    // Accept both start-only ("16:30") and range ("16:00-17:00") formats.
                    // Validate the start time is parseable and within business hours.
                    if (!TryParseSlotStart(newSlot, out var parsedSlotStart)
                        || !TryGetBusinessDayBounds(out var bDayStart, out var bDayEnd)
                        || parsedSlotStart.TotalMinutes < bDayStart
                        || parsedSlotStart.TotalMinutes >= bDayEnd)
                        return BadRequest(new { message = $"Invalid time slot '{newSlot}'. Must be a valid time within business hours." });

                    // Estimate duration from booking items
                    var estimatedMinutes = booking.BookingItems.Sum(bi =>
                        bi.Package?.EstimatedDurationMinutes ?? 0);
                    if (estimatedMinutes <= 0) estimatedMinutes = 60;

                    // Check availability for the new date/time (excluding this booking)
                    var newDateTime = new DateTime(newDate.Year, newDate.Month, newDate.Day, 0, 0, 0, DateTimeKind.Utc);
                    var slotOk = await IsSlotAvailableForEditAsync(newDateTime, newSlot, estimatedMinutes, booking.Id, booking.AssignedWorkerId, workerTravelBufferEdit);
                    if (!slotOk)
                        return BadRequest(new { message = "The selected date and time slot is not available. Please choose a different slot." });

                    if (dto.ScheduledDate.HasValue && dto.ScheduledDate.Value.Date != booking.ScheduledDate.Date
                        || (dto.TimeSlot != null && dto.TimeSlot != booking.TimeSlot))
                    {
                        dateChanged = true;
                    }

                    booking.ScheduledDate = newDateTime;
                    booking.TimeSlot = newSlot;
                }

                // â”€â”€ Packages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.Packages != null && dto.Packages.Count > 0)
                {
                    // Load all referenced packages (with cost data)
                    var packageIds = dto.Packages.Select(p => p.PackageId).Distinct().ToList();
                    var newPackages = await _context.Packages
                        .Include(p => p.PackageServices)
                            .ThenInclude(ps => ps.Service)
                                .ThenInclude(s => s.ServiceProducts)
                                    .ThenInclude(sp => sp.Product)
                        .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                        .ToDictionaryAsync(p => p.Id);

                    var missingPackages = packageIds.Where(id => !newPackages.ContainsKey(id)).ToList();
                    if (missingPackages.Count > 0)
                        return BadRequest(new { message = $"Package(s) not found or inactive: {string.Join(", ", missingPackages)}" });

                    // Calculate new duration and check slot availability
                    var newDuration = dto.Packages.Sum(item => newPackages[item.PackageId].EstimatedDurationMinutes);
                    if (newDuration <= 0) newDuration = 60;

                    var checkDate = booking.ScheduledDate;
                    var checkSlot = booking.TimeSlot;
                    var slotOkForNewDuration = await IsSlotAvailableForEditAsync(checkDate, checkSlot, newDuration, booking.Id, booking.AssignedWorkerId, workerTravelBufferEdit);

                    if (!slotOkForNewDuration)
                    {
                        // Return available slots for this date with the new duration
                        var altSlots = await GetAvailableSlotsForDateAsync(checkDate, newDuration, booking.Id, workerTravelBufferEdit);
                        return BadRequest(new
                        {
                            message = $"The current time slot cannot fit the new package selection ({newDuration} min). " +
                                      (altSlots.Count > 0
                                          ? $"Available slots on the same day: {string.Join(", ", altSlots)}."
                                          : "No available slots on the same day â€” please choose a different date."),
                            availableSlots = altSlots,
                            newDurationMinutes = newDuration
                        });
                    }

                    // Replace booking items
                    var vehicleMultiplier = GetVehicleMultiplier(booking.VehicleType);
                    decimal newTotal = 0m, newCost = 0m;
                    var newItems = new List<BookingItem>();

                    foreach (var item in dto.Packages)
                    {
                        var pkg = newPackages[item.PackageId];
                        var unitPrice = Math.Round(pkg.Price * vehicleMultiplier, 2);
                        var itemCost  = pkg.PackageServices
                            .Sum(ps => ps.Service.ServiceProducts
                                .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)) * item.Quantity;

                        newTotal += unitPrice * item.Quantity;
                        newCost  += itemCost;
                        newItems.Add(new BookingItem
                        {
                            BookingId = booking.Id,
                            PackageId = pkg.Id,
                            Price     = unitPrice,
                            Quantity  = item.Quantity,
                            ItemCost  = itemCost,
                            SnapshotDurationMinutes = pkg.EstimatedDurationMinutes,
                        });
                    }

                    // Remove old items and add new ones
                    _context.BookingItems.RemoveRange(booking.BookingItems);
                    booking.BookingItems = newItems;
                    booking.TotalAmount      = newTotal;
                    booking.EstimatedCost    = newCost;
                    booking.EstimatedProfit  = newTotal - newCost;
                }

                // â”€â”€ Vehicle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.VehicleMake    != null) booking.VehicleMake  = dto.VehicleMake;
                if (dto.VehicleModel   != null) booking.VehicleModel = dto.VehicleModel;
                if (dto.VehicleYear    != null) booking.VehicleYear  = dto.VehicleYear;
                if (dto.VehicleType.HasValue)   booking.VehicleType  = dto.VehicleType.Value;

                // â”€â”€ Address â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.CustomerAddress != null) booking.CustomerAddress = dto.CustomerAddress;
                if (dto.HouseNumber     != null) booking.HouseNumber     = dto.HouseNumber;
                if (dto.AddressType     != null) booking.AddressType     = dto.AddressType;

                // â”€â”€ Misc â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.SpecialInstructions != null) booking.SpecialInstructions = dto.SpecialInstructions;

                // Clear reschedule request since admin has now handled it
                if (dateChanged && booking.RescheduleRequested)
                {
                    booking.RescheduleRequested = false;
                    booking.RescheduleRequestNote = null;
                    booking.ReschedulePreferredDate = null;
                    booking.RescheduleRequestedAt = null;
                }

                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                if (booking.UserId.HasValue)
                    await _adminNotificationService.NotifyBookingEditedByAdminAsync(booking);

                return Ok(MapToBookingDto(booking));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Admin edit booking error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update booking." });
            }
        }

        // â”€â”€â”€ Customer: Self-Service Booking Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        [Authorize]
        [HttpPut("{id}/customer-edit")]
        public async Task<ActionResult<BookingDto>> CustomerEditBooking(int id, [FromBody] CustomerEditBookingDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            try
            {
                var booking = await _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p!.PackageServices)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (booking == null) return NotFound(new { message = "Booking not found" });
                if (booking.UserId != userId.Value)
                    return Forbid();
                if (booking.Status == BookingStatus.Completed || booking.Status == BookingStatus.Cancelled)
                    return BadRequest(new { message = "Cannot edit completed or cancelled bookings." });
                // Prevent edits once the worker has started
                if (booking.Status == BookingStatus.InProgress)
                    return BadRequest(new { message = "Cannot edit a booking that is already in progress." });

                var workerTravelBufferCE = await GetWorkerTravelBufferMinutesAsync();

                // â”€â”€ Date / time change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                bool dateChanged = false;
                if (dto.ScheduledDate.HasValue || dto.TimeSlot != null)
                {
                    var newDate = dto.ScheduledDate?.Date ?? booking.ScheduledDate.Date;
                    var newSlot = dto.TimeSlot ?? booking.TimeSlot;

                    // Accept both start-only ("16:30") and range ("16:00-17:00") formats.
                    if (!TryParseSlotStart(newSlot, out var parsedSlotStart2)
                        || !TryGetBusinessDayBounds(out var bDayStart2, out var bDayEnd2)
                        || parsedSlotStart2.TotalMinutes < bDayStart2
                        || parsedSlotStart2.TotalMinutes >= bDayEnd2)
                        return BadRequest(new { message = $"Invalid time slot '{newSlot}'." });

                    var estimatedMinutes = booking.BookingItems.Sum(bi => bi.Package?.EstimatedDurationMinutes ?? 0);
                    if (estimatedMinutes <= 0) estimatedMinutes = 60;

                    var newDateTime = new DateTime(newDate.Year, newDate.Month, newDate.Day, 0, 0, 0, DateTimeKind.Utc);
                    var slotOk = await IsSlotAvailableForEditAsync(newDateTime, newSlot, estimatedMinutes, booking.Id, booking.AssignedWorkerId, workerTravelBufferCE);
                    if (!slotOk)
                    {
                        var altSlots = await GetAvailableSlotsForDateAsync(newDateTime, estimatedMinutes, booking.Id, workerTravelBufferCE);
                        return BadRequest(new
                        {
                            message = "The selected time slot is not available.",
                            availableSlots = altSlots
                        });
                    }

                    if ((dto.ScheduledDate.HasValue && dto.ScheduledDate.Value.Date != booking.ScheduledDate.Date)
                        || (dto.TimeSlot != null && dto.TimeSlot != booking.TimeSlot))
                        dateChanged = true;

                    booking.ScheduledDate = newDateTime;
                    booking.TimeSlot = newSlot;
                }

                // â”€â”€ Packages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.Packages != null && dto.Packages.Count > 0)
                {
                    var packageIds = dto.Packages.Select(p => p.PackageId).Distinct().ToList();
                    var newPackages = await _context.Packages
                        .Include(p => p.PackageServices)
                            .ThenInclude(ps => ps.Service)
                                .ThenInclude(s => s.ServiceProducts)
                                    .ThenInclude(sp => sp.Product)
                        .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                        .ToDictionaryAsync(p => p.Id);

                    var missingPackages = packageIds.Where(pkgId => !newPackages.ContainsKey(pkgId)).ToList();
                    if (missingPackages.Count > 0)
                        return BadRequest(new { message = $"Package(s) not found or inactive: {string.Join(", ", missingPackages)}" });

                    var newDuration = dto.Packages.Sum(item => newPackages[item.PackageId].EstimatedDurationMinutes);
                    if (newDuration <= 0) newDuration = 60;

                    var checkDate = booking.ScheduledDate;
                    var checkSlot = booking.TimeSlot;
                    var slotOk = await IsSlotAvailableForEditAsync(checkDate, checkSlot, newDuration, booking.Id, booking.AssignedWorkerId, workerTravelBufferCE);
                    if (!slotOk)
                    {
                        var altSlots = await GetAvailableSlotsForDateAsync(checkDate, newDuration, booking.Id, workerTravelBufferCE);
                        return BadRequest(new
                        {
                            message = $"The current time slot cannot fit the updated package selection ({newDuration} min).",
                            availableSlots = altSlots,
                            newDurationMinutes = newDuration
                        });
                    }

                    var vehicleMultiplier = GetVehicleMultiplier(booking.VehicleType);
                    decimal newTotal = 0m, newCost = 0m;
                    var newItems = new List<BookingItem>();

                    foreach (var item in dto.Packages)
                    {
                        var pkg = newPackages[item.PackageId];
                        var unitPrice = Math.Round(pkg.Price * vehicleMultiplier, 2);
                        var itemCost = pkg.PackageServices
                            .Sum(ps => ps.Service.ServiceProducts
                                .Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)) * item.Quantity;

                        newTotal += unitPrice * item.Quantity;
                        newCost  += itemCost;
                        newItems.Add(new BookingItem
                        {
                            BookingId = booking.Id,
                            PackageId = pkg.Id,
                            Price     = unitPrice,
                            Quantity  = item.Quantity,
                            ItemCost  = itemCost,
                            SnapshotDurationMinutes = pkg.EstimatedDurationMinutes,
                        });
                    }

                    _context.BookingItems.RemoveRange(booking.BookingItems);
                    booking.BookingItems     = newItems;
                    booking.TotalAmount      = newTotal;
                    booking.EstimatedCost    = newCost;
                    booking.EstimatedProfit  = newTotal - newCost;
                }

                // â”€â”€ Vehicle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.VehicleMake  != null) booking.VehicleMake  = dto.VehicleMake;
                if (dto.VehicleModel != null) booking.VehicleModel = dto.VehicleModel;
                if (dto.VehicleYear  != null) booking.VehicleYear  = dto.VehicleYear;
                if (dto.VehicleType.HasValue)  booking.VehicleType  = dto.VehicleType.Value;

                // â”€â”€ Address â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.CustomerAddress != null) booking.CustomerAddress = dto.CustomerAddress;
                if (dto.HouseNumber     != null) booking.HouseNumber     = dto.HouseNumber;
                if (dto.AddressType     != null) booking.AddressType     = dto.AddressType;

                // â”€â”€ Misc â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (dto.SpecialInstructions != null) booking.SpecialInstructions = dto.SpecialInstructions;

                // Clear any pending reschedule request since customer is self-rescheduling
                if (dateChanged && booking.RescheduleRequested)
                {
                    booking.RescheduleRequested = false;
                    booking.RescheduleRequestNote = null;
                    booking.ReschedulePreferredDate = null;
                    booking.RescheduleRequestedAt = null;
                }

                booking.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(MapToBookingDto(booking));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Customer edit booking error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update booking." });
            }
        }

        private async Task<bool> IsSlotAvailableForEditAsync(DateTime date, string timeSlot, int estimatedMinutes, int excludeBookingId, int? preferredWorkerId,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var dayOfWeek = date.DayOfWeek;

            // Get all active workers that work on this day
            var workers = await _context.Staff
                .AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var availableWorkers = workers.Where(w => WorkerWorksOnDay(w.WorkingDays, dayOfWeek)).ToList();
            if (availableWorkers.Count == 0) return false;

            // Get same-day bookings excluding the one being edited
            var workerIds = availableWorkers.Select(w => w.Id).ToList();
            var sameDayBookings = await _context.Bookings
                .Where(b => b.Id != excludeBookingId
                            && b.AssignedWorkerId.HasValue
                            && workerIds.Contains(b.AssignedWorkerId.Value)
                            && b.ScheduledDate.Date == date.Date
                            && b.Status != BookingStatus.Cancelled
                            && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var bookingsByWorker = sameDayBookings
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Check if any worker can cover this slot
            bool anyWorkerFree = availableWorkers.Any(worker =>
            {
                var (ss, se) = GetWorkerShiftForDay(worker, dayOfWeek);
                if (!TimeSlotInWorkerShift(timeSlot, estimatedMinutes, ss, se, workerTravelBuffer))
                    return false;

                var workerBookings = bookingsByWorker.TryGetValue(worker.Id, out var assigned)
                    ? assigned
                    : new List<Booking>();

                return !HasWorkerTimeConflict(workerBookings, timeSlot, estimatedMinutes, workerTravelBuffer);
            });

            return anyWorkerFree;
        }

        /// <summary>
        /// Returns available start-slot strings for a given date/duration, excluding one booking by ID
        /// (used to suggest alternatives when a package change makes the current slot too short).
        /// </summary>
        private async Task<List<string>> GetAvailableSlotsForDateAsync(DateTime date, int durationMinutes, int excludeBookingId,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var dayOfWeek = date.DayOfWeek;
            var workers = await _context.Staff
                .AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var availableWorkers = workers.Where(w => WorkerWorksOnDay(w.WorkingDays, dayOfWeek)).ToList();
            if (availableWorkers.Count == 0) return new List<string>();

            var workerIds = availableWorkers.Select(w => w.Id).ToList();
            var dayEnd = date.AddDays(1);
            var sameDayBookings = await _context.Bookings
                .Where(b => b.Id != excludeBookingId
                    && b.AssignedWorkerId.HasValue
                    && workerIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= date && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var bookingsByWorker = sameDayBookings
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<string>();
            foreach (var startSlot in BuildCandidateStartSlots(durationMinutes, dayOfWeek.ToString()))
            {
                var anyFree = availableWorkers.Any(worker =>
                {
                    var (ss, se) = GetWorkerShiftForDay(worker, dayOfWeek);
                    if (!TimeSlotInWorkerShift(startSlot, durationMinutes, ss, se, workerTravelBuffer))
                        return false;
                    var wb = bookingsByWorker.TryGetValue(worker.Id, out var assigned) ? assigned : new List<Booking>();
                    return !HasWorkerTimeConflict(wb, startSlot, durationMinutes, workerTravelBuffer);
                });
                if (anyFree) result.Add(startSlot);
            }
            return result;
        }

        // Helper: map Booking entity to BookingDto (reuses the pattern from existing GetAll)
        private static BookingDto MapToBookingDto(Booking booking)
        {
            var estimatedMinutes = booking.BookingItems.Sum(bi => bi.Package?.EstimatedDurationMinutes ?? 0);

            return new BookingDto
            {
                Id                        = booking.Id,
                BookingNumber             = booking.BookingNumber,
                ScheduledDate             = booking.ScheduledDate,
                TimeSlot                  = booking.TimeSlot,
                EstimatedDurationMinutes  = estimatedMinutes,
                Status                    = booking.Status.ToString(),
                PaymentStatus             = booking.PaymentStatus.ToString(),
                TotalAmount               = booking.TotalAmount,
                DiscountAmount            = booking.DiscountAmount,
                AppliedOfferCode          = booking.AppliedOfferCode,
                EstimatedCost             = booking.EstimatedCost,
                EstimatedProfit           = booking.EstimatedProfit,
                CustomerName              = booking.CustomerName,
                CustomerEmail             = booking.CustomerEmail,
                CustomerPhone             = booking.CustomerPhone,
                CustomerAddress           = booking.CustomerAddress,
                AddressType               = booking.AddressType,
                VehicleMake               = booking.VehicleMake,
                VehicleModel              = booking.VehicleModel,
                VehicleYear               = booking.VehicleYear,
                VehicleType               = booking.VehicleType.ToString(),
                SpecialInstructions       = booking.SpecialInstructions,
                AssignedWorkerId          = booking.AssignedWorkerId,
                AssignedWorkerName        = booking.AssignedWorker != null
                    ? $"{booking.AssignedWorker.FirstName} {booking.AssignedWorker.LastName}".Trim()
                    : null,
                WorkerArrivedAt           = booking.WorkerArrivedAt,
                WorkerRunningLateAt       = booking.WorkerRunningLateAt,
                WorkStartedAt             = booking.WorkStartedAt,
                WorkCompletedAt           = booking.WorkCompletedAt,
                WorkDurationSeconds       = booking.WorkDurationSeconds,
                CreatedAt                 = booking.CreatedAt,
                CancellationRequested     = booking.CancellationRequested,
                CancellationRequestReason = booking.CancellationRequestReason,
                CancellationRequestedAt   = booking.CancellationRequestedAt,
                RescheduleRequested       = booking.RescheduleRequested,
                RescheduleRequestNote     = booking.RescheduleRequestNote,
                ReschedulePreferredDate   = booking.ReschedulePreferredDate,
                RescheduleRequestedAt     = booking.RescheduleRequestedAt,
                Items                     = new List<BookingItemDetailDto>(),
                ChecklistItems            = booking.ChecklistItems?
                    .Select(ci => new BookingChecklistItemDto
                    {
                        Id           = ci.Id,
                        Label        = ci.Label,
                        DisplayOrder = ci.DisplayOrder,
                        IsCompleted  = ci.IsCompleted,
                        CompletedAt  = ci.CompletedAt,
                    }).ToList() ?? new List<BookingChecklistItemDto>(),
            };
        }

        // â”€â”€ Before/After Photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        [Authorize(Roles = "Employee,Admin")]
        [HttpPost("{id}/photos")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadBookingPhoto(int id, [FromForm] UploadBookingPhotoDto dto)
        {
            try
            {
                var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
                if (booking == null)
                    return NotFound(new { message = "Booking not found" });

                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdClaim?.Value, out int uploaderId))
                    return Unauthorized();

                var file = dto.Photo;
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "No photo file provided" });

                const long maxSize = 10 * 1024 * 1024;
                if (file.Length > maxSize)
                    return BadRequest(new { message = "Photo must be under 10 MB" });

                var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!allowed.Contains(ext))
                    return BadRequest(new { message = "Allowed formats: jpg, jpeg, png, webp" });

                var folder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "booking-photos");
                Directory.CreateDirectory(folder);

                var fileName = $"{id}_{dto.PhotoType}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{ext}";
                var filePath = Path.Combine(folder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                    await file.CopyToAsync(stream);

                if (!Enum.TryParse<PhotoType>(dto.PhotoType, ignoreCase: true, out var photoType))
                    return BadRequest(new { message = "PhotoType must be 'Before' or 'After'" });

                var photo = new BookingPhoto
                {
                    BookingId          = id,
                    PhotoType          = photoType,
                    ImageUrl           = $"/uploads/booking-photos/{fileName}",
                    Caption            = dto.Caption,
                    UploadedByWorkerId = uploaderId,
                    CreatedAt          = DateTime.UtcNow,
                };
                _context.BookingPhotos.Add(photo);
                await _context.SaveChangesAsync();

                return Ok(new { id = photo.Id, imageUrl = photo.ImageUrl, photoType = photo.PhotoType.ToString() });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Photo upload error: {ex.Message}");
                return StatusCode(500, new { message = "Photo upload failed" });
            }
        }

        [Authorize]
        [HttpGet("{id}/photos")]
        public async Task<IActionResult> GetBookingPhotos(int id)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null)
                return NotFound(new { message = "Booking not found" });

            var photos = await _context.BookingPhotos
                .Where(p => p.BookingId == id)
                .OrderBy(p => p.PhotoType)
                .ThenBy(p => p.CreatedAt)
                .Select(p => new
                {
                    p.Id,
                    p.PhotoType,
                    p.ImageUrl,
                    p.Caption,
                    p.UploadedByWorkerId,
                    p.CreatedAt,
                })
                .ToListAsync();

            return Ok(photos);
        }
    }
}

