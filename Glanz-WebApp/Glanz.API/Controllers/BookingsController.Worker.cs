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
        [Authorize(Roles = "Employee")]
        [HttpGet("Employee")]
        public async Task<ActionResult<IEnumerable<BookingDto>>> GetWorkerBookings()
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

                // â”€â”€ Update Customer Stats (CRM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (booking.UserId.HasValue)
                {
                    var customer = await _context.Users.FindAsync(booking.UserId.Value);
                    if (customer != null)
                    {
                        customer.TotalSpent += booking.TotalAmount;
                        customer.TotalBookingsCount += 1;
                        customer.LastBookedDate = booking.ScheduledDate;
                        customer.UpdatedAt = DateTime.UtcNow;
                    }
                }

                // â”€â”€ Stripe payment capture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Capture the pre-authorised Stripe PaymentIntent so the customer is charged.
                // Production: calls Stripe CaptureAsync (real money collected).
                // Development: simulates capture locally â€” no real charge, Stripe test mode still works.
                // Tap Payments: capture happens automatically on the Tap-hosted page.
                // When Tap confirms payment it sends a webhook to POST /api/Webhooks/tap
                // which sets PaymentStatus = Paid. No server-side capture call needed.
                string stripeCapture = "TapPayment";
                if (booking.PaymentStatus == PaymentStatus.PreAuthorized || booking.PaymentStatus == PaymentStatus.Paid)
                {
                    booking.PaymentStatus = PaymentStatus.Paid;
                    Console.WriteLine($"[FinishJob] Booking {booking.BookingNumber} marked Paid (Tap charge: {booking.StripePaymentIntentId}).");
                }

                await _context.SaveChangesAsync();

                // Audit: payment capture result
                await _audit.LogAsync(
                    action:     "JobCompleted",
                    userId:     userId,
                    userEmail:  booking.CustomerEmail,
                    entityType: "Booking",
                    entityId:   booking.BookingNumber,
                    metadata: new
                    {
                        bookingNumber  = booking.BookingNumber,
                        totalAmount    = booking.TotalAmount,
                        paymentStatus  = booking.PaymentStatus.ToString(),
                        stripeCapture,
                    });

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
                    stripeCapture,
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

                var fileName = $"{id}_{dto.PhotoType}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{ext}";
                var storedPhoto = await _objectStorage.UploadAsync(file, "booking-photos", fileName);

                if (!Enum.TryParse<PhotoType>(dto.PhotoType, ignoreCase: true, out var photoType))
                    return BadRequest(new { message = "PhotoType must be 'Before' or 'After'" });

                var photo = new BookingPhoto
                {
                    BookingId          = id,
                    PhotoType          = photoType,
                    ImageUrl           = storedPhoto.PublicUrl,
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
