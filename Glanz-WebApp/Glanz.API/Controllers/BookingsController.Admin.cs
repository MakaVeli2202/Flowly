using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.DTOs;
using Glanz.API.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Glanz.API.Controllers
{
    public partial class BookingsController
    {
        [Authorize(Roles = "Admin,Employee")]
        [HttpGet("all")]
        public async Task<ActionResult<PagedBookingsResult>> GetAllBookings(
            [FromQuery] int    page     = 1,
            [FromQuery] int    pageSize = 100,
            [FromQuery] string? search  = null,
            [FromQuery] string? status  = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo   = null)
        {
            try
            {
                page     = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 500);

                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

                IQueryable<Booking> query = _context.Bookings
                    .Include(b => b.BookingItems)
                        .ThenInclude(bi => bi.Package)
                            .ThenInclude(p => p.PackageServices)
                                .ThenInclude(ps => ps.Service)
                    .Include(b => b.ChecklistItems)
                    .Include(b => b.AssignedWorker)
                    .AsQueryable();

                if (User.IsInRole("Employee"))
                {
                    var userId = GetUserId();
                    if (!userId.HasValue) return Unauthorized();
                    query = query.Where(b => b.AssignedWorkerId == userId.Value);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var q = search.Trim().ToLower();
                    query = query.Where(b =>
                        b.BookingNumber.ToLower().Contains(q) ||
                        (b.CustomerName  != null && b.CustomerName.ToLower().Contains(q)) ||
                        (b.CustomerEmail != null && b.CustomerEmail.ToLower().Contains(q)) ||
                        (b.CustomerPhone != null && b.CustomerPhone.ToLower().Contains(q)));
                }

                if (!string.IsNullOrWhiteSpace(status) && status != "All" &&
                    Enum.TryParse<BookingStatus>(status, true, out var parsedStatus))
                {
                    query = query.Where(b => b.Status == parsedStatus);
                }

                if (dateFrom.HasValue)
                    query = query.Where(b => b.ScheduledDate >= dateFrom.Value.ToUniversalTime());

                if (dateTo.HasValue)
                    query = query.Where(b => b.ScheduledDate <= dateTo.Value.ToUniversalTime());

                var totalCount = await query.CountAsync(HttpContext.RequestAborted);
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var bookings = await query
                    .OrderByDescending(b => b.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync(HttpContext.RequestAborted);

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
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? bi.Package.Name)
                            : bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = packageTextMap.TryGetValue(bi.PackageId, out packageText)
                            ? (packageText.Description ?? bi.Package.Description)
                            : bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                                ? (serviceText.Name ?? ps.Service.Name)
                                : ps.Service.Name)
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

                return Ok(new PagedBookingsResult
                {
                    Items      = bookingDtos,
                    TotalCount = totalCount,
                    Page       = page,
                    PageSize   = pageSize,
                    TotalPages = totalPages,
                });
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
                    
                    // Set FirstWashCompletedAt if this is user's first completed wash
                    var user = await _context.Users.FindAsync(booking.UserId.Value);
                    if (user != null && !user.FirstWashCompletedAt.HasValue)
                    {
                        user.FirstWashCompletedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                    
                    // Check and process referral rewards for first completed wash
                    await _referralService.CheckAndRewardReferralAsync(booking.Id, booking.UserId.Value);
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

                // â”€â”€ Tap Payments: cancel is handled via Tap dashboard if needed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Tap charge IDs start with 'chg_'. Legacy Stripe IDs started with 'pi_'.
                // For Tap bookings the charge was already captured on the Tap page so there
                // is nothing to void here; refunds are issued from the Tap merchant portal.
                if (!string.IsNullOrEmpty(booking.StripePaymentIntentId)
                    && booking.PaymentStatus == PaymentStatus.PreAuthorized)
                {
                    booking.PaymentStatus = PaymentStatus.Refunded; // mark as not-charged
                    Console.WriteLine($"[CancelBooking] Charge {booking.StripePaymentIntentId} â€” refund via Tap dashboard if needed.");
                }

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

                await _audit.LogAsync("BookingCancelled", userId, booking.CustomerEmail, "Booking",
                    booking.BookingNumber, new { bookingNumber = booking.BookingNumber, initiatedBy = "Customer" });

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

                // Tap Payments: refunds are processed manually via the Tap dashboard.
                // Tap charge IDs start with 'chg_'; legacy Stripe IDs started with 'pi_'.
                if (!string.IsNullOrEmpty(booking.StripePaymentIntentId))
                {
                    stripeAction = "TapPayment-ManualRefund";
                    Console.WriteLine($"[AdminCancel] Tap charge {booking.StripePaymentIntentId} for booking {booking.BookingNumber} â€” refund via Tap dashboard.");
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

                var adminId = GetUserId();
                await _audit.LogAsync("BookingCancelled", adminId, booking.CustomerEmail, "Booking",
                    booking.BookingNumber, new { bookingNumber = booking.BookingNumber, initiatedBy = "Admin", stripeAction });
                if (stripeAction == "Refunded")
                    await _audit.LogAsync("RefundIssued", adminId, booking.CustomerEmail, "Booking",
                        booking.BookingNumber, new { bookingNumber = booking.BookingNumber, refundedAmount, stripeRefundId });

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
            catch (Exception ex)
            {
                Console.WriteLine($"Admin cancel/refund error: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to cancel and refund: {ex.Message}" });
            }
        }

        [HttpPost("{id}/add-package")]
        public async Task<ActionResult<BookingDto>> AddPackagesToBooking(int id, [FromBody] AddBookingPackageDto dto)
        {
            try
            {
                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

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
                var vehicleMultipliers = await _pricingService.GetVehicleMultipliersAsync();
                var vehicleMultiplier = vehicleMultipliers.TryGetValue(booking.VehicleType, out var vm4326) ? vm4326 : 1.0m;
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
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? bi.Package.Name)
                            : bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = packageTextMap.TryGetValue(bi.PackageId, out packageText)
                            ? (packageText.Description ?? bi.Package.Description)
                            : bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                                ? (serviceText.Name ?? ps.Service.Name)
                                : ps.Service.Name)
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
                var lang = ResolveRequestedLanguage();
                var packageTextMap = await _localizationTextResolver.GetPackageTextsAsync(lang, HttpContext.RequestAborted);
                var serviceTextMap = await _localizationTextResolver.GetServiceTextsAsync(lang, HttpContext.RequestAborted);

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
                var vehicleMultipliers4592 = await _pricingService.GetVehicleMultipliersAsync();
                var vehicleMultiplier = vehicleMultipliers4592.TryGetValue(booking.VehicleType, out var vm4592) ? vm4592 : 1.0m;
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
                        PackageName = packageTextMap.TryGetValue(bi.PackageId, out var packageText)
                            ? (packageText.Name ?? bi.Package.Name)
                            : bi.Package.Name,
                        PackageTier = bi.Package.Tier,
                        PackageDescription = packageTextMap.TryGetValue(bi.PackageId, out packageText)
                            ? (packageText.Description ?? bi.Package.Description)
                            : bi.Package.Description,
                        IncludedServices = bi.Package.PackageServices
                            .Select(ps => serviceTextMap.TryGetValue(ps.ServiceId, out var serviceText)
                                ? (serviceText.Name ?? ps.Service.Name)
                                : ps.Service.Name)
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
                    var vehicleMultipliers5115 = await _pricingService.GetVehicleMultipliersAsync();
                    var vehicleMultiplier = vehicleMultipliers5115.TryGetValue(booking.VehicleType, out var vm5115) ? vm5115 : 1.0m;
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

                    var vehicleMultipliers5285 = await _pricingService.GetVehicleMultipliersAsync();
                    var vehicleMultiplier = vehicleMultipliers5285.TryGetValue(booking.VehicleType, out var vm5285) ? vm5285 : 1.0m;
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

            var sameDayWorkerBookings = await _context.Bookings
                .Where(b => b.Id != excludeBookingId
                    && b.AssignedWorkerId.HasValue
                    && workerIds.Contains(b.AssignedWorkerId.Value)
                    && b.ScheduledDate >= date && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var sameDayUnassignedBookings = await _context.Bookings
                .Where(b => b.Id != excludeBookingId
                    && !b.AssignedWorkerId.HasValue
                    && b.ScheduledDate >= date && b.ScheduledDate < dayEnd
                    && b.Status != BookingStatus.Cancelled
                    && b.Status != BookingStatus.Completed)
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .ToListAsync();

            var bookingsByWorker = sameDayWorkerBookings
                .GroupBy(b => b.AssignedWorkerId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<string>();
            foreach (var startSlot in BuildCandidateStartSlots(durationMinutes, dayOfWeek.ToString()))
            {
                var freeWorkerCount = availableWorkers.Count(worker =>
                {
                    var (ss, se) = GetWorkerShiftForDay(worker, dayOfWeek);
                    if (!TimeSlotInWorkerShift(startSlot, durationMinutes, ss, se, workerTravelBuffer))
                        return false;
                    var wb = bookingsByWorker.TryGetValue(worker.Id, out var assigned) ? assigned : new List<Booking>();
                    return !HasWorkerTimeConflict(wb, startSlot, durationMinutes, workerTravelBuffer);
                });

                if (freeWorkerCount == 0) continue;

                var unassignedConflicts = sameDayUnassignedBookings.Count(b =>
                    HasWorkerTimeConflict(new List<Booking> { b }, startSlot, durationMinutes, workerTravelBuffer));

                if (freeWorkerCount > unassignedConflicts) result.Add(startSlot);
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

    }
}
