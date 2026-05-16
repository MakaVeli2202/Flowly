using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using BookingEntity = Glanz.API.Models.Booking;
using StaffEntity = Glanz.API.Models.Staff;

namespace Glanz.API.Modules.SubscriptionBookings
{
    public class SubscriptionBookingService : ISubscriptionBookingService
    {
        private const string AutoAssignSettingKey = "bookings.autoAssignEnabled";

        private readonly AppDbContext    _context;
        private readonly IConfiguration _configuration;

        public SubscriptionBookingService(AppDbContext context, IConfiguration configuration)
        {
            _context       = context;
            _configuration = configuration;
        }

        public async Task<(IEnumerable<SubBookingDayAvailabilityDto> Result, string? Error)> GetAvailabilityAsync(int month, int year, int packageId)
        {
            if (month < 1 || month > 12 || year < 2020 || year > 2100)
                return (Enumerable.Empty<SubBookingDayAvailabilityDto>(), "Invalid month/year.");

            var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var to   = from.AddMonths(1);

            var durationMinutes        = await ResolveDurationAsync(packageId);
            var workerTravelBuffer     = await GetWorkerTravelBufferMinutesAsync();
            var workers                = await _context.Staff.AsNoTracking().Where(s => s.IsActive).ToListAsync();
            var workerIds              = workers.Select(w => w.Id).ToList();
            var autoAssign             = await IsAutoAssignEnabledAsync();

            var monthAssigned = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue
                         && workerIds.Contains(b.AssignedWorkerId.Value)
                         && b.ScheduledDate >= from && b.ScheduledDate < to
                         && b.Status != BookingStatus.Cancelled
                         && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var monthSubAssigned = await _context.SubscriptionBookings
                .Where(b => b.WorkerId.HasValue
                         && workerIds.Contains(b.WorkerId.Value)
                         && b.ScheduledDate >= from && b.ScheduledDate < to
                         && b.Status != SubscriptionBookingStatus.Cancelled)
                .ToListAsync();

            var daysInMonth = DateTime.DaysInMonth(year, month);
            var result      = new List<SubBookingDayAvailabilityDto>();

            for (int d = 1; d <= daysInMonth; d++)
            {
                var dayUtc = new DateTime(year, month, d, 0, 0, 0, DateTimeKind.Utc);
                var dayEnd = dayUtc.AddDays(1);
                var dow    = dayUtc.DayOfWeek;

                var dayWorkers = workers
                    .Where(w => BookingSlotHelper.WorkerWorksOnDay(w.WorkingDays, dow))
                    .ToList();

                if (dayWorkers.Count == 0)
                {
                    result.Add(new SubBookingDayAvailabilityDto
                    {
                        Date           = dayUtc.ToString("yyyy-MM-dd"),
                        Color          = "red",
                        AvailableSlots = 0,
                        TotalSlots     = 0,
                    });
                    continue;
                }

                var dayAssigned    = monthAssigned.Where(b => b.ScheduledDate >= dayUtc && b.ScheduledDate < dayEnd).ToList();
                var daySubAssigned = monthSubAssigned.Where(b => b.ScheduledDate >= dayUtc && b.ScheduledDate < dayEnd).ToList();

                var bookingsByWorker = dayAssigned
                    .Where(b => b.AssignedWorkerId.HasValue)
                    .GroupBy(b => b.AssignedWorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());
                var subByWorker = daySubAssigned
                    .Where(b => b.WorkerId.HasValue)
                    .GroupBy(b => b.WorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var candidates = BookingSlotHelper.BuildCandidateStartSlots(durationMinutes);
                int totalSlots = candidates.Count;
                int availCount = 0;

                foreach (var slot in candidates)
                {
                    if (BookingSlotHelper.IsSlotInPast(dayUtc, slot)) { totalSlots--; continue; }
                    if (SlotHasWorkerCoverage(slot, durationMinutes, dow, dayWorkers, bookingsByWorker, subByWorker, autoAssign, workerTravelBuffer))
                        availCount++;
                }

                double pct   = totalSlots > 0 ? 1.0 - (double)availCount / totalSlots : 1.0;
                string color = availCount == 0 ? "red"
                             : pct <= 0.33     ? "green"
                             : pct <= 0.66     ? "yellow"
                                               : "red";

                result.Add(new SubBookingDayAvailabilityDto
                {
                    Date           = dayUtc.ToString("yyyy-MM-dd"),
                    Color          = color,
                    AvailableSlots = availCount,
                    TotalSlots     = totalSlots,
                });
            }

            return (result, null);
        }

        public async Task<(IEnumerable<SubBookingSlotDto>? Result, string? Error)> GetSlotsAsync(string date, int packageId)
        {
            if (!DateTime.TryParse(date, out var parsedDate))
                return (null, "Invalid date.");

            var dayStart = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);
            var dayEnd   = dayStart.AddDays(1);
            var dow      = dayStart.DayOfWeek;

            var durationMinutes = await ResolveDurationAsync(packageId);
            var workerTravelBuffer = await GetWorkerTravelBufferMinutesAsync();

            var workers = await _context.Staff.AsNoTracking().Where(s => s.IsActive).ToListAsync();
            var availableWorkers = workers.Where(w => BookingSlotHelper.WorkerWorksOnDay(w.WorkingDays, dow)).ToList();

            if (availableWorkers.Count == 0)
                return (new List<SubBookingSlotDto>(), null);

            var workerIds = availableWorkers.Select(w => w.Id).ToList();
            var autoAssign = await IsAutoAssignEnabledAsync();

            var assignedBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue
                         && workerIds.Contains(b.AssignedWorkerId.Value)
                         && b.ScheduledDate >= dayStart && b.ScheduledDate < dayEnd
                         && b.Status != BookingStatus.Cancelled
                         && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var assignedSubBookings = await _context.SubscriptionBookings
                .Where(b => b.WorkerId.HasValue
                         && workerIds.Contains(b.WorkerId.Value)
                         && b.ScheduledDate >= dayStart && b.ScheduledDate < dayEnd
                         && b.Status != SubscriptionBookingStatus.Cancelled)
                .ToListAsync();

            var bookingsByWorker = assignedBookings
                .Where(b => b.AssignedWorkerId.HasValue)
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
            var subByWorker = assignedSubBookings
                .Where(b => b.WorkerId.HasValue)
                .GroupBy(b => b.WorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var validSlots = new List<SubBookingSlotDto>();
            foreach (var startSlot in BookingSlotHelper.BuildCandidateStartSlots(durationMinutes))
            {
                if (BookingSlotHelper.IsSlotInPast(dayStart, startSlot)) continue;
                if (!SlotHasWorkerCoverage(startSlot, durationMinutes, dow, availableWorkers, bookingsByWorker, subByWorker, autoAssign, workerTravelBuffer))
                    continue;

                validSlots.Add(new SubBookingSlotDto
                {
                    Slot         = startSlot,
                    Available    = true,
                    BookingCount = 0,
                    MaxBookings  = availableWorkers.Count,
                });
            }

            return (validSlots, null);
        }

        public async Task<(IEnumerable<SubscriptionBookingDto>? Result, string? Error)> CreateBookingsAsync(CreateSubscriptionBookingsDto dto, int userId)
        {
            if (dto.Items == null || dto.Items.Count == 0)
                return (null, "At least one booking item is required.");

            var activeSub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active);

            if (activeSub == null)
                return (null, "You don't have an active subscription.");

            var discountPct = activeSub.Plan?.DiscountPercent ?? 0;
            var created     = new List<SubscriptionBooking>();

            foreach (var item in dto.Items)
            {
                Package? package = null;
                decimal originalAmount = 0;

                if (item.PackageId > 0)
                {
                    package = await _context.Packages.FirstOrDefaultAsync(p => p.Id == item.PackageId && p.IsActive);
                    if (package == null)
                        return (null, $"Package {item.PackageId} not found or unavailable.");
                    originalAmount = package.Price;
                }

                var discountAmount = Math.Round(originalAmount * discountPct / 100, 2);
                var finalAmount    = originalAmount - discountAmount;
                var bookingNumber  = $"SB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..5].ToUpper()}";

                var booking = new SubscriptionBooking
                {
                    BookingNumber      = bookingNumber,
                    UserId             = userId,
                    UserSubscriptionId = activeSub.Id,
                    PackageId          = item.PackageId > 0 ? item.PackageId : null,
                    ScheduledDate      = item.ScheduledDate.ToUniversalTime(),
                    TimeSlot           = item.TimeSlot,
                    Status             = SubscriptionBookingStatus.Pending,
                    OriginalAmount     = originalAmount,
                    DiscountAmount     = discountAmount,
                    FinalAmount        = finalAmount,
                    Notes              = item.Notes,
                    CreatedAt          = DateTime.UtcNow,
                    UpdatedAt          = DateTime.UtcNow,
                };

                _context.SubscriptionBookings.Add(booking);
                created.Add(booking);
            }

            await _context.SaveChangesAsync();
            return (created.Select(b => ToDto(b, activeSub, null, null, null)), null);
        }

