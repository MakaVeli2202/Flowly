using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using System.Security.Cryptography;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentLinkController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly TenantContext _tenant;

        public PaymentLinkController(AppDbContext db, TenantContext tenant)
        {
            _db = db;
            _tenant = tenant;
        }

        // Admin: generate a payment link for a booking
        [Authorize(Roles = "Admin")]
        [HttpPost("{bookingId}/generate")]
        public async Task<IActionResult> Generate(int bookingId)
        {
            var booking = await _db.Bookings
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .Include(b => b.BookingAddOns)
                .FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return NotFound();

            if (string.IsNullOrEmpty(booking.PaymentLinkToken))
            {
                booking.PaymentLinkToken = GenerateToken();
                booking.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return Ok(new { token = booking.PaymentLinkToken, bookingNumber = booking.BookingNumber });
        }

        // Public: get booking summary for payment page
        [HttpGet("{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByToken(string token)
        {
            var booking = await _db.Bookings
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Include(b => b.BookingItems).ThenInclude(bi => bi.Package)
                .Include(b => b.BookingAddOns)
                .FirstOrDefaultAsync(b => b.PaymentLinkToken == token);

            if (booking == null) return NotFound(new { message = "Payment link not found or expired" });
            if (booking.PaymentStatus == PaymentStatus.Paid)
                return Ok(new { alreadyPaid = true, bookingNumber = booking.BookingNumber });

            return Ok(new
            {
                alreadyPaid = false,
                bookingNumber = booking.BookingNumber,
                customerName = booking.CustomerName,
                scheduledDate = booking.ScheduledDate,
                timeSlot = booking.TimeSlot,
                totalAmount = booking.TotalAmount,
                items = (booking.BookingItems ?? new List<BookingItem>()).Select(i => new
                {
                    name = i.Package?.Name ?? "Service",
                    price = i.Price,
                    qty = i.Quantity
                }),
                addOns = (booking.BookingAddOns ?? new List<BookingAddOn>()).Select(a => new
                {
                    name = a.Name,
                    price = a.Price
                })
            });
        }

        private static string GenerateToken() =>
            Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
    }
}
