using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public StatsController(AppDbContext context)
        {
            _context = context;
        }

        // Public endpoint — no [Authorize]
        [HttpGet]
        public async Task<ActionResult> GetPublicStats()
        {
            try
            {
                var carsDetailed = await _context.Bookings
                    .CountAsync(b => b.Status == BookingStatus.Completed);

                var happyClients = await _context.Bookings
                    .Where(b => b.Status == BookingStatus.Completed && b.UserId != null)
                    .Select(b => b.UserId)
                    .Distinct()
                    .CountAsync();

                var activePackages = await _context.Packages
                    .CountAsync(p => p.IsActive);

                var foundedYear = 2022;
                var yearsActive = DateTime.UtcNow.Year - foundedYear;

                return Ok(new
                {
                    carsDetailed,
                    happyClients,
                    activePackages,
                    yearsActive
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting public stats: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve stats" });
            }
        }
    }
}