        public async Task<IEnumerable<SubscriptionBookingDto>> GetMyBookingsAsync(int userId)
        {
            var bookings = await _context.SubscriptionBookings
                .Include(b => b.UserSubscription).ThenInclude(s => s!.Plan)
                .Include(b => b.Package)
                .Include(b => b.Worker)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();

            return bookings.Select(b => ToDto(b, b.UserSubscription, b.Package, b.Worker, null));
        }

        public async Task<(string? Error, int StatusCode)> CancelBookingAsync(int id, int userId)
        {
            var booking = await _context.SubscriptionBookings.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            if (booking == null) return ("Not found.", 404);

            if (booking.Status != SubscriptionBookingStatus.Pending && booking.Status != SubscriptionBookingStatus.Confirmed)
                return ("Booking cannot be cancelled at this stage.", 400);

            booking.Status    = SubscriptionBookingStatus.Cancelled;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<IEnumerable<SubscriptionBookingDto>> GetAllBookingsAsync(string? status)
        {
            var query = _context.SubscriptionBookings
                .Include(b => b.User)
                .Include(b => b.UserSubscription).ThenInclude(s => s!.Plan)
                .Include(b => b.Package)
                .Include(b => b.Worker)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<SubscriptionBookingStatus>(status, true, out var statusEnum))
                query = query.Where(b => b.Status == statusEnum);

            var bookings = await query.OrderByDescending(b => b.CreatedAt).ToListAsync();
            return bookings.Select(b => ToDto(b, b.UserSubscription, b.Package, b.Worker, b.User));
        }

