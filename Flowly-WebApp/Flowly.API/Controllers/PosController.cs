using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Controllers
{
    /// <summary>POS walk-in mode: front desk creates bookings on behalf of walk-in customers.</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class PosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly TenantContext _tenant;

        public PosController(AppDbContext context, TenantContext tenant)
        {
            _context = context;
            _tenant = tenant;
        }

        /// <summary>Quick look-up of customer by phone or email for POS auto-fill.</summary>
        [HttpGet("customer-lookup")]
        public async Task<IActionResult> CustomerLookup([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q)) return BadRequest(new { message = "Query required." });
            q = q.Trim().ToLowerInvariant();
            var users = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive &&
                    (u.Email.ToLower().Contains(q) || (u.Phone != null && u.Phone.Contains(q)) ||
                     u.FirstName.ToLower().Contains(q) || u.LastName.ToLower().Contains(q)))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email, Phone = u.Phone })
                .Take(10)
                .ToListAsync();
            return Ok(users);
        }

        /// <summary>
        /// Create a walk-in booking. Payment is collected in-person (Cash/POS terminal).
        /// Sets PaymentStatus = Paid and Status = Confirmed immediately.
        /// </summary>
        [HttpPost("walk-in")]
        public async Task<IActionResult> CreateWalkIn([FromBody] PosWalkInDto dto)
        {
            var package = await _context.Packages.FindAsync(dto.PackageId);
            if (package == null || !package.IsActive) return BadRequest(new { message = "Package not found." });

            var multiplier = dto.VehicleType switch
            {
                VehicleType.Motorcycle => 0.8m,
                VehicleType.SUV => 1.25m,
                VehicleType.Pickup => 1.5m,
                _ => 1.0m
            };
            var unitPrice = Math.Round(package.Price * multiplier, 2);
            var total = dto.AmountOverride.HasValue ? dto.AmountOverride.Value : unitPrice;

            var bookingNumber = $"WI-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}";

            var booking = new Booking
            {
                BookingNumber = bookingNumber,
                UserId = dto.UserId,
                CustomerName = dto.CustomerName,
                CustomerEmail = dto.CustomerEmail ?? string.Empty,
                CustomerPhone = dto.CustomerPhone ?? string.Empty,
                CustomerAddress = dto.CustomerAddress ?? "Walk-in",
                VehicleType = dto.VehicleType,
                ScheduledDate = dto.ScheduledDate.ToUniversalTime(),
                TimeSlot = dto.TimeSlot,
                Status = BookingStatus.Confirmed,
                PaymentStatus = PaymentStatus.Paid,
                TotalAmount = total,
                SpecialInstructions = dto.Notes,
                AssignedWorkerId = dto.AssignedWorkerId,
                BookingItems = new List<BookingItem>
                {
                    new BookingItem
                    {
                        PackageId = package.Id,
                        Quantity = 1,
                        Price = unitPrice,
                        SnapshotDurationMinutes = package.EstimatedDurationMinutes
                    }
                }
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                booking.Id,
                booking.BookingNumber,
                booking.TotalAmount,
                booking.Status,
                booking.PaymentStatus,
                PaymentMethod = dto.PaymentMethod
            });
        }

        /// <summary>Record a cash or terminal payment against an existing booking (used when payment is collected separately).</summary>
        [HttpPost("record-payment/{bookingId}")]
        public async Task<IActionResult> RecordPayment(int bookingId, [FromBody] PosPaymentDto dto)
        {
            var booking = await _context.Bookings.FindAsync(bookingId);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            if (booking.PaymentStatus == PaymentStatus.Paid)
                return BadRequest(new { message = "Booking is already paid." });

            booking.PaymentStatus = PaymentStatus.Paid;
            if (dto.Amount.HasValue) booking.TotalAmount = dto.Amount.Value;
            booking.SpecialInstructions = string.IsNullOrWhiteSpace(booking.SpecialInstructions)
                ? $"Payment: {dto.Method}"
                : $"{booking.SpecialInstructions} | Payment: {dto.Method}";

            await _context.SaveChangesAsync();
            return Ok(new { booking.Id, booking.PaymentStatus, booking.TotalAmount });
        }

        /// <summary>Daily POS summary: completed walk-ins and cash totals for shift close.</summary>
        [HttpGet("daily-summary")]
        public async Task<IActionResult> DailySummary([FromQuery] DateTime? date)
        {
            var day = (date ?? DateTime.UtcNow).Date;
            var next = day.AddDays(1);

            var bookings = await _context.Bookings
                .Where(b => b.ScheduledDate >= day && b.ScheduledDate < next &&
                    b.BookingNumber.StartsWith("WI-"))
                .Select(b => new
                {
                    b.Id, b.BookingNumber, b.CustomerName, b.TotalAmount,
                    b.Status, b.PaymentStatus, b.TimeSlot
                })
                .OrderBy(b => b.TimeSlot)
                .ToListAsync();

            return Ok(new
            {
                date = day.ToString("yyyy-MM-dd"),
                walkInCount = bookings.Count,
                totalRevenue = bookings.Sum(b => b.TotalAmount),
                paidCount = bookings.Count(b => b.PaymentStatus == PaymentStatus.Paid),
                bookings
            });
        }
    }

    public class PosWalkInDto
    {
        public int? UserId { get; set; }

        [Required]
        [StringLength(100)]
        public string CustomerName { get; set; } = string.Empty;

        [StringLength(255)]
        [EmailAddress]
        public string? CustomerEmail { get; set; }

        [StringLength(20)]
        public string? CustomerPhone { get; set; }

        [StringLength(500)]
        public string? CustomerAddress { get; set; }

        [Required]
        public int PackageId { get; set; }

        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        [StringLength(20)]
        public string TimeSlot { get; set; } = string.Empty;

        public int? AssignedWorkerId { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        /// <summary>Override price (e.g. for discounts applied at front desk).</summary>
        public decimal? AmountOverride { get; set; }

        /// <summary>Cash, Card, QPay, etc.</summary>
        [StringLength(50)]
        public string PaymentMethod { get; set; } = "Cash";
    }

    public class PosPaymentDto
    {
        [Required]
        [StringLength(50)]
        public string Method { get; set; } = "Cash";
        public decimal? Amount { get; set; }
    }
}
