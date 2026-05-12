using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CrmController : ControllerBase
    {
        private readonly AppDbContext _context;
        private const int AtRiskDaysThreshold = 60;
        private const int NewCustomerDays = 30;

        public CrmController(AppDbContext context)
        {
            _context = context;
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

        [Authorize(Roles = "Admin")]
        [HttpGet("dashboard")]
        public async Task<ActionResult<CrmDashboardDto>> GetCrmDashboard()
        {
            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var monthStart = new DateTime(now.Year, now.Month, 1);

            var completedBookings = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Completed && b.TotalAmount > 0)
                .Select(b => new { b.UserId, b.TotalAmount, b.ScheduledDate })
                .ToListAsync();

            var customerStats = completedBookings
                .Where(b => b.UserId.HasValue)
                .GroupBy(b => b.UserId!.Value)
                .Select(g => new
                {
                    UserId = g.Key,
                    TotalSpent = g.Sum(b => b.TotalAmount),
                    TotalBookings = g.Count(),
                    LastBookedDate = g.Max(b => b.ScheduledDate)
                })
                .ToDictionary(c => c.UserId);

            var customerData = customers.Select(c => {
                customerStats.TryGetValue(c.Id, out var stats);
                var lastBooked = stats?.LastBookedDate;
                var daysSince = lastBooked.HasValue ? (int)(now - lastBooked.Value).TotalDays : int.MaxValue;
                return new
                {
                    c.Id,
                    Name = $"{c.FirstName} {c.LastName}".Trim(),
                    c.Email,
                    c.Phone,
                    c.Tags,
                    TotalSpent = stats?.TotalSpent ?? 0,
                    TotalBookingsCount = stats?.TotalBookings ?? 0,
                    LastBookedDate = lastBooked,
                    c.CreatedAt,
                    DaysSinceLastBooking = daysSince
                };
            }).ToList();

            var activeThisMonth = customerData.Count(c => c.LastBookedDate >= monthStart);
            var atRisk = customerData.Count(c => c.DaysSinceLastBooking > AtRiskDaysThreshold && c.TotalBookingsCount > 0);
            var vip = customerData.Count(c => c.Tags?.Contains("VIP", StringComparison.OrdinalIgnoreCase) == true || c.TotalSpent >= 5000);
            var newCust = customerData.Count(c => (now - c.CreatedAt).TotalDays <= NewCustomerDays);

            var recentAtRisk = customerData
                .Where(c => c.DaysSinceLastBooking > AtRiskDaysThreshold && c.TotalBookingsCount > 0)
                .OrderByDescending(c => c.DaysSinceLastBooking)
                .Take(10)
                .Select(MapToCrmCustomer)
                .ToList();

            var topSpenders = customerData
                .OrderByDescending(c => c.TotalSpent)
                .Take(10)
                .Select(MapToCrmCustomer)
                .ToList();

            return Ok(new CrmDashboardDto
            {
                TotalCustomers = customers.Count,
                ActiveThisMonth = activeThisMonth,
                AtRiskCustomers = atRisk,
                VipCustomers = vip,
                NewCustomers = newCust,
                TotalRevenue = customerData.Sum(c => c.TotalSpent),
                AverageCustomerValue = customers.Count > 0 ? customerData.Average(c => c.TotalSpent) : 0,
                RecentAtRisk = recentAtRisk,
                TopSpenders = topSpenders
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats")]
        public async Task<ActionResult<CrmStatsDto>> GetCrmStats()
        {
            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var complaints = await _context.CustomerFeedbacks
                .Where(cf => cf.Type == FeedbackType.Complaint)
                .ToListAsync();

            var customerData = customers.Select(c => new
            {
                c.Id,
                c.Tags,
                c.TotalSpent,
                c.LastBookedDate,
                c.TotalBookingsCount,
                DaysSinceLastBooking = c.LastBookedDate.HasValue
                    ? (int)(now - c.LastBookedDate.Value).TotalDays
                    : int.MaxValue
            }).ToList();

            var atRisk = customerData.Count(c => c.DaysSinceLastBooking > AtRiskDaysThreshold && c.TotalBookingsCount > 0);
            var vip = customerData.Count(c => c.Tags?.Contains("VIP", StringComparison.OrdinalIgnoreCase) == true);
            var fleet = customerData.Count(c => c.Tags?.Contains("Fleet", StringComparison.OrdinalIgnoreCase) == true);

            return Ok(new CrmStatsDto
            {
                TotalCustomers = customers.Count,
                ActiveCustomers = customerData.Count(c => c.DaysSinceLastBooking <= 30),
                InactiveCustomers = customerData.Count(c => c.DaysSinceLastBooking > 60),
                AtRiskCustomers = atRisk,
                VipCustomers = vip,
                FleetCustomers = fleet,
                AverageLtv = customers.Count > 0 ? customerData.Average(c => c.TotalSpent) : 0,
                TotalRevenue = customerData.Sum(c => c.TotalSpent),
                TotalComplaints = complaints.Count,
                UnresolvedComplaints = complaints.Count(c => !c.IsResolved)
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("booking-sources")]
        public async Task<ActionResult<BookingSourceStatsDto>> GetBookingSourceStats()
        {
            var completedBookings = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Completed && b.PaymentStatus == PaymentStatus.Paid)
                .ToListAsync();

            var sourceGroups = completedBookings
                .GroupBy(b => b.LeadSource)
                .Select(g => new SourceStatItem
                {
                    Source = g.Key.ToString(),
                    Count = g.Count(),
                    Revenue = g.Sum(b => b.TotalAmount)
                })
                .OrderByDescending(s => s.Revenue)
                .ToList();

            return Ok(new BookingSourceStatsDto
            {
                TotalBookings = completedBookings.Count,
                TotalRevenue = completedBookings.Sum(b => b.TotalAmount),
                Sources = sourceGroups
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("customers")]
        public async Task<ActionResult<IEnumerable<CrmCustomerDto>>> GetCrmCustomers([FromQuery] string? segment)
        {
            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .ToListAsync();

            var now = DateTime.UtcNow;

            var completedBookings = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Completed && b.TotalAmount > 0)
                .Select(b => new { b.UserId, b.TotalAmount, b.ScheduledDate })
                .ToListAsync();

            var customerStats = completedBookings
                .Where(b => b.UserId.HasValue)
                .GroupBy(b => b.UserId!.Value)
                .Select(g => new
                {
                    UserId = g.Key,
                    TotalSpent = g.Sum(b => b.TotalAmount),
                    TotalBookings = g.Count(),
                    LastBookedDate = g.Max(b => b.ScheduledDate)
                })
                .ToDictionary(c => c.UserId);

            var result = customers
                .Select(c => {
                    customerStats.TryGetValue(c.Id, out var stats);
                    var lastBooked = stats?.LastBookedDate;
                    var daysSinceLast = lastBooked.HasValue ? (int)(now - lastBooked.Value).TotalDays : int.MaxValue;
                    var totalSpent = stats?.TotalSpent ?? 0;
                    var totalBookings = stats?.TotalBookings ?? 0;
                    
                    var segmentName = DetermineSegmentByData(c.Tags, totalSpent, daysSinceLast, totalBookings, c.CreatedAt);

                    if (!string.IsNullOrEmpty(segment) && segment != "All")
                    {
                        if (segment == "At-Risk" && segmentName != "At-Risk") return null;
                        if (segment == "VIP" && segmentName != "VIP") return null;
                        if (segment == "Active" && daysSinceLast > 30) return null;
                        if (segment == "Inactive" && daysSinceLast <= 60) return null;
                    }

                    return new CrmCustomerDto
                    {
                        Id = c.Id,
                        Name = $"{c.FirstName} {c.LastName}".Trim(),
                        Email = c.Email,
                        Phone = c.Phone,
                        Tags = c.Tags,
                        TotalSpent = totalSpent,
                        TotalBookings = totalBookings,
                        LastBookedDate = lastBooked,
                        DaysSinceLastBooking = daysSinceLast == int.MaxValue ? -1 : daysSinceLast,
                        Segment = segmentName,
                        CreatedAt = c.CreatedAt,
                        IsAtRisk = daysSinceLast > AtRiskDaysThreshold && totalBookings > 0
                    };
                })
                .Where(c => c != null)
                .OrderByDescending(c => c.TotalSpent)
                .ToList();

            return Ok(result);
        }

        private string DetermineSegmentByData(string? tags, decimal totalSpent, int daysSinceLast, int totalBookings, DateTime createdAt)
        {
            var now = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(tags))
            {
                var tagList = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (tagList.Any(t => t.Equals("VIP", StringComparison.OrdinalIgnoreCase)))
                    return "VIP";
                if (tagList.Any(t => t.Equals("Fleet", StringComparison.OrdinalIgnoreCase)))
                    return "Fleet";
            }

            if (totalSpent >= 5000) return "VIP";
            if (daysSinceLast > AtRiskDaysThreshold && totalBookings > 0) return "At-Risk";
            if ((now - createdAt).TotalDays <= NewCustomerDays) return "New";
            if (daysSinceLast > 60) return "Inactive";
            if (totalBookings >= 10) return "Loyal";

            return "Regular";
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("customer/{id}")]
        public async Task<ActionResult<CustomerProfileDto>> GetCustomerProfile(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null || user.Role != "Customer")
            {
                return NotFound(new { message = "Customer not found." });
            }

            return Ok(new CustomerProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                Phone = user.Phone,
                ProfileImageUrl = user.ProfileImageUrl,
                Role = user.Role,
                IsActive = user.IsActive,
                Tags = user.Tags,
                Notes = user.Notes,
                TotalSpent = user.TotalSpent,
                TotalBookingsCount = user.TotalBookingsCount,
                LastBookedDate = user.LastBookedDate,
                CreatedAt = user.CreatedAt,
                IsLoyaltyActive = user.LoyaltyGoogleReviewActivatedAt.HasValue,
                LoyaltyActivatedAt = user.LoyaltyGoogleReviewActivatedAt
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("customer/{id}")]
        public async Task<ActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null || user.Role != "Customer")
            {
                return NotFound(new { message = "Customer not found." });
            }

            if (dto.Tags != null) user.Tags = dto.Tags;
            if (dto.Notes != null) user.Notes = dto.Notes;
            if (dto.TotalSpent.HasValue) user.TotalSpent = dto.TotalSpent.Value;
            if (dto.TotalBookingsCount.HasValue) user.TotalBookingsCount = dto.TotalBookingsCount.Value;

            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Customer updated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("customers/bulk-tag")]
        public async Task<ActionResult> BulkUpdateTags([FromBody] BulkTagDto dto)
        {
            if (dto.CustomerIds == null || dto.CustomerIds.Count == 0)
            {
                return BadRequest(new { message = "No customers selected." });
            }

            var customers = await _context.Users
                .Where(u => dto.CustomerIds.Contains(u.Id) && u.Role == "Customer")
                .ToListAsync();

            foreach (var customer in customers)
            {
                var currentTags = string.IsNullOrWhiteSpace(customer.Tags)
                    ? new List<string>()
                    : customer.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

                if (dto.Remove)
                {
                    currentTags.RemoveAll(t => t.Equals(dto.Tag, StringComparison.OrdinalIgnoreCase));
                }
                else
                {
                    if (!currentTags.Any(t => t.Equals(dto.Tag, StringComparison.OrdinalIgnoreCase)))
                    {
                        currentTags.Add(dto.Tag);
                    }
                }

                customer.Tags = string.Join(", ", currentTags);
                customer.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = $"Updated {customers.Count} customer(s).",
                updated = customers.Count 
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("at-risk")]
        public async Task<ActionResult<IEnumerable<CrmCustomerDto>>> GetAtRiskCustomers()
        {
            var now = DateTime.UtcNow;
            var threshold = now.AddDays(-AtRiskDaysThreshold);

            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive && u.TotalBookingsCount > 0)
                .ToListAsync();

            var result = customers
                .Where(c => c.LastBookedDate.HasValue && c.LastBookedDate < threshold)
                .Select(c => new CrmCustomerDto
                {
                    Id = c.Id,
                    Name = $"{c.FirstName} {c.LastName}".Trim(),
                    Email = c.Email,
                    Phone = c.Phone,
                    Tags = c.Tags,
                    TotalSpent = c.TotalSpent,
                    TotalBookings = c.TotalBookingsCount,
                    LastBookedDate = c.LastBookedDate,
                    DaysSinceLastBooking = c.LastBookedDate.HasValue ? (int)(now - c.LastBookedDate.Value).TotalDays : 0,
                    Segment = "At-Risk",
                    CreatedAt = c.CreatedAt,
                    IsAtRisk = true
                })
                .OrderByDescending(c => c.DaysSinceLastBooking)
                .ToList();

            return Ok(result);
        }

        [HttpPost("feedback")]
        public async Task<ActionResult<FeedbackDto>> SubmitFeedback([FromBody] CreateFeedbackDto dto)
        {
            var userId = GetUserId();

            var feedback = new CustomerFeedback
            {
                UserId = userId,
                BookingId = dto.BookingId,
                Type = dto.Type,
                Rating = dto.Rating ?? 0,
                Comment = dto.Comment,
                IsAnonymous = dto.IsAnonymous,
                WorkerId = dto.WorkerId,
                CreatedAt = DateTime.UtcNow
            };

            _context.CustomerFeedbacks.Add(feedback);
            await _context.SaveChangesAsync();

            return Ok(MapFeedbackToDto(feedback));
        }

        [Authorize]
        [HttpGet("feedback/my")]
        public async Task<ActionResult<IEnumerable<FeedbackDto>>> GetMyFeedback()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var feedback = await _context.CustomerFeedbacks
                .Where(cf => cf.UserId == userId.Value)
                .OrderByDescending(cf => cf.CreatedAt)
                .ToListAsync();

            return Ok(feedback.Select(MapFeedbackToDto));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("feedback")]
        public async Task<ActionResult<IEnumerable<FeedbackDto>>> GetAllFeedback([FromQuery] FeedbackType? type, [FromQuery] bool? resolved)
        {
            var query = _context.CustomerFeedbacks
                .Include(cf => cf.User)
                .Include(cf => cf.Booking)
                .Include(cf => cf.Worker)
                .AsQueryable();

            if (type.HasValue)
            {
                query = query.Where(cf => cf.Type == type.Value);
            }

            if (resolved.HasValue)
            {
                query = query.Where(cf => cf.IsResolved == resolved.Value);
            }

            var feedback = await query
                .OrderByDescending(cf => cf.CreatedAt)
                .ToListAsync();

            return Ok(feedback.Select(f => new FeedbackDto
            {
                Id = f.Id,
                UserId = f.UserId,
                UserName = f.IsAnonymous ? "Anonymous" : (f.User != null ? $"{f.User.FirstName} {f.User.LastName}".Trim() : null),
                BookingId = f.BookingId,
                BookingNumber = f.Booking?.BookingNumber,
                WorkerId = f.WorkerId,
                WorkerName = f.Worker != null ? $"{f.Worker.FirstName} {f.Worker.LastName}".Trim() : null,
                Type = f.Type,
                Rating = f.Rating,
                Comment = f.Comment,
                IsAnonymous = f.IsAnonymous,
                IsResolved = f.IsResolved,
                ResolutionNote = f.ResolutionNote,
                CreatedAt = f.CreatedAt,
                ResolvedAt = f.ResolvedAt
            }));
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("feedback/{id}/resolve")]
        public async Task<ActionResult> ResolveFeedback(int id, [FromBody] ResolveFeedbackDto dto)
        {
            var feedback = await _context.CustomerFeedbacks.FindAsync(id);
            if (feedback == null)
            {
                return NotFound(new { message = "Feedback not found." });
            }

            feedback.IsResolved = true;
            feedback.ResolutionNote = dto.ResolutionNote;
            feedback.ResolvedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Feedback resolved." });
        }

        private string DetermineSegment(User c, int daysSinceLast)
        {
            if (!string.IsNullOrWhiteSpace(c.Tags))
            {
                var tags = c.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (tags.Any(t => t.Equals("VIP", StringComparison.OrdinalIgnoreCase)))
                    return "VIP";
                if (tags.Any(t => t.Equals("Fleet", StringComparison.OrdinalIgnoreCase)))
                    return "Fleet";
            }

            if (c.TotalSpent >= 5000)
                return "VIP";
            if (daysSinceLast > AtRiskDaysThreshold && c.TotalBookingsCount > 0)
                return "At-Risk";
            if ((DateTime.UtcNow - c.CreatedAt).TotalDays <= NewCustomerDays)
                return "New";
            if (daysSinceLast > 60)
                return "Inactive";

            return "Regular";
        }

        private CrmCustomerDto MapToCrmCustomer(dynamic c)
        {
            var daysSinceLast = c.DaysSinceLastBooking == int.MaxValue ? -1 : c.DaysSinceLastBooking;
            
            return new CrmCustomerDto
            {
                Id = c.Id,
                Name = c.Name,
                Email = c.Email,
                Phone = c.Phone,
                Tags = c.Tags,
                TotalSpent = c.TotalSpent,
                TotalBookings = c.TotalBookingsCount,
                LastBookedDate = c.LastBookedDate,
                DaysSinceLastBooking = daysSinceLast,
                Segment = DetermineSegmentByData(c),
                CreatedAt = c.CreatedAt,
                IsAtRisk = daysSinceLast > AtRiskDaysThreshold && c.TotalBookingsCount > 0
            };
        }

        private string DetermineSegmentByData(dynamic c)
        {
            var tags = c.Tags as string;
            var daysSinceLast = c.DaysSinceLastBooking == int.MaxValue ? 9999 : c.DaysSinceLastBooking;

            if (!string.IsNullOrWhiteSpace(tags))
            {
                var tagList = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (tagList.Any(t => t.Equals("VIP", StringComparison.OrdinalIgnoreCase)))
                    return "VIP";
                if (tagList.Any(t => t.Equals("Fleet", StringComparison.OrdinalIgnoreCase)))
                    return "Fleet";
            }

            if (c.TotalSpent >= 5000) return "VIP";
            if (daysSinceLast > AtRiskDaysThreshold && c.TotalBookingsCount > 0) return "At-Risk";
            if ((DateTime.UtcNow - c.CreatedAt).TotalDays <= NewCustomerDays) return "New";
            if (daysSinceLast > 60) return "Inactive";

            return "Regular";
        }

        private FeedbackDto MapFeedbackToDto(CustomerFeedback f)
        {
            return new FeedbackDto
            {
                Id = f.Id,
                UserId = f.UserId,
                UserName = f.User != null ? $"{f.User.FirstName} {f.User.LastName}".Trim() : null,
                BookingId = f.BookingId,
                WorkerId = f.WorkerId,
                Type = f.Type,
                Rating = f.Rating,
                Comment = f.Comment,
                IsAnonymous = f.IsAnonymous,
                IsResolved = f.IsResolved,
                ResolutionNote = f.ResolutionNote,
                CreatedAt = f.CreatedAt,
                ResolvedAt = f.ResolvedAt
            };
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("fix-customer-data")]
        public async Task<ActionResult> FixCustomerData()
        {
            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .ToListAsync();

            var customerIds = customers.Select(c => c.Id).ToList();

            var bookingStats = await _context.Bookings
                .Where(b => b.UserId.HasValue && customerIds.Contains(b.UserId.Value) 
                    && b.Status == BookingStatus.Completed && b.TotalAmount > 0)
                .GroupBy(b => b.UserId)
                .Select(g => new
                {
                    UserId = g.Key,
                    TotalSpent = g.Sum(b => b.TotalAmount),
                    TotalBookings = g.Count(),
                    LastBookedDate = g.Max(b => b.ScheduledDate)
                })
                .ToListAsync();

            var statsMap = bookingStats.ToDictionary(b => b.UserId);

            int updated = 0;
            foreach (var customer in customers)
            {
                if (statsMap.TryGetValue(customer.Id, out var stats))
                {
                    if (customer.TotalSpent != stats.TotalSpent || 
                        customer.TotalBookingsCount != stats.TotalBookings ||
                        customer.LastBookedDate != stats.LastBookedDate)
                    {
                        customer.TotalSpent = stats.TotalSpent;
                        customer.TotalBookingsCount = stats.TotalBookings;
                        customer.LastBookedDate = stats.LastBookedDate;
                        customer.UpdatedAt = DateTime.UtcNow;
                        updated++;
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { 
                message = $"Fixed customer data. Updated {updated} customers.",
                updatedCustomers = updated,
                totalCustomers = customers.Count
            });
        }
    }
}