        public async Task<(SubscriptionBookingDto? Result, string? Error)> UpdateBookingAsync(int id, UpdateSubscriptionBookingDto dto)
        {
            var booking = await _context.SubscriptionBookings
                .Include(b => b.User)
                .Include(b => b.UserSubscription).ThenInclude(s => s!.Plan)
                .Include(b => b.Package)
                .Include(b => b.Worker)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return (null, "Not found.");

            if (dto.WorkerId.HasValue) booking.WorkerId = dto.WorkerId;
            if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<SubscriptionBookingStatus>(dto.Status, true, out var statusEnum))
                booking.Status = statusEnum;
            if (dto.Notes != null) booking.Notes = dto.Notes;

            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            StaffEntity? worker = null;
            if (booking.WorkerId.HasValue)
                worker = await _context.Staff.FindAsync(booking.WorkerId);

            return (ToDto(booking, booking.UserSubscription, booking.Package, worker, booking.User), null);
        }

        // ── Private helpers ──────────────────────────────────────────────────

        private async Task<int> ResolveDurationAsync(int packageId)
        {
            if (packageId > 0)
            {
                var pkgDur = await _context.Packages.AsNoTracking()
                    .Where(p => p.Id == packageId && p.IsActive)
                    .Select(p => (int?)p.EstimatedDurationMinutes)
                    .FirstOrDefaultAsync();
                return Math.Max(30, pkgDur ?? 60);
            }

            var minDur = await _context.Packages.AsNoTracking()
                .Where(p => p.IsActive && p.EstimatedDurationMinutes > 0)
                .Select(p => (int?)p.EstimatedDurationMinutes)
                .MinAsync();
            return Math.Max(30, minDur ?? 60);
        }

