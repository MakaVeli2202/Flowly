using System.Text.Json;
using Glanz.API.DTOs;
using Glanz.API.Models;

namespace Glanz.API.Services
{
    /// <summary>
    /// Shared static helpers for worker-aware slot availability.
    /// Used by both BookingsController and SubscriptionBookingsController so
    /// both flows apply identical shift / buffer / conflict rules.
    /// </summary>
    internal static class BookingSlotHelper
    {
        internal const int DefaultWorkerTravelBufferMinutes = 30;
        internal const int SlotSelectionStepMinutes          = 30;

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        // Business-day bounds — mirror BookingsController defaults (09:00–18:00).
        private static readonly Dictionary<string, List<string>> _dailySlotsByDay = new()
        {
            { "Sunday",    BuildDailySlots("09:00", "18:00") },
            { "Monday",    BuildDailySlots("09:00", "18:00") },
            { "Tuesday",   BuildDailySlots("09:00", "18:00") },
            { "Wednesday", BuildDailySlots("09:00", "18:00") },
            { "Thursday",  BuildDailySlots("09:00", "18:00") },
            { "Friday",    BuildDailySlots("09:00", "18:00") },
            { "Saturday",  BuildDailySlots("09:00", "18:00") },
        };

        private static readonly Dictionary<string, (string Start, string End)> _dayBounds = new()
        {
            { "Sunday",    ("09:00", "18:00") },
            { "Monday",    ("09:00", "18:00") },
            { "Tuesday",   ("09:00", "18:00") },
            { "Wednesday", ("09:00", "18:00") },
            { "Thursday",  ("09:00", "18:00") },
            { "Friday",    ("00:00", "00:00") },
            { "Saturday",  ("10:00", "16:00") },
        };

        private static TimeZoneInfo _businessTz = ResolveBusinessTimeZone(null);

        /// <summary>
        /// Call at startup to apply configured business hours and timezone.
        /// For per-day hours, call SetBusinessHoursFromSettings instead.
        /// </summary>
        internal static void ApplyConfiguredTimeZone(string? tzId)
        {
            if (!string.IsNullOrWhiteSpace(tzId))
                _businessTz = ResolveBusinessTimeZone(tzId);
        }

        internal static void Configure(string? dayStart, string? dayEnd, string? tzId)
        {
            var start = string.IsNullOrWhiteSpace(dayStart) ? "09:00" : dayStart.Trim();
            var end   = string.IsNullOrWhiteSpace(dayEnd)   ? "18:00" : dayEnd.Trim();

            foreach (var day in _dailySlotsByDay.Keys.ToList())
            {
                _dailySlotsByDay[day] = BuildDailySlots(start, end);
            }

            foreach (var day in _dayBounds.Keys.ToList())
            {
                _dayBounds[day] = (start, end);
            }

            if (!string.IsNullOrWhiteSpace(tzId))
                _businessTz = ResolveBusinessTimeZone(tzId);
        }

