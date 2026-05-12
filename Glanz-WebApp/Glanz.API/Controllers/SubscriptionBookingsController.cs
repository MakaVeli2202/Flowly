using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SubscriptionBookingsController : ControllerBase
    {
        private const string AutoAssignSettingKey = "bookings.autoAssignEnabled";

        private readonly AppDbContext    _context;
        private readonly IConfiguration _configuration;

        public SubscriptionBookingsController(AppDbContext context, IConfiguration configuration)
        {
            _context       = context;
            _configuration = configuration;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        private bool IsAdmin() => User.IsInRole("Admin");

        // GET /api/subscriptionbookings/availability?month=6&year=2026[&packageId=5]
        [HttpGet("availability")]
        [Authorize]
        public async Task<IActionResult> GetAvailability(
            [FromQuery] int month,
            [FromQuery] int year,
            [FromQuery] int packageId = 0)
        {
            if (month < 1 || month > 12 || year < 2020 || year > 2100)
                return BadRequest("Invalid month/year.");

            var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var to   = from.AddMonths(1);

            var durationMinutes = await ResolveDurationAsync(packageId);
            var workerTravelBufferMonthly = await GetWorkerTravelBufferMinutesAsync();

            // Load workers once for the whole month
            var workers = await _context.Staff.AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var workerIds = workers.Select(w => w.Id).ToList();

            // Load all assigned regular bookings for the month
            var monthAssigned = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue
                         && workerIds.Contains(b.AssignedWorkerId.Value)
                         && b.ScheduledDate >= from && b.ScheduledDate < to
                         && b.Status != BookingStatus.Cancelled
                         && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            // Load all assigned subscription bookings for the month
            var monthSubAssigned = await _context.SubscriptionBookings
                .Where(b => b.WorkerId.HasValue
                         && workerIds.Contains(b.WorkerId.Value)
                         && b.ScheduledDate >= from && b.ScheduledDate < to
                         && b.Status != SubscriptionBookingStatus.Cancelled)
                .ToListAsync();

            var autoAssign = await IsAutoAssignEnabledAsync();
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var result = new List<SubBookingDayAvailabilityDto>();

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

                // Slice bookings to this day
                var dayAssigned = monthAssigned
                    .Where(b => b.ScheduledDate >= dayUtc && b.ScheduledDate < dayEnd)
                    .ToList();
                var daySubAssigned = monthSubAssigned
                    .Where(b => b.ScheduledDate >= dayUtc && b.ScheduledDate < dayEnd)
                    .ToList();

                var bookingsByWorker = dayAssigned
                    .Where(b => b.AssignedWorkerId.HasValue)
                    .GroupBy(b => b.AssignedWorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());
                var subByWorker = daySubAssigned
                    .Where(b => b.WorkerId.HasValue)
                    .GroupBy(b => b.WorkerId!.Value)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var candidates   = BookingSlotHelper.BuildCandidateStartSlots(durationMinutes);
                int totalSlots   = candidates.Count;
                int availCount   = 0;

                foreach (var slot in candidates)
                {
                    if (BookingSlotHelper.IsSlotInPast(dayUtc, slot))
                    {
                        totalSlots--;
                        continue;
                    }

                    if (!SlotHasWorkerCoverage(slot, durationMinutes, dow,
                            dayWorkers, bookingsByWorker, subByWorker, autoAssign, workerTravelBufferMonthly))
                        continue;

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

            return Ok(result);
        }

        // GET /api/subscriptionbookings/slots?date=2026-06-15[&packageId=5]
        [HttpGet("slots")]
        [Authorize]
        public async Task<IActionResult> GetSlots(
            [FromQuery] string date,
            [FromQuery] int    packageId = 0)
        {
            if (!DateTime.TryParse(date, out var parsedDate))
                return BadRequest("Invalid date.");

            var dayStart = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);
            var dayEnd   = dayStart.AddDays(1);
            var dow      = dayStart.DayOfWeek;

            var durationMinutes = await ResolveDurationAsync(packageId);
            var workerTravelBufferSlots = await GetWorkerTravelBufferMinutesAsync();

            var workers = await _context.Staff.AsNoTracking()
                .Where(s => s.IsActive)
                .ToListAsync();

            var availableWorkers = workers
                .Where(w => BookingSlotHelper.WorkerWorksOnDay(w.WorkingDays, dow))
                .ToList();

            if (availableWorkers.Count == 0)
                return Ok(new List<SubBookingSlotDto>());

            var workerIds = availableWorkers.Select(w => w.Id).ToList();

            // Load assigned regular bookings for this day
            var assignedBookings = await _context.Bookings
                .Where(b => b.AssignedWorkerId.HasValue
                         && workerIds.Contains(b.AssignedWorkerId.Value)
                         && b.ScheduledDate >= dayStart && b.ScheduledDate < dayEnd
                         && b.Status != BookingStatus.Cancelled
                         && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            // Load assigned subscription bookings for this day (they also occupy worker time)
            var assignedSubBookings = await _context.SubscriptionBookings
                .Where(b => b.WorkerId.HasValue
                         && workerIds.Contains(b.WorkerId.Value)
                         && b.ScheduledDate >= dayStart && b.ScheduledDate < dayEnd
                         && b.Status != SubscriptionBookingStatus.Cancelled)
                .ToListAsync();

            var autoAssign        = await IsAutoAssignEnabledAsync();
            var bookingsByWorker  = assignedBookings
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
                if (BookingSlotHelper.IsSlotInPast(dayStart, startSlot))
                    continue;

                if (!SlotHasWorkerCoverage(startSlot, durationMinutes, dow,
                        availableWorkers, bookingsByWorker, subByWorker, autoAssign, workerTravelBufferSlots))
                    continue;

                validSlots.Add(new SubBookingSlotDto
                {
                    Slot         = startSlot,
                    Available    = true,
                    BookingCount = 0,
                    MaxBookings  = availableWorkers.Count,
                });
            }

            return Ok(validSlots);
        }

        // POST /api/subscriptionbookings
        [HttpPost]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> CreateBookings([FromBody] CreateSubscriptionBookingsDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            if (dto.Items == null || dto.Items.Count == 0)
                return BadRequest(new { message = "At least one booking item is required." });

            var activeSub = await _context.UserSubscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Status == UserSubscriptionStatus.Active);

            if (activeSub == null)
                return BadRequest(new { message = "You don't have an active subscription." });

            var discountPct = activeSub.Plan?.DiscountPercent ?? 0;
            var created = new List<SubscriptionBooking>();

            foreach (var item in dto.Items)
            {
                Package? package = null;
                decimal originalAmount = 0;

                if (item.PackageId > 0)
                {
                    package = await _context.Packages.FirstOrDefaultAsync(p => p.Id == item.PackageId && p.IsActive);
                    if (package == null)
                        return BadRequest(new { message = $"Package {item.PackageId} not found or unavailable." });
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

            return Ok(created.Select(b => ToDto(b, activeSub, null, null, null, null)));
        }

        // GET /api/subscriptionbookings/my
        [HttpGet("my")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetMyBookings()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var bookings = await _context.SubscriptionBookings
                .Include(b => b.UserSubscription).ThenInclude(s => s!.Plan)
                .Include(b => b.Package)
                .Include(b => b.Worker)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();

            return Ok(bookings.Select(b => ToDto(b, b.UserSubscription, b.Package, b.Worker, null, null)));
        }

        // DELETE /api/subscriptionbookings/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var booking = await _context.SubscriptionBookings.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            if (booking == null) return NotFound();

            if (booking.Status != SubscriptionBookingStatus.Pending && booking.Status != SubscriptionBookingStatus.Confirmed)
                return BadRequest(new { message = "Booking cannot be cancelled at this stage." });

            booking.Status = SubscriptionBookingStatus.Cancelled;
            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Booking cancelled." });
        }

        // GET /api/subscriptionbookings/admin
        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllBookings([FromQuery] string? status)
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
            return Ok(bookings.Select(b => ToDto(b, b.UserSubscription, b.Package, b.Worker, b.User, null)));
        }

        // PUT /api/subscriptionbookings/admin/{id}
        [HttpPut("admin/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateSubscriptionBookingDto dto)
        {
            var booking = await _context.SubscriptionBookings
                .Include(b => b.User)
                .Include(b => b.UserSubscription).ThenInclude(s => s!.Plan)
                .Include(b => b.Package)
                .Include(b => b.Worker)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (booking == null) return NotFound();

            if (dto.WorkerId.HasValue)
                booking.WorkerId = dto.WorkerId;

            if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<SubscriptionBookingStatus>(dto.Status, true, out var statusEnum))
                booking.Status = statusEnum;

            if (dto.Notes != null)
                booking.Notes = dto.Notes;

            booking.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            Staff? worker = null;
            if (booking.WorkerId.HasValue)
                worker = await _context.Staff.FindAsync(booking.WorkerId);

            return Ok(ToDto(booking, booking.UserSubscription, booking.Package, worker, booking.User, null));
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
            var setting = await _context.SystemSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "booking.workerTravelBufferMinutes");

            if (setting != null && int.TryParse(setting.Value, out var parsed) && parsed >= 0)
                return parsed;

            return 30; // safe fallback matches seed value
        }

        /// <summary>
        /// Returns true when at least one worker can cover <paramref name="slot"/>.
        /// Mirrors the check in BookingsController.GetAvailableSlots exactly.
        /// </summary>
        private static bool SlotHasWorkerCoverage(
            string                                   slot,
            int                                      durationMinutes,
            DayOfWeek                                dow,
            List<Staff>                              availableWorkers,
            Dictionary<int, List<Booking>>           bookingsByWorker,
            Dictionary<int, List<SubscriptionBooking>> subByWorker,
            bool                                     autoAssign,
            int                                      workerTravelBuffer = 30)
        {
            bool WorkerIsFree(Staff w)
            {
                var (ss, se) = BookingSlotHelper.GetWorkerShiftForDay(w, dow);
                if (!BookingSlotHelper.TimeSlotFitsInShift(slot, durationMinutes, ss, se, workerTravelBuffer))
                    return false;

                var wb = bookingsByWorker.TryGetValue(w.Id, out var a) ? a : new List<Booking>();
                if (BookingSlotHelper.HasWorkerConflict(wb, slot, durationMinutes, workerTravelBuffer))
                    return false;

                // Also respect subscription-booking occupancy for this worker
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

                // Only block if NO eligible worker is free
                if (eligible.All(w => !WorkerIsFree(w))) return false;
            }

            return true;
        }

        private static SubscriptionBookingDto ToDto(
            SubscriptionBooking b,
            UserSubscription? sub,
            Package? package,
            Staff? worker,
            User? customer,
            object? _unused)
        {
            return new SubscriptionBookingDto
            {
                Id = b.Id,
                BookingNumber = b.BookingNumber,
                UserId = b.UserId,
                CustomerName = customer != null ? $"{customer.FirstName} {customer.LastName}".Trim() : null,
                CustomerEmail = customer?.Email,
                UserSubscriptionId = b.UserSubscriptionId,
                PlanName = sub?.Plan?.Name,
                PackageId = b.PackageId,
                PackageName = package?.Name,
                PackagePrice = package?.Price ?? 0,
                ScheduledDate = b.ScheduledDate,
                TimeSlot = b.TimeSlot,
                Status = b.Status.ToString(),
                OriginalAmount = b.OriginalAmount,
                DiscountAmount = b.DiscountAmount,
                FinalAmount = b.FinalAmount,
                WorkerId = b.WorkerId,
                WorkerName = worker != null ? $"{worker.FirstName} {worker.LastName}".Trim() : null,
                Notes = b.Notes,
                CreatedAt = b.CreatedAt,
            };
        }
    }
}
