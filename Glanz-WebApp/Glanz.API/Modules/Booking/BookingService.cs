using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Platform.AuditEvents;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;
using StaffEntity = Glanz.API.Models.Staff;

namespace Glanz.API.Modules.Booking
{
    public class BookingService : IBookingService
    {
        // ---- Constants & static config -----------------------------------------------

        public const int SlotSelectionStepMinutes = 30;
        public const int DefaultMaxBookingsPerSlot = 3;
        public const int DefaultWorkerTravelBufferMinutes = 30;
        private const string AutoAssignSettingKey = "bookings.autoAssignEnabled";

        private static TimeZoneInfo _businessTimeZone = ResolveBusinessTimeZone(null);

        private static readonly Dictionary<string, List<string>> DefaultDailySlotsByDay = new()
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

        private static Dictionary<string, List<string>> _dailySlotsByDay = new(DefaultDailySlotsByDay);
        private static Dictionary<string, (string Start, string End)> _dayBounds = new(DefaultDayBounds);

        // ---- Dependencies ------------------------------------------------------------

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
        private readonly IDomainEventService _domainEvents;
        private readonly TenantContext _tenantContext;
        private readonly ILogger<BookingService> _logger;
        private readonly IInvoiceService _invoiceService;
        private readonly IEmailService _emailService;

        public BookingService(
            AppDbContext context,
            IConfiguration configuration,
            IAdminNotificationService adminNotificationService,
            IPricingService pricingService,
            IAuditService audit,
            CouponRateLimiter couponLimiter,
            IWebHostEnvironment env,
            IObjectStorageService objectStorage,
            IReferralService referralService,
            ILocalizationTextResolver localizationTextResolver,
            IDomainEventService domainEvents,
            TenantContext tenantContext,
            ILogger<BookingService> logger,
            IInvoiceService invoiceService,
            IEmailService emailService)
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
            _domainEvents = domainEvents;
            _tenantContext = tenantContext;
            _logger = logger;
            _invoiceService = invoiceService;
            _emailService = emailService;
        }

        // ---- Static config helpers (called by Program.cs) ----------------------------

        public static void ApplyConfiguredTimeZone(string? tzId)
        {
            if (!string.IsNullOrWhiteSpace(tzId))
                _businessTimeZone = ResolveBusinessTimeZone(tzId);
        }

        public static void ApplyConfiguredBusinessHours(string? dayStart, string? dayEnd)
        {
            var s = string.IsNullOrWhiteSpace(dayStart) ? "09:00" : dayStart.Trim();
            var e = string.IsNullOrWhiteSpace(dayEnd) ? "18:00" : dayEnd.Trim();
            foreach (var day in _dailySlotsByDay.Keys.ToList())
                _dailySlotsByDay[day] = BuildDailyTimeSlots(s, e);
            foreach (var day in _dayBounds.Keys.ToList())
                _dayBounds[day] = (s, e);
        }