        /// <summary>
        /// Call at startup with the full per-day business hours from SystemSettings.
        /// </summary>
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
                    _dailySlotsByDay[day] = BuildDailySlots(s, e);
                    _dayBounds[day] = (s, e);
                }
            }
        }

        internal static List<string> GetDailySlots(string dayName)
        {
            return _dailySlotsByDay.TryGetValue(dayName, out var slots) ? slots : new List<string>();
        }

        internal static (string Start, string End) GetDayBounds(string dayName)
        {
            return _dayBounds.TryGetValue(dayName, out var bounds) ? bounds : ("09:00", "18:00");
        }

        // ── Time-zone ────────────────────────────────────────────────────────

        private static TimeZoneInfo ResolveBusinessTimeZone(string? tzId)
        {
            if (!string.IsNullOrWhiteSpace(tzId))
                try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); } catch { }
            try { return TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"); } catch { }
            return TimeZoneInfo.Utc;
        }

        // ── Slot-string helpers ──────────────────────────────────────────────

        private static List<string> BuildDailySlots(string from, string to)
        {
            var slots = new List<string>();
            if (!TimeSpan.TryParse(from, out var s) ||
                !TimeSpan.TryParse(to,   out var e) || e <= s) return slots;
            var cur = s;
            while (cur + TimeSpan.FromHours(1) <= e)
            {
                var next = cur + TimeSpan.FromHours(1);
                slots.Add($"{(int)cur.TotalHours:00}:{cur.Minutes:00}-{(int)next.TotalHours:00}:{next.Minutes:00}");
                cur = next;
            }
            return slots;
        }

        internal static bool TryParseTimeSlot(string slot, out TimeSpan start, out TimeSpan end)
        {
            start = default; end = default;
            var parts = slot.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2) return false;
            return TimeSpan.TryParse(parts[0], out start) && TimeSpan.TryParse(parts[1], out end);
        }

        internal static bool TryParseSlotStart(string slot, out TimeSpan slotStart)
        {
            slotStart = default;
            if (string.IsNullOrWhiteSpace(slot)) return false;
            var n = slot.Trim();
            if (n.Contains('-')) return TryParseTimeSlot(n, out slotStart, out _);
            return TimeSpan.TryParse(n, out slotStart);
        }

        private static bool TryGetBusinessDayBounds(string dayName, out int dayStartMinutes, out int dayEndMinutes)
        {
            var (start, end) = GetDayBounds(dayName);
            if (!TimeSpan.TryParse(start, out var shiftStart) || !TimeSpan.TryParse(end, out var shiftEnd))
            {
                dayStartMinutes = 0; dayEndMinutes = 0;
                return false;
            }
            dayStartMinutes = (int)shiftStart.TotalMinutes;
            dayEndMinutes = (int)shiftEnd.TotalMinutes;
            return dayEndMinutes > dayStartMinutes;
        }

        private static bool TryGetBusinessDayBounds(out int dayStartMinutes, out int dayEndMinutes)
        {
            var nowBusiness = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTz);
            var dayName = nowBusiness.DayOfWeek.ToString();
            return TryGetBusinessDayBounds(dayName, out dayStartMinutes, out dayEndMinutes);
        }

        private static string FormatSlotStart(TimeSpan start) =>
            $"{(int)start.TotalHours:00}:{start.Minutes:00}";

        // ── Candidate-slot generation ────────────────────────────────────────

        /// <summary>
        /// Returns start-time strings (e.g. "09:00") for every slot where a
        /// job of <paramref name="durationMinutes"/> would fit inside the business day.
        /// Slots are spaced by <see cref="SlotSelectionStepMinutes"/> (30 min).
        /// </summary>
        internal static List<string> BuildCandidateStartSlots(int durationMinutes)
        {
            var list = new List<string>();
            if (durationMinutes <= 0 || !TryGetBusinessDayBounds(out var ds, out var de))
                return list;
            for (var m = ds; m + durationMinutes <= de; m += SlotSelectionStepMinutes)
                list.Add(FormatSlotStart(TimeSpan.FromMinutes(m)));
            return list;
        }

        // ── Past-slot guard ──────────────────────────────────────────────────

        internal static bool IsSlotInPast(DateTime targetDateUtc, string startSlot)
        {
            if (!TryParseSlotStart(startSlot, out var s)) return true;
            var now    = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTz);
            var target = TimeZoneInfo.ConvertTimeFromUtc(targetDateUtc,  _businessTz).Date;
            if (target < now.Date) return true;
            if (target > now.Date) return false;
            return s <= now.TimeOfDay;
        }

        // ── Worker schedule helpers ──────────────────────────────────────────

        internal static bool WorkerWorksOnDay(string? workingDays, DayOfWeek day)
        {
            if (string.IsNullOrWhiteSpace(workingDays))
                return day is not DayOfWeek.Friday and not DayOfWeek.Saturday;
            var full   = day.ToString();
            var short3 = full[..3];
            return workingDays
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(d => d.Equals(full,   StringComparison.OrdinalIgnoreCase) ||
                          d.Equals(short3, StringComparison.OrdinalIgnoreCase));
        }

        internal static (string ShiftStart, string ShiftEnd) GetWorkerShiftForDay(
            Staff worker, DayOfWeek dow)
        {
            if (!string.IsNullOrWhiteSpace(worker.DaySchedulesJson))
            {
                try
                {
                    var entries = JsonSerializer.Deserialize<List<WorkerDayScheduleEntry>>(
                        worker.DaySchedulesJson, _jsonOpts);
                    var name = dow.ToString();
                    var entry = entries?.FirstOrDefault(x =>
                        x.Day.Equals(name, StringComparison.OrdinalIgnoreCase) ||
                        (name.Length >= 3 && x.Day.Equals(name[..3], StringComparison.OrdinalIgnoreCase)));
                    if (entry != null &&
                        !string.IsNullOrWhiteSpace(entry.ShiftStart) &&
                        !string.IsNullOrWhiteSpace(entry.ShiftEnd))
                        return (entry.ShiftStart, entry.ShiftEnd);
                }
                catch { /* fall through to default */ }
            }
            return (worker.ShiftStart ?? "09:00", worker.ShiftEnd ?? "18:00");
        }

        /// <summary>
        /// True when the current business-local time is inside the worker's configured
        /// working day + shift window.
        /// </summary>
        internal static bool IsWithinWorkerWorkingWindow(Staff worker, DateTime utcNow)
        {
            var nowBusiness = TimeZoneInfo.ConvertTimeFromUtc(utcNow, _businessTz);
            var dow = nowBusiness.DayOfWeek;

            if (!WorkerWorksOnDay(worker.WorkingDays, dow))
                return false;

            var (shiftStart, shiftEnd) = GetWorkerShiftForDay(worker, dow);
            if (!TimeSpan.TryParse(shiftStart, out var start) ||
                !TimeSpan.TryParse(shiftEnd, out var end))
                return false;

            var now = nowBusiness.TimeOfDay;
            if (end == start) return false;

            // Overnight shift (e.g. 22:00 -> 06:00)
            if (end < start)
                return now >= start || now < end;

            return now >= start && now < end;
        }

        // ── Shift-fit check ──────────────────────────────────────────────────

        internal static bool TimeSlotFitsInShift(
            string startSlot, int durationMinutes, string shiftStart, string shiftEnd,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryParseSlotStart(startSlot, out var ss)) return false;
            if (!TimeSpan.TryParse(shiftStart, out var shS) ||
                !TimeSpan.TryParse(shiftEnd,   out var shE)) return false;

            var slotS = ss.TotalMinutes;
            var slotE = slotS + durationMinutes;
            var shSm  = shS.TotalMinutes;
            var shEm  = shE.TotalMinutes;

            // Overnight shift
            if (shEm < shSm)
            {
                if (slotS >= shSm + workerTravelBuffer)
                    return slotE <= shEm + 1440;
                return slotS < shEm && slotE <= shEm;
            }

            return slotS >= shSm + workerTravelBuffer && slotE <= shEm;
        }

        // ── Booking-window helpers ───────────────────────────────────────────

        internal static bool TryBuildBookingWindow(
            string startSlot, int durationMinutes, out int startMin, out int endMin)
        {
            startMin = 0; endMin = 0;
            if (durationMinutes <= 0 || !TryParseSlotStart(startSlot, out var s)) return false;
            startMin = (int)s.TotalMinutes;
            endMin   = startMin + durationMinutes;
            return true;
        }

        // ── Duration resolution ──────────────────────────────────────────────

        /// <summary>Resolve job duration from a <see cref="Booking"/> record.</summary>
        internal static int ResolveBookingDuration(Booking b)
        {
            if (TryParseTimeSlot(b.TimeSlot, out var rs, out var re))
            {
                var d = (int)Math.Round((re - rs).TotalMinutes);
                if (d > 0) return d;
            }
            var fromItems = b.BookingItems?.Sum(bi =>
                bi.SnapshotDurationMinutes > 0
                    ? bi.SnapshotDurationMinutes
                    : bi.Package.EstimatedDurationMinutes) ?? 0;
            return fromItems > 0 ? fromItems : 60;
        }

        /// <summary>
        /// Resolve duration from a raw time-slot string.
        /// Handles range format "HH:MM-HH:MM" used by subscription bookings.
        /// </summary>
        internal static int ResolveSlotDuration(string timeSlot, int fallbackMinutes = 60)
        {
            if (TryParseTimeSlot(timeSlot, out var s, out var e))
            {
                var d = (int)Math.Round((e - s).TotalMinutes);
                if (d > 0) return d;
            }
            return fallbackMinutes;
        }

        // ── Conflict checks ──────────────────────────────────────────────────

        /// <summary>
        /// Returns true if booking at <paramref name="reqSlot"/>/<paramref name="reqDuration"/>
        /// conflicts with any of the worker's existing <see cref="Booking"/> records
        /// (including <paramref name="workerTravelBuffer"/>-min travel buffer).
        /// </summary>
        internal static bool HasWorkerConflict(
            IEnumerable<Booking> workerBookings, string reqSlot, int reqDuration,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryBuildBookingWindow(reqSlot, reqDuration, out var reqS, out var reqE))
                return true;

            foreach (var b in workerBookings)
            {
                var dur = ResolveBookingDuration(b);
                if (!TryBuildBookingWindow(b.TimeSlot, dur, out var existS, out var existE))
                    continue;
                var gapBefore = reqE  + workerTravelBuffer <= existS;
                var gapAfter  = reqS  >= existE + workerTravelBuffer;
                if (!gapBefore && !gapAfter) return true;
            }
            return false;
        }

        /// <summary>
        /// Returns true if a new slot at <paramref name="reqSlot"/>/<paramref name="reqDuration"/>
        /// conflicts with an existing raw slot string (e.g. from a SubscriptionBooking that has no
        /// BookingItems — duration is extracted from the slot range or falls back to 60 min).
        /// </summary>
        internal static bool HasRawSlotConflict(
            string existingSlot, int existingDuration,
            string reqSlot,      int reqDuration,
            int workerTravelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryBuildBookingWindow(existingSlot, existingDuration, out var existS, out var existE))
                return false;
            if (!TryBuildBookingWindow(reqSlot, reqDuration, out var reqS, out var reqE))
                return false;
            var gapBefore = reqE  + workerTravelBuffer <= existS;
            var gapAfter  = reqS  >= existE + workerTravelBuffer;
            return !gapBefore && !gapAfter;
        }
    }
}