        private async Task<bool> IsAutoAssignEnabledAsync()
        {
            var setting = await _context.SystemSettings.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == AutoAssignSettingKey);
            if (setting == null || string.IsNullOrWhiteSpace(setting.Value))
                return _configuration.GetValue("Bookings:AutoAssignEnabled", true);
            return bool.TryParse(setting.Value, out var parsed)
                ? parsed
                : _configuration.GetValue("Bookings:AutoAssignEnabled", true);
        }

        private async Task<int> GetWorkerTravelBufferMinutesAsync()
        {
            var setting = await _context.SystemSettings.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "booking.workerTravelBufferMinutes");
            if (setting != null && int.TryParse(setting.Value, out var parsed) && parsed >= 0)
                return parsed;
            return 30;
        }

        private static bool SlotHasWorkerCoverage(
            string slot,
            int durationMinutes,
            DayOfWeek dow,
            List<StaffEntity> availableWorkers,
            Dictionary<int, List<BookingEntity>> bookingsByWorker,
            Dictionary<int, List<SubscriptionBooking>> subByWorker,
            bool autoAssign,
            int workerTravelBuffer = 30)
        {
            bool WorkerIsFree(StaffEntity w)
            {
                var (ss, se) = BookingSlotHelper.GetWorkerShiftForDay(w, dow);
                if (!BookingSlotHelper.TimeSlotFitsInShift(slot, durationMinutes, ss, se, workerTravelBuffer))
                    return false;

                var wb = bookingsByWorker.TryGetValue(w.Id, out var a) ? a : new List<BookingEntity>();
                if (BookingSlotHelper.HasWorkerConflict(wb, slot, durationMinutes, workerTravelBuffer))
                    return false;

                if (subByWorker.TryGetValue(w.Id, out var subs))
                    foreach (var sub in subs)
                    {
                        var subDur = BookingSlotHelper.ResolveSlotDuration(sub.TimeSlot, 60);
                        if (BookingSlotHelper.HasRawSlotConflict(sub.TimeSlot, subDur, slot, durationMinutes, workerTravelBuffer))
                            return false;
                    }

                return true;
            }

            var hasCoverage = availableWorkers.Any(WorkerIsFree);
            if (!hasCoverage) return false;

            if (!autoAssign)
            {
                var eligible = availableWorkers
                    .Where(w =>
                    {
                        var (ss, se) = BookingSlotHelper.GetWorkerShiftForDay(w, dow);
                        return BookingSlotHelper.TimeSlotFitsInShift(slot, durationMinutes, ss, se, workerTravelBuffer);
                    })
                    .ToList();

                if (eligible.Count == 0) return false;
                if (eligible.All(w => !WorkerIsFree(w))) return false;
            }

            return true;
        }

        private static SubscriptionBookingDto ToDto(
            SubscriptionBooking b,
            UserSubscription? sub,
            Package? package,
            StaffEntity? worker,
            User? customer)
        {
            return new SubscriptionBookingDto
            {
                Id                 = b.Id,
                BookingNumber      = b.BookingNumber,
                UserId             = b.UserId,
                CustomerName       = customer != null ? $"{customer.FirstName} {customer.LastName}".Trim() : null,
                CustomerEmail      = customer?.Email,
                UserSubscriptionId = b.UserSubscriptionId,
                PlanName           = sub?.Plan?.Name,
                PackageId          = b.PackageId,
                PackageName        = package?.Name,
                PackagePrice       = package?.Price ?? 0,
                ScheduledDate      = b.ScheduledDate,
                TimeSlot           = b.TimeSlot,
                Status             = b.Status.ToString(),
                OriginalAmount     = b.OriginalAmount,
                DiscountAmount     = b.DiscountAmount,
                FinalAmount        = b.FinalAmount,
                WorkerId           = b.WorkerId,
                WorkerName         = worker != null ? $"{worker.FirstName} {worker.LastName}".Trim() : null,
                Notes              = b.Notes,
                CreatedAt          = b.CreatedAt,
            };
        }
    }
}