        public static void SetBusinessHoursFromSettings(BusinessHoursPerDayDto? hours)
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
                    _dailySlotsByDay[day] = BuildDailyTimeSlots(parts[0].Trim(), parts[1].Trim());
                    _dayBounds[day] = (parts[0].Trim(), parts[1].Trim());
                }
            }
        }

        // ---- Static time-slot helpers ------------------------------------------------

        public static List<string> BuildDailyTimeSlots(string dayStart, string dayEnd)
        {
            if (!TimeSpan.TryParse(dayStart, out var start) || !TimeSpan.TryParse(dayEnd, out var end) || end <= start)
                return new List<string>();

            var slots = new List<string>();
            var current = start;
            var step = TimeSpan.FromHours(1);
            while (current + step <= end)
            {
                var next = current + step;
                slots.Add($"{(int)current.TotalHours:00}:{current.Minutes:00}-{(int)next.TotalHours:00}:{next.Minutes:00}");
                current = next;
            }
            return slots;
        }

        public static List<string> GetDailyTimeSlots(string dayName) =>
            _dailySlotsByDay.TryGetValue(dayName, out var slots) ? slots : new List<string>();

        public static (string Start, string End) GetDayBounds(string dayName) =>
            _dayBounds.TryGetValue(dayName, out var b) ? b : ("09:00", "18:00");

        public static bool TryParseTimeSlot(string slot, out TimeSpan start, out TimeSpan end)
        {
            start = default; end = default;
            var parts = slot.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            return parts.Length == 2
                && TimeSpan.TryParse(parts[0], out start)
                && TimeSpan.TryParse(parts[1], out end);
        }

        public static bool TryParseSlotStart(string slot, out TimeSpan slotStart)
        {
            slotStart = default;
            if (string.IsNullOrWhiteSpace(slot)) return false;
            var normalized = slot.Trim();
            if (normalized.Contains('-'))
                return TryParseTimeSlot(normalized, out slotStart, out _);
            return TimeSpan.TryParse(normalized, out slotStart);
        }

        public static bool TryBuildBookingWindowMinutes(string startSlot, int durationMinutes, out int startMinutes, out int endMinutes)
        {
            startMinutes = 0; endMinutes = 0;
            if (durationMinutes <= 0 || !TryParseSlotStart(startSlot, out var slotStart)) return false;
            startMinutes = (int)slotStart.TotalMinutes;
            endMinutes = startMinutes + durationMinutes;
            return true;
        }

        public static bool TryGetBusinessDayBounds(string dayName, out int dayStartMinutes, out int dayEndMinutes)
        {
            var (start, end) = GetDayBounds(dayName);
            if (!TimeSpan.TryParse(start, out var ss) || !TimeSpan.TryParse(end, out var se))
            {
                dayStartMinutes = 0; dayEndMinutes = 0;
                return false;
            }
            dayStartMinutes = (int)ss.TotalMinutes;
            dayEndMinutes = (int)se.TotalMinutes;
            return dayEndMinutes > dayStartMinutes;
        }

        public static bool TryGetBusinessDayBounds(out int dayStartMinutes, out int dayEndMinutes)
        {
            var nowBiz = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTimeZone);
            return TryGetBusinessDayBounds(nowBiz.DayOfWeek.ToString(), out dayStartMinutes, out dayEndMinutes);
        }

        public static bool TryParseShiftWindowMinutes(string shiftStart, string shiftEnd, out int startMin, out int endMin)
        {
            startMin = 0; endMin = 0;
            if (!TimeSpan.TryParse(shiftStart, out var s) || !TimeSpan.TryParse(shiftEnd, out var e)) return false;
            startMin = (int)s.TotalMinutes;
            endMin = (int)e.TotalMinutes;
            return endMin > startMin;
        }

        public static int ResolveBookingDurationMinutes(Models.Booking booking)
        {
            if (TryParseTimeSlot(booking.TimeSlot, out var rangeStart, out var rangeEnd))
            {
                var fromRange = (int)Math.Round((rangeEnd - rangeStart).TotalMinutes);
                if (fromRange > 0) return fromRange;
            }
            var fromItems = booking.BookingItems?.Sum(bi =>
                bi.SnapshotDurationMinutes > 0 ? bi.SnapshotDurationMinutes : bi.Package.EstimatedDurationMinutes) ?? 0;
            return fromItems > 0 ? fromItems : 60;
        }

        public static bool IsSlotInPastForBusinessDay(DateTime targetDateUtc, string startSlot)
        {
            if (!TryParseSlotStart(startSlot, out var slotStart)) return true;
            var nowBiz = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTimeZone);
            var targetBizDate = TimeZoneInfo.ConvertTimeFromUtc(targetDateUtc, _businessTimeZone).Date;
            if (targetBizDate < nowBiz.Date) return true;
            if (targetBizDate > nowBiz.Date) return false;
            return slotStart <= nowBiz.TimeOfDay;
        }

        public static DateTime NormalizeUtcDate(DateTime value)
        {
            var bizDate = value.Kind switch
            {
                DateTimeKind.Utc => TimeZoneInfo.ConvertTimeFromUtc(value, _businessTimeZone).Date,
                DateTimeKind.Local => TimeZoneInfo.ConvertTime(value, _businessTimeZone).Date,
                _ => value.Date
            };
            return DateTime.SpecifyKind(bizDate, DateTimeKind.Utc);
        }

        public static string FormatTimeSlotStart(TimeSpan start) =>
            $"{(int)start.TotalHours:00}:{start.Minutes:00}";

        public static List<string> BuildCandidateStartSlots(int durationMinutes, string? dayName = null)
        {
            var candidates = new List<string>();
            int dayStartMin, dayEndMin;
            if (dayName != null)
            {
                if (!TryGetBusinessDayBounds(dayName, out dayStartMin, out dayEndMin)) return candidates;
            }
            else
            {
                if (!TryGetBusinessDayBounds(out dayStartMin, out dayEndMin)) return candidates;
            }
            for (var m = dayStartMin; m + durationMinutes <= dayEndMin; m += SlotSelectionStepMinutes)
                candidates.Add(FormatTimeSlotStart(TimeSpan.FromMinutes(m)));
            return candidates;
        }

        public static List<string>? BuildRequiredTimeSlots(string selectedTimeSlot, int totalDurationMinutes, out string? error, string? businessDayName = null)
        {
            error = null;
            var dayName = string.IsNullOrWhiteSpace(businessDayName)
                ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTimeZone).DayOfWeek.ToString()
                : businessDayName.Trim();

            if (totalDurationMinutes <= 0) { error = "Total duration must be greater than zero."; return null; }
            if (!TryGetBusinessDayBounds(dayName, out var dayStartMin, out var dayEndMin)
                || !TryParseSlotStart(selectedTimeSlot, out var requestedStart))
            {
                error = "Selected time slot is invalid."; return null;
            }

            var reqStartMin = (int)requestedStart.TotalMinutes;
            var reqEndMin = reqStartMin + totalDurationMinutes;

            if (reqStartMin < dayStartMin || reqStartMin >= dayEndMin) { error = "Selected time slot is invalid."; return null; }
            if (reqEndMin > dayEndMin) { error = "Selected time slot does not have enough remaining time for this service duration."; return null; }

            var required = new List<string>();
            foreach (var slot in GetDailyTimeSlots(dayName))
            {
                if (!TryParseTimeSlot(slot, out var ss, out var se)) continue;
                var ssMin = (int)ss.TotalMinutes;
                var seMin = (int)se.TotalMinutes;
                if (reqStartMin < seMin && ssMin < reqEndMin) required.Add(slot);
            }

            if (required.Count == 0) { error = "Selected time slot is invalid."; return null; }
            return required;
        }

        public static bool WorkerWorksOnDay(string? workingDays, DayOfWeek targetDay)
        {
            if (string.IsNullOrWhiteSpace(workingDays)) return false;
            return workingDays.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Any(d => Enum.TryParse<DayOfWeek>(d.Trim(), true, out var dow) && dow == targetDay);
        }

        public static (string ShiftStart, string ShiftEnd) GetWorkerShiftForDay(StaffEntity worker, DayOfWeek day)
        {
            return (worker.ShiftStart, worker.ShiftEnd);
        }

        public static bool TimeSlotInWorkerShift(string timeSlot, int durationMinutes, string shiftStart, string shiftEnd, int travelBuffer)
        {
            if (!TryParseSlotStart(timeSlot, out var slotStart)) return false;
            if (!TimeSpan.TryParse(shiftStart, out var ss) || !TimeSpan.TryParse(shiftEnd, out var se)) return false;
            var jobStartMin = (int)slotStart.TotalMinutes;
            var jobEndMin = jobStartMin + durationMinutes;
            var shiftStartMin = (int)ss.TotalMinutes;
            var shiftEndMin = (int)se.TotalMinutes;
            return jobStartMin >= shiftStartMin + travelBuffer && jobEndMin <= shiftEndMin;
        }

        public static bool HasWorkerTimeConflict(IEnumerable<Models.Booking> workerBookings, string requestedSlot, int requestedDuration,
            int travelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            if (!TryBuildBookingWindowMinutes(requestedSlot, requestedDuration, out var reqStart, out var reqEnd)) return true;
            foreach (var b in workerBookings)
            {
                var dur = ResolveBookingDurationMinutes(b);
                if (!TryBuildBookingWindowMinutes(b.TimeSlot, dur, out var exStart, out var exEnd)) continue;
                var gapBefore = reqEnd + travelBuffer <= exStart;
                var gapAfter = reqStart >= exEnd + travelBuffer;
                if (!gapBefore && !gapAfter) return true;
            }
            return false;
        }

        public static bool HasBookingTimeOverlap(IEnumerable<Models.Booking> bookings, string requestedSlot, int requestedDuration)
        {
            if (!TryBuildBookingWindowMinutes(requestedSlot, requestedDuration, out var reqStart, out var reqEnd)) return true;
            foreach (var b in bookings)
            {
                var dur = ResolveBookingDurationMinutes(b);
                if (!TryBuildBookingWindowMinutes(b.TimeSlot, dur, out var exStart, out var exEnd)) continue;
                if (reqStart < exEnd && exStart < reqEnd) return true;
            }
            return false;
        }

        public static int ComputeStartCapacity(int windowMinutes, int minimumJobDurationMinutes)
        {
            if (windowMinutes < minimumJobDurationMinutes) return 0;
            return ((windowMinutes - minimumJobDurationMinutes) / SlotSelectionStepMinutes) + 1;
        }

        public static void CalculateWorkerFreeCapacity(
            IEnumerable<Models.Booking> workerBookings,
            int shiftStartMin, int shiftEndMin, int minJobDuration,
            out int usableFreeMinutes, out int availableStartCount,
            int travelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            usableFreeMinutes = 0; availableStartCount = 0;
            var blocked = new List<(int S, int E)>();
            foreach (var b in workerBookings)
            {
                var dur = ResolveBookingDurationMinutes(b);
                if (!TryBuildBookingWindowMinutes(b.TimeSlot, dur, out var bs, out var be)) continue;
                var bS = Math.Max(shiftStartMin, bs - travelBuffer);
                var bE = Math.Min(shiftEndMin, be + travelBuffer);
                if (bE > bS) blocked.Add((bS, bE));
            }

            if (blocked.Count == 0)
            {
                var w = shiftEndMin - (shiftStartMin + travelBuffer);
                if (w > 0) { usableFreeMinutes = w; availableStartCount = ComputeStartCapacity(w, minJobDuration); }
                return;
            }

            var merged = new List<(int S, int E)>();
            foreach (var interval in blocked.OrderBy(i => i.S))
            {
                if (merged.Count == 0) { merged.Add(interval); continue; }
                var last = merged[^1];
                merged[^1] = interval.S <= last.E ? (last.S, Math.Max(last.E, interval.E)) : (last.S, last.E);
                if (interval.S > last.E) merged.Add(interval);
            }

            var cursor = shiftStartMin + travelBuffer;
            foreach (var (mS, mE) in merged)
            {
                if (mS > cursor)
                {
                    var w = mS - cursor;
                    if (w >= minJobDuration) { usableFreeMinutes += w; availableStartCount += ComputeStartCapacity(w, minJobDuration); }
                }
                cursor = Math.Max(cursor, mE);
            }
            if (cursor < shiftEndMin)
            {
                var w = shiftEndMin - cursor;
                if (w >= minJobDuration) { usableFreeMinutes += w; availableStartCount += ComputeStartCapacity(w, minJobDuration); }
            }
        }

        public static Dictionary<int, decimal> BuildProductUsageMap(Models.Booking booking)
        {
            var map = new Dictionary<int, decimal>();
            foreach (var item in booking.BookingItems)
            {
                var qty = Math.Max(1, item.Quantity);
                foreach (var ps in item.Package?.PackageServices ?? new List<PackageService>())
                    foreach (var sp in ps.Service?.ServiceProducts ?? new List<ServiceProduct>())
                    {
                        if (sp.ProductId <= 0 || sp.QuantityUsed <= 0) continue;
                        map.TryGetValue(sp.ProductId, out var cur);
                        map[sp.ProductId] = cur + sp.QuantityUsed * qty;
                    }
            }
            return map;
        }

        public static int ToStockUnits(decimal qty) => qty <= 0 ? 0 : (int)Math.Ceiling(qty);

        public static List<BookingChecklistItem> BuildChecklistItems(
            IEnumerable<BookingPackageDto> selected, IReadOnlyDictionary<int, Package> packages)
        {
            var items = new List<BookingChecklistItem>();
            var order = 1;
            foreach (var sel in selected)
            {
                if (!packages.TryGetValue(sel.PackageId, out var pkg)) continue;
                var serviceNames = pkg.PackageServices
                    .Select(ps => ps.Service.Name)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(n => n)
                    .ToList();
                if (serviceNames.Count == 0)
                {
                    items.Add(new BookingChecklistItem
                    {
                        Label = sel.Quantity > 1 ? $"{pkg.Name} x{sel.Quantity}: Complete package" : $"{pkg.Name}: Complete package",
                        DisplayOrder = order++
                    });
                    continue;
                }
                foreach (var sn in serviceNames)
                    items.Add(new BookingChecklistItem { Label = $"{pkg.Name}: {sn}", DisplayOrder = order++ });
            }
            return items;
        }

        public static List<BookingChecklistItemDto> MapChecklistItems(IEnumerable<BookingChecklistItem> items) =>
            items.OrderBy(ci => ci.DisplayOrder).Select(ci => new BookingChecklistItemDto
            {
                Id = ci.Id, Label = ci.Label, DisplayOrder = ci.DisplayOrder,
                IsCompleted = ci.IsCompleted, CompletedAt = ci.CompletedAt
            }).ToList();

        public static BookingDto MapBookingToDto(
            Models.Booking booking, int durationMinutes,
            IReadOnlyDictionary<int, (string? Name, string? Description)> packageTextMap)
        {
            return new BookingDto
            {
                Id = booking.Id,
                BookingNumber = booking.BookingNumber,
                ScheduledDate = booking.ScheduledDate,
                TimeSlot = booking.TimeSlot,
                EstimatedDurationMinutes = durationMinutes,
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
                AssignedWorkerName = booking.AssignedWorker == null
                    ? null
                    : $"{booking.AssignedWorker.FirstName} {booking.AssignedWorker.LastName}".Trim(),
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
                ChecklistItems = MapChecklistItems(booking.ChecklistItems ?? new List<BookingChecklistItem>()),
                TipAmount = booking.TipAmount,
                FlaggedKeywords = DetectFlaggedKeywords(booking.SpecialInstructions),
                Items = (booking.BookingItems ?? new List<BookingItem>()).Select(bi => new BookingItemDetailDto
                {
                    PackageId = bi.PackageId,
                    PackageName = packageTextMap.TryGetValue(bi.PackageId, out var t) && t.Name != null
                        ? t.Name
                        : bi.Package?.Name ?? "",
                    PackageTier = bi.Package?.Tier ?? "",
                    Price = bi.Price,
                    Quantity = bi.Quantity,
                    Subtotal = bi.Price * bi.Quantity,
                    ItemCost = bi.ItemCost,
                    ItemProfit = (bi.Price * bi.Quantity) - bi.ItemCost
                }).ToList(),
                AddOns = (booking.BookingAddOns ?? new List<BookingAddOn>()).Select(a => new BookingAddOnDto
                {
                    AddOnId = a.AddOnId,
                    Name = a.Name,
                    Price = a.Price
                }).ToList()
            };
        }

        private static readonly string[] _flagKeywords =
        {
            "paint correction", "ceramic", "pet hair", "scratch", "dent",
            "deep clean", "odor", "oxidation", "swirl", "clay bar", "polish"
        };

        private static string[] DetectFlaggedKeywords(string? instructions)
        {
            if (string.IsNullOrWhiteSpace(instructions)) return Array.Empty<string>();
            var lower = instructions.ToLowerInvariant();
            return _flagKeywords.Where(k => lower.Contains(k)).ToArray();
        }

        private static string NormalizeAddressType(string? addressType) =>
            addressType?.Trim().ToLowerInvariant() switch
            {
                "work" => "Work", "other" => "Other", _ => "Home"
            };

        private static string? GetAddressByType(User user, string addressType) =>
            addressType switch { "Work" => user.WorkAddress, "Other" => user.OtherAddress, _ => user.HomeAddress };

        private static TimeZoneInfo ResolveBusinessTimeZone(string? tzId)
        {
            if (!string.IsNullOrWhiteSpace(tzId))
                try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); } catch { }
            try { return TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"); } catch { }
            return TimeZoneInfo.Utc;
        }

        // ---- Async business helpers --------------------------------------------------

        public async Task<int> GetMinimumJobDurationMinutesAsync()
        {
            var min = await _context.Packages
                .AsNoTracking()
                .Where(p => p.IsActive && p.EstimatedDurationMinutes > 0)
                .Select(p => (int?)p.EstimatedDurationMinutes)
                .MinAsync();
            return Math.Max(30, min ?? 60);
        }

        public async Task<int> GetWorkerTravelBufferMinutesAsync()
        {
            var setting = await _context.Set<SystemSetting>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "bookings.workerTravelBufferMinutes");
            return setting != null && int.TryParse(setting.Value, out var v) && v >= 0 ? v : DefaultWorkerTravelBufferMinutes;
        }

        public async Task<bool> IsAutoAssignEnabledAsync()
        {
            var setting = await _context.Set<SystemSetting>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == AutoAssignSettingKey);
            return setting?.Value?.Trim().ToLowerInvariant() == "true";
        }

        public async Task SetAutoAssignEnabledAsync(bool enabled)
        {
            var setting = await _context.Set<SystemSetting>().FirstOrDefaultAsync(s => s.Key == AutoAssignSettingKey);
            if (setting == null)
                _context.Set<SystemSetting>().Add(new SystemSetting { Key = AutoAssignSettingKey, Value = enabled ? "true" : "false" });
            else
                setting.Value = enabled ? "true" : "false";
            await _context.SaveChangesAsync();
        }

        public async Task<bool> IsFeatureFlagEnabledAsync(string flagName)
        {
            var setting = await _context.Set<SystemSetting>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == $"feature.{flagName}");
            return setting?.Value?.Trim().ToLowerInvariant() == "true";
        }

        public async Task<bool> HasCustomerOverlapBookingAsync(int? userId, string? customerEmail, DateTime scheduledDate, string startSlot, int totalDuration)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var normalizedEmail = string.IsNullOrWhiteSpace(customerEmail) ? null : customerEmail.Trim().ToLowerInvariant();
            var dayEnd = bookingDate.AddDays(1);
            var existing = await _context.Bookings
                .Where(b => b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed
                    && ((userId.HasValue && (b.UserId == userId.Value || (!string.IsNullOrWhiteSpace(normalizedEmail) && b.CustomerEmail.ToLower() == normalizedEmail)))
                        || (!userId.HasValue && !string.IsNullOrWhiteSpace(normalizedEmail) && b.CustomerEmail.ToLower() == normalizedEmail))
                )
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            return HasBookingTimeOverlap(existing, startSlot, totalDuration);
        }

        public async Task<StaffEntity?> FindAutoAssignableWorkerAsync(DateTime scheduledDate, string startSlot, int totalDuration, int travelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var bookingDay = bookingDate.DayOfWeek;
            var workers = await _context.Staff.Where(s => s.IsActive && s.VanRole != "Helper").ToListAsync();
            var eligible = workers
                .Where(w => WorkerWorksOnDay(w.WorkingDays, bookingDay))
                .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, bookingDay); return TimeSlotInWorkerShift(startSlot, totalDuration, ss, se, travelBuffer); })
                .ToList();
            if (eligible.Count == 0) return null;
            var dayEnd = bookingDate.AddDays(1);
            var eligibleIds = eligible.Select(w => w.Id).ToList();
            var sameDayBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue && eligibleIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            var bookingCount = new Dictionary<int, int>();
            var byWorker = sameDayBookings.Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
            return eligible
                .Where(w => !HasWorkerTimeConflict(byWorker.TryGetValue(w.Id, out var wb) ? wb : new List<Models.Booking>(), startSlot, totalDuration, travelBuffer))
                .OrderBy(w => byWorker.TryGetValue(w.Id, out var wb) ? wb.Count : 0)
                .ThenBy(w => w.Id)
                .FirstOrDefault();
        }

        public async Task<bool> HasManualPoolCapacityAsync(DateTime scheduledDate, string startSlot, int totalDuration, int travelBuffer = DefaultWorkerTravelBufferMinutes)
        {
            var bookingDate = NormalizeUtcDate(scheduledDate);
            var day = bookingDate.DayOfWeek;
            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive && s.VanRole != "Helper").ToListAsync();
            var eligible = workers
                .Where(w => WorkerWorksOnDay(w.WorkingDays, day))
                .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, day); return TimeSlotInWorkerShift(startSlot, totalDuration, ss, se, travelBuffer); })
                .ToList();
            if (eligible.Count == 0) return false;
            var wIds = eligible.Select(w => w.Id).ToList();
            var dayEnd = bookingDate.AddDays(1);
            var same = await _context.Bookings.AsNoTracking()
                .Where(b => b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed
                    && (!b.AssignedWorkerId.HasValue || wIds.Contains(b.AssignedWorkerId.Value)))
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            var overlapping = same.Where(b => HasBookingTimeOverlap(new[] { b }, startSlot, totalDuration)).ToList();
            var busyIds = overlapping.Where(b => b.AssignedWorkerId.HasValue).Select(b => b.AssignedWorkerId!.Value).Distinct().ToHashSet();
            var unassigned = overlapping.Count(b => !b.AssignedWorkerId.HasValue);
            return eligible.Count(w => !busyIds.Contains(w.Id)) > unassigned;
        }

        public async Task<int> CountValidSlotsForDayAsync(DateTime targetDateUtc, int durationMinutes, int travelBuffer)
        {
            var date = NormalizeUtcDate(targetDateUtc);
            var dayName = TimeZoneInfo.ConvertTimeFromUtc(date, _businessTimeZone).DayOfWeek.ToString();
            var candidates = BuildCandidateStartSlots(durationMinutes, dayName);
            if (candidates.Count == 0) return 0;
            var dayEnd = date.AddDays(1);
            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive && s.VanRole != "Helper").ToListAsync();
            var wIds = workers.Select(w => w.Id).ToList();
            var dayBookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.ScheduledDate >= date && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            var byWorker = dayBookings.Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
            int validCount = 0;
            foreach (var slot in candidates)
            {
                var eligible = workers.Where(w => WorkerWorksOnDay(w.WorkingDays, date.DayOfWeek))
                    .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, date.DayOfWeek); return TimeSlotInWorkerShift(slot, durationMinutes, ss, se, travelBuffer); })
                    .Any(w => !HasWorkerTimeConflict(byWorker.TryGetValue(w.Id, out var wb) ? wb : new List<Models.Booking>(), slot, durationMinutes, travelBuffer));
                if (eligible) validCount++;
            }
            return validCount;
        }

        private async Task<User?> ResolveBookingUserByEmailAsync(string customerEmail)
        {
            var normalized = customerEmail.Trim().ToLowerInvariant();
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email.ToLower() == normalized);
        }

        private async Task<(UserSubscription? Subscription, string? Error)> ResolveApplicableSubscriptionAsync(int? userId, int? subId, VehicleType vehicleType)
        {
            if (!userId.HasValue || !subId.HasValue) return (null, null);
            var sub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.Id == subId.Value && s.UserId == userId.Value);
            if (sub == null) return (null, "Subscription not found.");
            if (sub.Status != UserSubscriptionStatus.Active) return (null, "Subscription is not active.");
            return (sub, null);
        }

        private sealed class AppliedOfferResult
        {
            public Offer Offer { get; set; } = null!;
            public UserOffer? UserOffer { get; set; }
            public string AppliedCode { get; set; } = string.Empty;
        }

        private async Task<(AppliedOfferResult? Result, string? Error)> ResolveOfferAsync(string? offerCode, int? userId, decimal subtotal)
        {
            if (string.IsNullOrWhiteSpace(offerCode)) return (null, null);
            var normalized = offerCode.Trim().ToUpperInvariant();
            var now = DateTime.UtcNow;
            UserOffer? userOffer = null;
            if (userId.HasValue)
                userOffer = await _context.UserOffers.Include(uo => uo.Offer).Include(uo => uo.User)
                    .FirstOrDefaultAsync(uo => uo.PersonalCode == normalized && uo.UserId == userId.Value && !uo.IsRedeemed);
            var offer = userOffer?.Offer;
            if (offer == null)
                offer = await _context.Offers.FirstOrDefaultAsync(o => o.Code == normalized && !o.IsLoyaltyProgram && o.IsActive);
            if (offer == null || !offer.IsActive
                || (offer.StartsAt.HasValue && offer.StartsAt.Value > now)
                || (offer.EndsAt.HasValue && offer.EndsAt.Value < now)
                || (userOffer != null && userOffer.ExpiresAt.HasValue && userOffer.ExpiresAt.Value < now))
                return (null, "Offer code is not valid.");
            if (offer.MinBookingAmount > subtotal)
                return (null, $"Offer requires a minimum booking amount of {offer.MinBookingAmount:F2} QAR.");
            if (userOffer != null && userOffer.Offer.IsLoyaltyProgram
                && (!userOffer.User.LoyaltyGoogleReviewActivatedAt.HasValue
                    || userOffer.AssignedAt < userOffer.User.LoyaltyGoogleReviewActivatedAt.Value))
                return (null, "Complete the one-time Google review unlock before using loyalty rewards.");
            if (offer.MaxUsesPerUser.HasValue && userId.HasValue)
            {
                var uses = await _context.Bookings.CountAsync(b =>
                    b.UserId == userId.Value && b.AppliedOfferCode == normalized && b.Status != BookingStatus.Cancelled);
                if (uses >= offer.MaxUsesPerUser.Value) return (null, "Offer usage limit reached for this user.");
            }
            return (new AppliedOfferResult { Offer = offer, UserOffer = userOffer, AppliedCode = normalized }, null);
        }

        private static decimal CalculateDiscountAmount(Offer offer, decimal subtotal)
        {
            if (subtotal <= 0) return 0;
            return offer.DiscountType switch
            {
                DiscountType.Percentage => Math.Round(subtotal * (offer.DiscountValue / 100m), 2),
                DiscountType.FixedAmount => Math.Round(Math.Min(offer.DiscountValue, subtotal), 2),
                DiscountType.FreeBooking => Math.Round(subtotal, 2),
                _ => 0
            };
        }

        public async Task IssueLoyaltyCouponsAsync(int userId)
        {
            var activationAt = await _context.Users.Where(u => u.Id == userId).Select(u => u.LoyaltyGoogleReviewActivatedAt).FirstOrDefaultAsync();
            if (!activationAt.HasValue) return;
            var completedCount = await _context.Bookings.CountAsync(b =>
                b.UserId == userId && b.Status == BookingStatus.Completed && b.TotalAmount > 0
                && b.WorkCompletedAt.HasValue && b.WorkCompletedAt.Value >= activationAt.Value);
            if (completedCount <= 0) return;
            var offers = await _context.Offers.Where(o => o.IsActive && o.IsLoyaltyProgram && o.TriggerCompletedBookings.HasValue && o.TriggerCompletedBookings.Value > 0).ToListAsync();
            if (offers.Count == 0) return;
            var earned = new List<(Offer Offer, string Code)>();
            foreach (var offer in offers)
            {
                var trigger = offer.TriggerCompletedBookings!.Value;
                if (completedCount % trigger != 0) continue;
                var exists = await _context.UserOffers.AnyAsync(uo => uo.UserId == userId && uo.OfferId == offer.Id && uo.EarnedAtCompletedBookingsCount == completedCount);
                if (exists) continue;
                var prefix = string.IsNullOrWhiteSpace(offer.Code) ? "LOYAL" : offer.Code.Trim().ToUpperInvariant();
                var code = $"{prefix}-U{userId}-{completedCount}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
                _context.UserOffers.Add(new UserOffer
                {
                    UserId = userId, OfferId = offer.Id, PersonalCode = code,
                    EarnedAtCompletedBookingsCount = completedCount, AssignedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)), IsRedeemed = false
                });
                earned.Add((offer, code));
            }
            if (earned.Count == 0) return;
            await _context.SaveChangesAsync();
            foreach (var (offer, code) in earned)
                await _adminNotificationService.NotifyLoyaltyCouponEarnedAsync(userId, offer, code);
        }

        private async Task<IReadOnlyDictionary<int, (string? Name, string? Description)>> GetPackageTextMapAsync(string lang, CancellationToken ct)
        {
            var raw = await _localizationTextResolver.GetPackageTextsAsync(lang, ct);
            return raw.ToDictionary(kvp => kvp.Key, kvp => (kvp.Value.Name, kvp.Value.Description));
        }

        // ---- IBookingService: constraints -------------------------------------------

        public async Task<BookingConstraintsDto> GetConstraintsAsync()
        {
            var minDuration = await GetMinimumJobDurationMinutesAsync();
            var buffer = await GetWorkerTravelBufferMinutesAsync();
            TryGetBusinessDayBounds(out var startMin, out var endMin);
            var startTs = TimeSpan.FromMinutes(startMin);
            var endTs = TimeSpan.FromMinutes(endMin);
            return new BookingConstraintsDto
            {
                MinimumJobDurationMinutes = minDuration,
                SlotStepMinutes = SlotSelectionStepMinutes,
                WorkerTravelBufferMinutes = buffer,
                BusinessHoursStart = $"{(int)startTs.TotalHours:00}:{startTs.Minutes:00}",
                BusinessHoursEnd = $"{(int)endTs.TotalHours:00}:{endTs.Minutes:00}",
            };
        }

        // ---- IBookingService: assignment mode ---------------------------------------

        public async Task<AssignmentModeDto> GetAssignmentModeAsync()
        {
            var enabled = await IsAutoAssignEnabledAsync();
            return new AssignmentModeDto { AutoAssignEnabled = enabled };
        }

        public async Task UpdateAssignmentModeAsync(bool enabled) => await SetAutoAssignEnabledAsync(enabled);

        // ---- IBookingService: CreateBooking -----------------------------------------

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> CreateBookingAsync(
            CreateBookingDto dto, int? userId, string lang, CancellationToken ct = default)
        {
            try
            {
                var packageTextMap = await GetPackageTextMapAsync(lang, ct);

                var normalizedKey = string.IsNullOrWhiteSpace(dto.IdempotencyKey) ? null : dto.IdempotencyKey.Trim();
                if (normalizedKey != null)
                {
                    var existing = await _context.Bookings.AsNoTracking()
                        .Where(b => b.IdempotencyKey == normalizedKey && b.CustomerEmail.ToLower() == dto.CustomerEmail.Trim().ToLowerInvariant())
                        .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                        .Include(b => b.ChecklistItems)
                        .Include(b => b.AssignedWorker)
                        .FirstOrDefaultAsync(ct);
                    if (existing != null)
                        return (MapBookingToDto(existing, ResolveBookingDurationMinutes(existing), packageTextMap), null, 200);
                }

                var bookingUser = await ResolveBookingUserByEmailAsync(dto.CustomerEmail);
                var resolvedUserId = bookingUser?.Id ?? userId;

                var scheduledDate = dto.ScheduledDate.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(dto.ScheduledDate, DateTimeKind.Utc) : dto.ScheduledDate;
                var bookingDate = NormalizeUtcDate(scheduledDate);

                var packageIds = dto.Packages.Select(p => p.PackageId).ToList();
                var packages = await _context.Packages
                    .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                    .Include(p => p.PackageServices).ThenInclude(ps => ps.Service).ThenInclude(s => s.ServiceProducts).ThenInclude(sp => sp.Product)
                    .ToDictionaryAsync(p => p.Id, ct);
                if (packages.Count != packageIds.Count)
                    return (null, "One or more packages not found", 400);

                var totalDuration = dto.Packages.Sum(item => packages[item.PackageId].EstimatedDurationMinutes);
                var bookingDayName = TimeZoneInfo.ConvertTimeFromUtc(bookingDate, _businessTimeZone).DayOfWeek.ToString();
                var requiredSlots = BuildRequiredTimeSlots(dto.TimeSlot, totalDuration, out var slotError, bookingDayName);
                if (requiredSlots == null) return (null, slotError, 400);
                if (IsSlotInPastForBusinessDay(bookingDate, dto.TimeSlot)) return (null, "Selected time slot is in the past. Please choose a future time.", 400);

                if (await IsFeatureFlagEnabledAsync("slotReservation"))
                {
                    var normalizedIntentId = dto.StripePaymentIntentId?.Trim();
                    var conflict = await _context.SlotReservations.AnyAsync(r =>
                        r.ScheduledDate == bookingDate && r.TimeSlot == dto.TimeSlot
                        && r.ExpiresAt > DateTime.UtcNow
                        && (normalizedIntentId == null || r.PaymentIntentId != normalizedIntentId), ct);
                    if (conflict) return (null, "This slot is temporarily held by another customer completing payment. Please try again in a few minutes or choose a different time.", 409);
                }

                var autoAssignEnabled = await IsAutoAssignEnabledAsync();
                var travelBuffer = await GetWorkerTravelBufferMinutesAsync();
                StaffEntity? autoWorker = null;
                if (autoAssignEnabled)
                {
                    autoWorker = await FindAutoAssignableWorkerAsync(scheduledDate, dto.TimeSlot, totalDuration, travelBuffer);
                    if (autoWorker == null) return (null, "No detailer is available for the selected time and duration. Please choose a different slot.", 400);
                }
                else
                {
                    var hasCapacity = await HasManualPoolCapacityAsync(scheduledDate, dto.TimeSlot, totalDuration, travelBuffer);
                    if (!hasCapacity) return (null, "Manual queue is at capacity for this time. Please choose a different slot.", 400);
                }

                var existingSlotKeys = await _context.Availabilities.AsNoTracking()
                    .Where(a => a.Date == bookingDate && requiredSlots.Contains(a.TimeSlot))
                    .Select(a => a.TimeSlot).ToListAsync(ct);
                var missing = requiredSlots.Where(s => !existingSlotKeys.Contains(s)).ToList();
                if (missing.Count > 0)
                {
                    _context.Availabilities.AddRange(missing.Select(s => new Availability
                    {
                        Date = bookingDate, TimeSlot = s,
                        MaxBookings = DefaultMaxBookingsPerSlot, CurrentBookings = 0, IsAvailable = true
                    }));
                    await _context.SaveChangesAsync(ct);
                }

                var checklistItems = BuildChecklistItems(dto.Packages, packages);
                decimal totalCost = 0;
                var rawItems = new List<(int PackageId, decimal BasePrice, int Quantity, decimal ItemCost)>();
                foreach (var item in dto.Packages)
                {
                    var pkg = packages[item.PackageId];
                    var cost = pkg.PackageServices.Sum(ps => ps.Service.ServiceProducts.Sum(sp => sp.QuantityUsed * sp.Product.CostPerUnit)) * item.Quantity;
                    totalCost += cost;
                    rawItems.Add((pkg.Id, pkg.Price, item.Quantity, cost));
                }

                var (subscription, subError) = await ResolveApplicableSubscriptionAsync(resolvedUserId, dto.CustomerSubscriptionId, dto.VehicleType);
                if (subError != null) return (null, subError, 400);
                var subDiscount = subscription?.Plan?.DiscountPercent ?? 0m;

                decimal referralDiscount = 0m;
                if (resolvedUserId.HasValue)
                {
                    var (rPct, _) = await _referralService.GetReferralDiscountForUserAsync(resolvedUserId.Value);
                    if (rPct.HasValue && rPct.Value > 0) referralDiscount = rPct.Value;
                }
                var combinedDiscount = subDiscount + referralDiscount;

                var pricingItems = rawItems.Select(r => new PackagePricingItem(r.PackageId, r.BasePrice, r.Quantity)).ToList();
                var prelimSubtotal = pricingItems.Sum(i => Math.Round(i.BasePrice, 2) * i.Quantity);

                if (!string.IsNullOrWhiteSpace(dto.OfferCode) && resolvedUserId.HasValue && _couponLimiter.IsBlocked(resolvedUserId.Value))
                    return (null, "Too many invalid offer code attempts. Please wait before trying again.", 400);

                var (offerResult, offerError) = await ResolveOfferAsync(dto.OfferCode, resolvedUserId, prelimSubtotal);
                if (offerError != null)
                {
                    if (!string.IsNullOrWhiteSpace(dto.OfferCode) && resolvedUserId.HasValue) _couponLimiter.RecordFailure(resolvedUserId.Value);
                    await _audit.LogAsync("CouponRejected", resolvedUserId, dto.CustomerEmail?.Trim(), "Offer", dto.OfferCode?.Trim(), new { offerCode = dto.OfferCode, reason = offerError }, success: false);
                    return (null, offerError, 400);
                }
                if (offerResult != null && resolvedUserId.HasValue) _couponLimiter.RecordSuccess(resolvedUserId.Value);

                var pricing = await _pricingService.CalculateAsync(pricingItems, dto.VehicleType, combinedDiscount, offerResult?.Offer, offerResult?.AppliedCode);
                var finalAmount = pricing.FinalAmount;
                var discountAmount = pricing.TotalDiscountAmount;

                decimal referralPointsUsed = 0;
                if (dto.UseReferralPoints && resolvedUserId.HasValue && finalAmount > 0)
                {
                    var user = await _context.Users.FindAsync(new object[] { resolvedUserId.Value }, ct);
                    if (user != null && user.ReferralPoints > 0)
                    {
                        referralPointsUsed = Math.Min(finalAmount, user.ReferralPoints);
                        finalAmount -= referralPointsUsed;
                        discountAmount += referralPointsUsed;
                    }
                }

                var multiplier = pricing.VehicleMultiplier;
                var bookingItems = rawItems.Select(r => new BookingItem
                {
                    PackageId = r.PackageId,
                    Price = Math.Round(r.BasePrice * multiplier, 2),
                    Quantity = r.Quantity,
                    ItemCost = r.ItemCost,
                    SnapshotDurationMinutes = packages[r.PackageId].EstimatedDurationMinutes,
                }).ToList();

                List<BookingAddOn> bookingAddOns = new();
                if (dto.AddOnIds?.Count > 0)
                {
                    var addOns = await _context.ServiceAddOns
                        .Where(a => dto.AddOnIds.Contains(a.Id) && a.IsActive)
                        .ToListAsync(ct);
                    bookingAddOns = addOns.Select(a => new BookingAddOn
                    {
                        AddOnId = a.Id,
                        Name = a.Name,
                        Price = a.Price
                    }).ToList();
                    finalAmount += bookingAddOns.Sum(a => a.Price);
                }

                var addressType = NormalizeAddressType(dto.AddressType);
                var customerAddress = string.IsNullOrWhiteSpace(dto.CustomerAddress) ? null : dto.CustomerAddress.Trim();
                if (bookingUser != null)
                {
                    var preferred = NormalizeAddressType(bookingUser.PreferredAddressType);
                    var addr = GetAddressByType(bookingUser, preferred);
                    if (!string.IsNullOrWhiteSpace(addr)) { addressType = preferred; customerAddress = addr.Trim(); }
                }
                if (string.IsNullOrWhiteSpace(customerAddress)) return (null, "Please provide a service address before booking.", 400);

                var booking = new Models.Booking
                {
                    BookingNumber = $"BOOK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}",
                    OrgId = _tenantContext.OrgId,
                    UserId = resolvedUserId,
                    StripePaymentIntentId = dto.StripePaymentIntentId,
                    IdempotencyKey = normalizedKey,
                    ScheduledDate = bookingDate,
                    TimeSlot = dto.TimeSlot,
                    Status = BookingStatus.Pending,
                    PaymentStatus = finalAmount == 0 ? PaymentStatus.Paid : PaymentStatus.PreAuthorized,
                    TotalAmount = finalAmount,
                    DiscountAmount = discountAmount,
                    AppliedOfferCode = offerResult?.AppliedCode,
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
                    AssignedWorkerId = autoWorker?.Id,
                    PreferredWorkerId = dto.PreferredWorkerId,
                    SpecialInstructions = dto.SpecialInstructions,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    BookingItems = bookingItems,
                    ChecklistItems = checklistItems,
                    BookingAddOns = bookingAddOns
                };
                if (booking.AssignedWorkerId.HasValue) booking.Status = BookingStatus.Confirmed;

                await using var txn = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
                if (booking.AssignedWorkerId.HasValue)
                {
                    var latestWorkerBookings = await _context.Bookings
                        .Where(b => b.AssignedWorkerId == booking.AssignedWorkerId.Value
                            && b.ScheduledDate.Date == bookingDate.Date
                            && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                        .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                        .ToListAsync(ct);
                    if (HasWorkerTimeConflict(latestWorkerBookings, booking.TimeSlot, totalDuration))
                        return (null, "No detailer is available for the selected time and duration. Please choose a different slot.", 400);
                }

                _context.Bookings.Add(booking);
                var avails = await _context.Availabilities
                    .Where(a => a.Date == bookingDate && requiredSlots.Contains(a.TimeSlot))
                    .ToListAsync(ct);
                var fullSlot = avails.FirstOrDefault(a => a.CurrentBookings >= a.MaxBookings);
                if (fullSlot != null) return (null, "This time slot just became fully booked. Please choose a different slot.", 409);
                foreach (var av in avails)
                {
                    av.CurrentBookings++;
                    if (av.CurrentBookings >= av.MaxBookings) av.IsAvailable = false;
                }
                if (offerResult?.UserOffer != null) { offerResult.UserOffer.IsRedeemed = true; offerResult.UserOffer.RedeemedAt = DateTime.UtcNow; }
                if (subscription != null && subscription.Status == UserSubscriptionStatus.Active) { /* wash count tracked externally */ }

                await _context.SaveChangesAsync(ct);
                await txn.CommitAsync(ct);

                if (resolvedUserId.HasValue && referralPointsUsed > 0)
                {
                    var userForDeduction = await _context.Users.FindAsync(new object[] { resolvedUserId.Value }, ct);
                    if (userForDeduction != null && userForDeduction.ReferralPoints >= referralPointsUsed)
                    {
                        userForDeduction.ReferralPoints -= referralPointsUsed;
                        await _context.SaveChangesAsync(ct);
                    }
                }

                await _adminNotificationService.NotifyNewBookingAsync(booking);
                await _audit.LogAsync(finalAmount == 0 ? "FreeBookingCreated" : "BookingCreated",
                    resolvedUserId, booking.CustomerEmail, "Booking", booking.BookingNumber,
                    new { bookingNumber = booking.BookingNumber, totalAmount = finalAmount, couponCode = booking.AppliedOfferCode, isFree = finalAmount == 0 });
                await _domainEvents.PublishAsync(new BookingCreatedEvent(_tenantContext.OrgId, booking.Id, booking.BookingNumber, booking.UserId));

                var dto2 = MapBookingToDto(booking, totalDuration, packageTextMap);
                if (autoWorker != null) dto2.AssignedWorkerName = $"{autoWorker.FirstName} {autoWorker.LastName}".Trim();
                return (dto2, null, 201);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating booking");
                return (null, $"Failed to create booking: {ex.Message}", 500);
            }
        }

        // ---- IBookingService: GetMyBookings ----------------------------------------

        public async Task<IEnumerable<BookingDto>> GetMyBookingsAsync(int userId, string lang, CancellationToken ct = default)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, ct);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user == null) return Enumerable.Empty<BookingDto>();
            var email = user.Email.Trim().ToLowerInvariant();
            var bookings = await _context.Bookings
                .Where(b => b.UserId == userId || b.CustomerEmail.ToLower() == email)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .Include(b => b.ChecklistItems)
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync(ct);
            return bookings.Select(b => MapBookingToDto(b, ResolveBookingDurationMinutes(b), packageTextMap));
        }

        // ---- IBookingService: GetBooking -------------------------------------------

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> GetBookingAsync(
            string bookingNumber, int? userId, bool isCustomer, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .Include(b => b.ChecklistItems)
                .Include(b => b.BookingAddOns)
                .FirstOrDefaultAsync(b => b.BookingNumber == bookingNumber);
            if (booking == null) return (null, "Booking not found", 404);
            if (isCustomer && (!userId.HasValue || booking.UserId != userId.Value)) return (null, "Forbidden", 403);

            bool isFirstCompletedWash = false, referralCodeUnlocked = false;
            if (booking.UserId.HasValue)
            {
                var user = await _context.Users.FindAsync(booking.UserId.Value);
                if (user != null)
                {
                    isFirstCompletedWash = user.FirstWashCompletedAt.HasValue && booking.WorkCompletedAt.HasValue
                        && user.FirstWashCompletedAt.Value.AddMinutes(-1) <= booking.WorkCompletedAt.Value
                        && booking.WorkCompletedAt.Value <= user.FirstWashCompletedAt.Value.AddMinutes(1);
                    referralCodeUnlocked = user.FirstWashCompletedAt.HasValue || user.TotalBookingsCount > 0;
                }
            }

            var dto = MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap);
            dto.IsFirstCompletedWash = isFirstCompletedWash;
            dto.ReferralCodeUnlocked = referralCodeUnlocked;
            return (dto, null, 200);
        }

        // ---- IBookingService: GetBookingQuote -------------------------------------

        public async Task<(BookingQuoteDto? Result, string? Error)> GetBookingQuoteAsync(BookingQuoteRequestDto dto, int? userId)
        {
            var packageIds = dto.Packages.Select(p => p.PackageId).ToList();
            var packages = await _context.Packages
                .AsNoTracking()
                .Where(p => packageIds.Contains(p.Id) && p.IsActive)
                .Include(p => p.PackageServices).ThenInclude(ps => ps.Service).ThenInclude(s => s.ServiceProducts).ThenInclude(sp => sp.Product)
                .ToDictionaryAsync(p => p.Id);
            if (packages.Count != packageIds.Count) return (null, "One or more packages not found");
            var pricingItems = dto.Packages.Select(p => new PackagePricingItem(p.PackageId, packages[p.PackageId].Price, p.Quantity)).ToList();
            var (offerResult, offerError) = await ResolveOfferAsync(dto.OfferCode, userId, pricingItems.Sum(i => i.BasePrice * i.Quantity));
            if (offerError != null) return (null, offerError);
            var pricing = await _pricingService.CalculateAsync(pricingItems, dto.VehicleType, 0, offerResult?.Offer, offerResult?.AppliedCode);
            return (new BookingQuoteDto
            {
                BaseAmount = pricing.SubtotalBeforeDiscounts,
                VehicleMultiplier = pricing.VehicleMultiplier,
                TotalDiscountAmount = pricing.TotalDiscountAmount,
                FinalPrice = pricing.FinalAmount,
                AppliedOfferCode = offerResult?.AppliedCode
            }, null);
        }

        // ---- IBookingService: GetAvailableSlots ------------------------------------

        public async Task<IEnumerable<string>> GetAvailableSlotsAsync(
            DateTime date, int? durationMinutes, VehicleType? vehicleType,
            int? preferredWorkerId, int? excludeBookingId = null, CancellationToken ct = default)
        {
            var bookingDate = NormalizeUtcDate(date);
            var dayName = TimeZoneInfo.ConvertTimeFromUtc(bookingDate, _businessTimeZone).DayOfWeek.ToString();
            var minDuration = await GetMinimumJobDurationMinutesAsync();
            var duration = Math.Max(durationMinutes ?? minDuration, minDuration);
            var travelBuffer = await GetWorkerTravelBufferMinutesAsync();
            var candidates = BuildCandidateStartSlots(duration, dayName);
            if (candidates.Count == 0) return Enumerable.Empty<string>();
            var dayEnd = bookingDate.AddDays(1);
            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive).ToListAsync(ct);
            var wIds = workers.Select(w => w.Id).ToList();
            var dayBookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed
                    && (excludeBookingId == null || b.Id != excludeBookingId))
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync(ct);
            var byWorker = dayBookings.Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
            var result = new List<string>();
            foreach (var slot in candidates)
            {
                if (IsSlotInPastForBusinessDay(bookingDate, slot)) continue;
                IEnumerable<StaffEntity> eligible = workers.Where(w => WorkerWorksOnDay(w.WorkingDays, bookingDate.DayOfWeek))
                    .Where(w => { var (ss, se) = GetWorkerShiftForDay(w, bookingDate.DayOfWeek); return TimeSlotInWorkerShift(slot, duration, ss, se, travelBuffer); });
                if (preferredWorkerId.HasValue) eligible = eligible.Where(w => w.Id == preferredWorkerId.Value);
                var hasWorker = eligible.Any(w => !HasWorkerTimeConflict(byWorker.TryGetValue(w.Id, out var wb) ? wb : new List<Models.Booking>(), slot, duration, travelBuffer));
                if (hasWorker) result.Add(slot);
            }
            return result;
        }

        // ---- IBookingService: GetAvailabilityCalendar -------------------------------

        public async Task<IEnumerable<DayAvailabilityDto>> GetAvailabilityCalendarAsync(
            DateTime from, DateTime to, int? durationMinutes, CancellationToken ct = default)
        {
            var startDate = NormalizeUtcDate(from);
            var endDate = NormalizeUtcDate(to);
            var minDuration = await GetMinimumJobDurationMinutesAsync();
            var duration = Math.Max(durationMinutes ?? minDuration, minDuration);
            var travelBuffer = await GetWorkerTravelBufferMinutesAsync();
            var result = new List<DayAvailabilityDto>();
            for (var d = startDate; d <= endDate; d = d.AddDays(1))
            {
                var validSlots = await CountValidSlotsForDayAsync(d, duration, travelBuffer);
                result.Add(new DayAvailabilityDto
                {
                    Date = d,
                    Status = validSlots == 0 ? DayAvailabilityStatus.Full : validSlots <= 2 ? DayAvailabilityStatus.Medium : DayAvailabilityStatus.Available,
                    FreeSlots = validSlots,
                    TotalSlots = validSlots
                });
            }
            return result;
        }

        // ---- IBookingService: GetWorkersSchedule ------------------------------------

        public async Task<(IEnumerable<WorkerScheduleDayDto>? Result, string? Error)> GetWorkersScheduleAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
        {
            var startDate = NormalizeUtcDate(from ?? DateTime.UtcNow.AddDays(1));
            var endDate = NormalizeUtcDate(to ?? startDate.AddDays(31));
            if (endDate < startDate) return (null, "The end date must be on or after the start date.");
            if ((endDate - startDate).TotalDays > 120) return (null, "Date range is too large. Please request up to 120 days.");
            var minDuration = await GetMinimumJobDurationMinutesAsync();
            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.FirstName).ThenBy(s => s.LastName).ToListAsync(ct);
            var wIds = workers.Select(w => w.Id).ToList();
            var endExclusive = endDate.AddDays(1);
            var rangeBookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.AssignedWorkerId.HasValue && wIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= startDate && b.ScheduledDate < endExclusive && b.Status != BookingStatus.Cancelled)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync(ct);
            var byDateWorker = rangeBookings.Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => new { Date = b.ScheduledDate.Date, b.AssignedWorkerId!.Value })
                .ToDictionary(g => (g.Key.Date, g.Key.Value), g => g.ToList());
            var result = new List<WorkerScheduleDayDto>();
            for (var d = startDate; d <= endDate; d = d.AddDays(1))
            {
                var daily = new List<WorkerDailyLoadDto>();
                int totalCap = 0, available = 0, activeWorkers = 0;
                foreach (var w in workers)
                {
                    var works = WorkerWorksOnDay(w.WorkingDays, d.DayOfWeek);
                    var wb = byDateWorker.TryGetValue((d.Date, w.Id), out var bkgs) ? bkgs : new List<Models.Booking>();
                    var (ss, se) = GetWorkerShiftForDay(w, d.DayOfWeek);
                    int shiftMin = 0, freeMins = 0, availStarts = 0;
                    if (works && TryParseShiftWindowMinutes(ss, se, out var ssMin, out var seMin))
                    {
                        activeWorkers++;
                        shiftMin = seMin - ssMin;
                        var buffered = Math.Max(0, shiftMin - DefaultWorkerTravelBufferMinutes);
                        totalCap += ComputeStartCapacity(buffered, minDuration);
                        CalculateWorkerFreeCapacity(wb, ssMin, seMin, minDuration, out freeMins, out availStarts);
                        available += availStarts;
                    }
                    daily.Add(new WorkerDailyLoadDto
                    {
                        WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName,
                        WorksOnDay = works, BookingsCount = wb.Count,
                        ShiftStart = ss, ShiftEnd = se, TotalShiftMinutes = shiftMin,
                        UsableFreeMinutes = freeMins, AvailableStartCount = availStarts
                    });
                }
                result.Add(new WorkerScheduleDayDto
                {
                    Date = d, Workers = daily,
                    TotalStartsCapacity = totalCap, AvailableStarts = available, ActiveWorkersForDay = activeWorkers
                });
            }
            return (result, null);
        }

        // ---- IBookingService: GetWorkersDayTimeline --------------------------------

        public async Task<(IEnumerable<WorkerDayTimelineDto>? Result, string? Error)> GetWorkersDayTimelineAsync(string date, CancellationToken ct = default)
        {
            if (!DateTime.TryParse(date, out var parsedDate)) return (null, "Invalid date format.");
            var targetDate = NormalizeUtcDate(parsedDate);
            var dayEnd = targetDate.AddDays(1);
            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.FirstName).ThenBy(s => s.LastName).ToListAsync(ct);
            var bookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.AssignedWorkerId.HasValue && b.ScheduledDate >= targetDate && b.ScheduledDate < dayEnd && b.Status != BookingStatus.Cancelled)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync(ct);
            var byWorker = bookings.Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Helpers share a van with their driver - exclude them from timeline rows.
            var driverWorkers = workers.Where(w => w.VanRole != "Helper").ToList();
            var helperByDriver = workers
                .Where(w => w.VanRole == "Helper" && w.DriverId.HasValue)
                .GroupBy(w => w.DriverId!.Value)
                .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(h => $"{h.FirstName} {h.LastName}")));

            var result = driverWorkers.Select(w =>
            {
                var (ss, se) = GetWorkerShiftForDay(w, targetDate.DayOfWeek);
                var wb = byWorker.TryGetValue(w.Id, out var bkgs) ? bkgs : new List<Models.Booking>();
                helperByDriver.TryGetValue(w.Id, out var helperName);
                return new WorkerDayTimelineDto
                {
                    WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName,
                    WorksOnDay = WorkerWorksOnDay(w.WorkingDays, targetDate.DayOfWeek),
                    ShiftStart = ss, ShiftEnd = se,
                    VanRole = w.VanRole,
                    HelperName = helperName,
                    Bookings = wb.Select(b => new DayBookingSlotDto
                    {
                        BookingId = b.Id, BookingNumber = b.BookingNumber,
                        StartTime = b.TimeSlot, EstimatedDurationMinutes = ResolveBookingDurationMinutes(b),
                        Status = b.Status.ToString(), CustomerName = b.CustomerName
                    }).OrderBy(s => s.StartTime).ToList()
                };
            }).ToList();
            return (result, null);
        }

        // ---- Admin methods (delegating stubs - full logic to be extracted later) ---

        public async Task<(PagedBookingsResult? Result, string? Error)> GetAllBookingsAsync(
            int page, int pageSize, string? search, string? status, DateTime? dateFrom, DateTime? dateTo,
            int? filteredWorkerId, string lang, CancellationToken ct = default)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, ct);
            var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, ct);
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 500);
            IQueryable<Models.Booking> query = _context.Bookings
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package).ThenInclude(p => p.PackageServices).ThenInclude(ps => ps.Service)
                .Include(b => b.ChecklistItems).Include(b => b.AssignedWorker).AsQueryable();
            if (filteredWorkerId.HasValue) query = query.Where(b => b.AssignedWorkerId == filteredWorkerId.Value);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLower();
                query = query.Where(b => b.BookingNumber.ToLower().Contains(q)
                    || (b.CustomerName != null && b.CustomerName.ToLower().Contains(q))
                    || (b.CustomerEmail != null && b.CustomerEmail.ToLower().Contains(q))
                    || (b.CustomerPhone != null && b.CustomerPhone.ToLower().Contains(q)));
            }
            if (!string.IsNullOrWhiteSpace(status) && status != "All" && Enum.TryParse<BookingStatus>(status, true, out var ps2))
                query = query.Where(b => b.Status == ps2);
            if (dateFrom.HasValue) query = query.Where(b => b.ScheduledDate >= dateFrom.Value.ToUniversalTime());
            if (dateTo.HasValue) query = query.Where(b => b.ScheduledDate <= dateTo.Value.ToUniversalTime());
            var total = await query.CountAsync(ct);
            var items = await query.OrderByDescending(b => b.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return (new PagedBookingsResult
            {
                Items = items.Select(b => MapBookingToDto(b, ResolveBookingDurationMinutes(b), packageTextMap)).ToList(),
                TotalCount = total, Page = page, PageSize = pageSize, TotalPages = (int)Math.Ceiling((double)total / pageSize)
            }, null);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> UpdateChecklistItemAsync(int bookingId, int checklistItemId, bool isCompleted, int adminId)
        {
            var booking = await _context.Bookings.Include(b => b.ChecklistItems).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (null, "Booking not found", 404);
            var item = booking.ChecklistItems.FirstOrDefault(ci => ci.Id == checklistItemId);
            if (item == null) return (null, "Checklist item not found for this booking", 404);
            item.IsCompleted = isCompleted;
            item.CompletedAt = isCompleted ? DateTime.UtcNow : null;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            var dto = new BookingDto { ChecklistItems = MapChecklistItems(booking.ChecklistItems) };
            return (dto, null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> UpdateBookingStatusAsync(int id, string statusStr, int adminId)
        {
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ThenInclude(p => p.PackageServices).ThenInclude(ps => ps.Service).ThenInclude(s => s.ServiceProducts).ThenInclude(sp => sp.Product)
                .FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return (null, "Booking not found", 404);
            if (!Enum.TryParse<BookingStatus>(statusStr, true, out var newStatus)) return (null, "Invalid status", 400);
            var prev = booking.Status;
            booking.Status = newStatus;
            var now = DateTime.UtcNow;
            if (newStatus == BookingStatus.InProgress) { booking.WorkStartedAt ??= now; if (prev == BookingStatus.Completed) { booking.WorkCompletedAt = null; booking.WorkDurationSeconds = null; } }
            if (newStatus == BookingStatus.Completed) { booking.WorkStartedAt ??= now; booking.WorkCompletedAt = now; booking.WorkDurationSeconds = (int)Math.Max(0, Math.Round((now - booking.WorkStartedAt!.Value).TotalSeconds)); }
            booking.UpdatedAt = now;
            await _context.SaveChangesAsync();
            if (booking.UserId.HasValue && prev != BookingStatus.Completed && newStatus == BookingStatus.Completed)
            {
                await IssueLoyaltyCouponsAsync(booking.UserId.Value);
                if (booking.OrgId.HasValue)
                    await AwardLoyaltyPointsAsync(booking.OrgId.Value, booking.UserId.Value, booking.Id, booking.TotalAmount);
                var user = await _context.Users.FindAsync(booking.UserId.Value);
                if (user != null && !user.FirstWashCompletedAt.HasValue) { user.FirstWashCompletedAt = now; await _context.SaveChangesAsync(); }
                await _referralService.CheckAndRewardReferralAsync(booking.Id, booking.UserId.Value);
            }
            await _adminNotificationService.NotifyBookingStatusChangedAsync(booking, prev);
            await _domainEvents.PublishAsync(new BookingCompletedEvent(_tenantContext.OrgId, booking.Id, booking.BookingNumber, booking.TotalAmount));
            return (null, null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> AssignWorkerAsync(int bookingId, int workerId, int adminId)
        {
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (null, "Booking not found", 404);
            var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == workerId && s.IsActive);
            if (worker == null) return (null, "Worker not found or inactive", 400);
            var duration = ResolveBookingDurationMinutes(booking);
            var bookingDate = NormalizeUtcDate(booking.ScheduledDate);
            var buffer = await GetWorkerTravelBufferMinutesAsync();
            var dayEnd = bookingDate.AddDays(1);
            var workerBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId == worker.Id && b.Id != booking.Id && b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            if (HasWorkerTimeConflict(workerBookings, booking.TimeSlot, duration, buffer))
                return (null, "Selected worker has a scheduling conflict at this time.", 409);
            booking.AssignedWorkerId = worker.Id;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, null, 200);
        }

        public async Task<IEnumerable<WorkerAvailabilityDto>> GetAvailableWorkersForBookingAsync(int bookingId)
        {
            var booking = await _context.Bookings.AsNoTracking()
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return Enumerable.Empty<WorkerAvailabilityDto>();
            var duration = ResolveBookingDurationMinutes(booking);
            var bookingDate = NormalizeUtcDate(booking.ScheduledDate);
            var buffer = await GetWorkerTravelBufferMinutesAsync();
            var workers = await _context.Staff.AsNoTracking().OrderBy(s => s.FirstName).ThenBy(s => s.LastName).ToListAsync();
            var dayEnd = bookingDate.AddDays(1);
            var dayBookings = await _context.Bookings.AsNoTracking()
                .Where(b => b.Id != booking.Id && b.AssignedWorkerId.HasValue && b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            var byWorker = dayBookings.GroupBy(b => b.AssignedWorkerId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            return workers.Select(w =>
            {
                if (!w.IsActive) return new WorkerAvailabilityDto { WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName, Email = w.Email, IsAvailable = false, Note = "Inactive worker" };
                if (!WorkerWorksOnDay(w.WorkingDays, bookingDate.DayOfWeek)) return new WorkerAvailabilityDto { WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName, Email = w.Email, IsAvailable = false, Note = "Not scheduled on this day" };
                var (ss, se) = GetWorkerShiftForDay(w, bookingDate.DayOfWeek);
                if (!TimeSlotInWorkerShift(booking.TimeSlot, duration, ss, se, buffer)) return new WorkerAvailabilityDto { WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName, Email = w.Email, IsAvailable = false, Note = "Shift does not cover booking time" };
                var conflict = HasWorkerTimeConflict(byWorker.TryGetValue(w.Id, out var wb) ? wb : new List<Models.Booking>(), booking.TimeSlot, duration, buffer);
                return new WorkerAvailabilityDto { WorkerId = w.Id, FirstName = w.FirstName, LastName = w.LastName, Email = w.Email, IsAvailable = !conflict, Note = conflict ? "Has scheduling conflict" : null };
            });
        }

        public async Task<(string? Error, int StatusCode)> UpdatePaymentStatusAsync(int id, string paymentStatus, int adminId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return ("Booking not found", 404);
            if (!Enum.TryParse<PaymentStatus>(paymentStatus, true, out var ps)) return ("Invalid payment status", 400);
            booking.PaymentStatus = ps;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> CancelBookingAsync(int id, int userId, bool isAdmin)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return ("Booking not found", 404);
            if (!isAdmin && booking.UserId != userId) return ("Forbidden", 403);
            if (booking.Status == BookingStatus.Cancelled) return ("Booking is already cancelled", 400);
            booking.Status = BookingStatus.Cancelled;
            booking.UpdatedAt = DateTime.UtcNow;
            var slots = await _context.Availabilities
                .Where(a => a.Date == booking.ScheduledDate && a.TimeSlot == booking.TimeSlot)
                .ToListAsync();
            foreach (var av in slots) { av.CurrentBookings = Math.Max(0, av.CurrentBookings - 1); av.IsAvailable = true; }
            await _context.SaveChangesAsync();
            await _domainEvents.PublishAsync(new BookingCancelledEvent(_tenantContext.OrgId, booking.Id, booking.BookingNumber, null));
            return (null, 204);
        }

        public async Task<(AdminCancelRefundResultDto? Result, string? Error, int StatusCode)> AdminCancelAndRefundAsync(int id, AdminCancelRefundDto dto, int adminId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return (null, "Booking not found", 404);
            booking.Status = BookingStatus.Cancelled;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (new AdminCancelRefundResultDto { Message = "Booking cancelled", StripeAction = "NoPayment", RefundedAmount = 0 }, null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> AddPackagesToBookingAsync(int bookingId, AddBookingPackageDto dto, int adminId, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (null, "Booking not found", 404);
            // Package addition logic (simplified - full implementation in controller for now)
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap), null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> AddServicesToBookingAsync(int bookingId, AddBookingServiceDto dto, int adminId, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (null, "Booking not found", 404);
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap), null, 200);
        }

        public async Task<(WorkerAbsenceResultDto? Result, string? Error, int StatusCode)> MarkWorkerAbsentAsync(WorkerAbsenceDto dto, int adminId)
        {
            var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == dto.WorkerId);
            if (worker == null) return (null, "Worker not found", 404);
            return (new WorkerAbsenceResultDto { Reassigned = 0, Unassigned = 0, Summary = "Worker marked absent." }, null, 200);
        }

        public async Task<(string? Error, int StatusCode)> RequestCancellationAsync(int bookingId, int userId, string? reason)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId);
            if (booking == null) return ("Booking not found", 404);
            booking.CancellationRequested = true;
            booking.CancellationRequestReason = reason;
            booking.CancellationRequestedAt = DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> RequestRescheduleAsync(int bookingId, int userId, RequestRescheduleDto dto)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId);
            if (booking == null) return ("Booking not found", 404);
            booking.RescheduleRequested = true;
            booking.RescheduleRequestNote = dto.Reason;
            booking.ReschedulePreferredDate = dto.PreferredDate;
            booking.RescheduleRequestedAt = DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> RejectCancellationRequestAsync(int bookingId, int adminId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return ("Booking not found", 404);
            booking.CancellationRequested = false;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> RejectRescheduleRequestAsync(int bookingId, int adminId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return ("Booking not found", 404);
            booking.RescheduleRequested = false;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(CancellationFeeInfoDto? Result, string? Error, int StatusCode)> GetCancellationFeeAsync(int bookingId)
        {
            var booking = await _context.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return (null, "Booking not found", 404);
            var fee = await CalculateCancellationFeeAsync(booking);
            return (fee, null, 200);
        }

        private async Task<CancellationFeeInfoDto> CalculateCancellationFeeAsync(Models.Booking booking)
        {
            var policySection = _configuration.GetSection("CancellationPolicy");
            var hoursToBooking = (booking.ScheduledDate - DateTime.UtcNow).TotalHours;
            decimal feePercent = 0;
            if (hoursToBooking < 2) feePercent = 100;
            else if (hoursToBooking < 24) feePercent = 50;
            var fee = Math.Round(booking.TotalAmount * (feePercent / 100m), 2);
            return new CancellationFeeInfoDto
            {
                FeeEnabled = feePercent > 0,
                FeeType = "Percent",
                FeeAmount = feePercent,
                BookingTotal = booking.TotalAmount,
                CalculatedFee = fee,
                WithinFreeWindow = feePercent == 0,
                HoursUntilAppointment = hoursToBooking
            };
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> AdminEditBookingAsync(int id, AdminEditBookingDto dto, int adminId, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == id);
            if (booking == null) return (null, "Booking not found", 404);
            booking.CustomerAddress = dto.CustomerAddress ?? booking.CustomerAddress;
            booking.SpecialInstructions = dto.SpecialInstructions ?? booking.SpecialInstructions;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap), null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> CustomerEditBookingAsync(int id, CustomerEditBookingDto dto, int userId, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            if (booking == null) return (null, "Booking not found", 404);
            booking.CustomerAddress = dto.CustomerAddress ?? booking.CustomerAddress;
            booking.SpecialInstructions = dto.SpecialInstructions ?? booking.SpecialInstructions;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap), null, 200);
        }

        // ---- Worker operations ------------------------------------------------------

        public async Task<IEnumerable<BookingDto>> GetWorkerBookingsAsync(int workerId, string lang, CancellationToken ct = default)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, ct);
            var bookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId == workerId
                    || (b.AssignedWorkerId == null && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed))
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package).ThenInclude(p => p.PackageServices).ThenInclude(ps => ps.Service)
                .Include(b => b.ChecklistItems).Include(b => b.AssignedWorker)
                .OrderBy(b => b.ScheduledDate).ThenBy(b => b.TimeSlot)
                .ToListAsync(ct);
            return bookings.Select(b => MapBookingToDto(b, ResolveBookingDurationMinutes(b), packageTextMap));
        }

        public async Task<(string? Error, int StatusCode)> ClaimBookingAsync(int bookingId, int workerId)
        {
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return ("Booking not found", 404);
            if (booking.AssignedWorkerId.HasValue && booking.AssignedWorkerId != workerId) return ("Booking already claimed", 409);
            var worker = await _context.Staff.FirstOrDefaultAsync(s => s.Id == workerId && s.IsActive);
            if (worker == null) return ("Worker not found", 404);
            var buffer = await GetWorkerTravelBufferMinutesAsync();
            var bookingDate = NormalizeUtcDate(booking.ScheduledDate);
            var dayEnd = bookingDate.AddDays(1);
            var duration = ResolveBookingDurationMinutes(booking);
            var workerBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId == workerId && b.Id != bookingId && b.ScheduledDate >= bookingDate && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();
            if (HasWorkerTimeConflict(workerBookings, booking.TimeSlot, duration, buffer)) return ("You have a scheduling conflict at this time.", 409);
            booking.AssignedWorkerId = workerId;
            booking.Status = BookingStatus.Confirmed;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> StartJobAsync(int bookingId, int workerId)
        {
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).Include(b => b.ChecklistItems).FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return (null, "Booking not found or not assigned to you", 404);
            booking.Status = BookingStatus.InProgress;
            booking.WorkStartedAt ??= DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), new Dictionary<int, (string?, string?)>()), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> MarkOnMyWayAsync(int bookingId, int workerId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return ("Booking not found or not assigned to you", 404);
            booking.WorkerOnMyWayAt = DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> MarkArrivedAsync(int bookingId, int workerId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return ("Booking not found or not assigned to you", 404);
            var cooldown = TimeSpan.FromMinutes(5);
            if (booking.WorkerArrivedAt.HasValue && DateTime.UtcNow - booking.WorkerArrivedAt.Value < cooldown) return ("Arrival already notified recently.", 429);
            booking.WorkerArrivedAt = DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> MarkRunningLateAsync(int bookingId, int workerId, int minutes, string? reason)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return ("Booking not found or not assigned to you", 404);
            if (minutes < 5 || minutes > 120) return ("Delay minutes must be between 5 and 120.", 400);
            booking.WorkerRunningLateAt = DateTime.UtcNow;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> FinishJobAsync(int bookingId, int workerId, string lang)
        {
            var packageTextMap = await GetPackageTextMapAsync(lang, default);
            var booking = await _context.Bookings
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package).ThenInclude(p => p.PackageServices).ThenInclude(ps => ps.Service).ThenInclude(s => s.ServiceProducts).ThenInclude(sp => sp.Product)
                .Include(b => b.ChecklistItems)
                .FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return (null, "Booking not found or not assigned to you", 404);
            var now = DateTime.UtcNow;
            booking.Status = BookingStatus.Completed;
            booking.WorkStartedAt ??= now;
            booking.WorkCompletedAt = now;
            booking.WorkDurationSeconds = (int)Math.Max(0, Math.Round((now - booking.WorkStartedAt.Value).TotalSeconds));
            booking.UpdatedAt = now;

            // Deduct stock
            var usage = BuildProductUsageMap(booking);
            foreach (var (productId, qty) in usage)
            {
                var product = await _context.Products.FindAsync(productId);
                if (product != null) product.StockQuantity = Math.Max(0, product.StockQuantity - ToStockUnits(qty));
            }

            // Update customer stats
            if (booking.UserId.HasValue)
            {
                var user = await _context.Users.FindAsync(booking.UserId.Value);
                if (user != null)
                {
                    user.TotalBookingsCount++;
                    user.TotalSpent += booking.TotalAmount;
                    user.LastBookedDate = now;
                    user.FirstWashCompletedAt ??= now;
                }
            }

            await _context.SaveChangesAsync();
            if (booking.UserId.HasValue)
            {
                await IssueLoyaltyCouponsAsync(booking.UserId.Value);
                await AwardLoyaltyPointsAsync(_tenantContext.OrgId, booking.UserId.Value, booking.Id, booking.TotalAmount);
            }
            await _domainEvents.PublishAsync(new BookingCompletedEvent(_tenantContext.OrgId, booking.Id, booking.BookingNumber, booking.TotalAmount));

            // Auto-generate and email invoice (fire-and-forget - don't block worker response)
            if (!string.IsNullOrEmpty(booking.CustomerEmail))
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var invoiceUrl = await _invoiceService.GenerateAndStoreAsync(booking.Id, lang);
                        await _emailService.SendInvoiceAsync(booking.CustomerEmail, booking.CustomerName, booking.BookingNumber, invoiceUrl);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[Invoice] Auto-send failed for booking {BookingId}", booking.Id);
                    }
                });
            }

            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), packageTextMap), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> PauseJobAsync(int bookingId, int workerId, string? reason)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return ("Booking not found or not assigned to you", 404);
            if (booking.Status != BookingStatus.InProgress) return ("Can only pause an in-progress booking.", 400);
            booking.Status = BookingStatus.Paused;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> ResumeJobAsync(int bookingId, int workerId)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return ("Booking not found or not assigned to you", 404);
            if (booking.Status != BookingStatus.Paused) return ("Can only resume a paused booking.", 400);
            booking.Status = BookingStatus.InProgress;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(BookingDto? Result, string? Error, int StatusCode)> UploadBookingPhotoAsync(int bookingId, int workerId, IFormFile file, string photoType)
        {
            var booking = await _context.Bookings.Include(b => b.BookingItems).ThenInclude(bi => bi.Package).FirstOrDefaultAsync(b => b.Id == bookingId && b.AssignedWorkerId == workerId);
            if (booking == null) return (null, "Booking not found or not assigned to you", 404);
            if (file.Length == 0) return (null, "Empty file.", 400);
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp")) return (null, "Only jpg, png, or webp allowed.", 400);
            var fileName = $"booking_{bookingId}_{photoType}_{Guid.NewGuid():N}{ext}";
            var stored = await _objectStorage.UploadAsync(file, "bookings", fileName);
            _context.Set<BookingPhoto>().Add(new BookingPhoto { BookingId = bookingId, PhotoType = Enum.Parse<PhotoType>(photoType, true), ImageUrl = stored.PublicUrl });
            await _context.SaveChangesAsync();
            return (MapBookingToDto(booking, ResolveBookingDurationMinutes(booking), new Dictionary<int, (string?, string?)>()), null, 200);
        }

        public async Task<IEnumerable<object>> GetBookingPhotosAsync(int bookingId, int userId)
        {
            var booking = await _context.Bookings.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == bookingId && (b.AssignedWorkerId == userId || b.UserId == userId));
            if (booking == null) return Enumerable.Empty<object>();
            var photos = await _context.Set<BookingPhoto>().AsNoTracking().Where(p => p.BookingId == bookingId).ToListAsync();
            return photos.Select(p => new { p.Id, p.PhotoType, Url = p.ImageUrl, UploadedAt = p.CreatedAt });
        }

        private async Task AwardLoyaltyPointsAsync(int orgId, int userId, int bookingId, decimal bookingTotal)
        {
            if (bookingTotal <= 0) return;
            var config = await _context.OrgLoyaltyConfigs.AsNoTracking()
                .FirstOrDefaultAsync(c => c.OrgId == orgId);
            if (config == null || !config.IsEnabled) return;

            var pointsEarned = Math.Round(bookingTotal * config.PointsPerQar, 2);
            if (pointsEarned <= 0) return;

            var account = await _context.LoyaltyAccounts
                .FirstOrDefaultAsync(a => a.OrgId == orgId && a.UserId == userId);
            if (account == null)
            {
                account = new LoyaltyAccount { OrgId = orgId, UserId = userId };
                _context.LoyaltyAccounts.Add(account);
            }
            account.Balance += pointsEarned;
            account.LifetimeEarned += pointsEarned;
            account.UpdatedAt = DateTime.UtcNow;

            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                OrgId = orgId,
                UserId = userId,
                BookingId = bookingId,
                Points = pointsEarned,
                Type = "Earn",
                Description = $"Earned from booking #{bookingId}"
            });
            await _context.SaveChangesAsync();
        }

        public async Task<(string? Error, int StatusCode)> AddTipAsync(int bookingId, int userId, decimal amount)
        {
            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId);
            if (booking == null) return ("Booking not found", 404);
            if (booking.Status != BookingStatus.Completed) return ("Tip can only be added after job is completed", 400);
            if (booking.TipAmount.HasValue) return ("Tip already added", 400);

            booking.TipAmount = amount;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }
    }
}
