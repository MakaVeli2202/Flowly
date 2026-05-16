using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Platform.Messaging;
using Glanz.API.Services;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.Modules.CRM
{
    public class CrmService : ICrmService
    {
        private readonly AppDbContext _context;
        private readonly ISmsService _sms;
        private readonly IAdminNotificationService _notifications;
        private const int AtRiskDaysThreshold = 60;
        private const int NewCustomerDays = 30;

        public CrmService(AppDbContext context, ISmsService sms, IAdminNotificationService notifications)
        {
            _sms = sms;
            _notifications = notifications;
            _context = context;
        }

        public async Task<CrmDashboardDto> GetDashboardAsync()
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

            var customerData = customers.Select(c =>
            {
                customerStats.TryGetValue(c.Id, out var stats);
                var lastBooked = stats?.LastBookedDate;
                var daysSince = lastBooked.HasValue ? (int)(now - lastBooked.Value).TotalDays : int.MaxValue;
                return new CustomerSnapshot
                {
                    Id = c.Id,
                    Name = $"{c.FirstName} {c.LastName}".Trim(),
                    Email = c.Email,
                    Phone = c.Phone,
                    Tags = c.Tags,
                    TotalSpent = stats?.TotalSpent ?? 0,
                    TotalBookingsCount = stats?.TotalBookings ?? 0,
                    LastBookedDate = lastBooked,
                    CreatedAt = c.CreatedAt,
                    DaysSinceLastBooking = daysSince,
                    AllowPreferredWorker = c.AllowPreferredWorker
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
                .Select(MapSnapshotToDto)
                .ToList();

            var topSpenders = customerData
                .OrderByDescending(c => c.TotalSpent)
                .Take(10)
                .Select(MapSnapshotToDto)
                .ToList();

            return new CrmDashboardDto
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
            };
        }

        public async Task<CrmStatsDto> GetStatsAsync()
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
                c.Tags,
                c.TotalSpent,
                c.TotalBookingsCount,
                DaysSinceLastBooking = c.LastBookedDate.HasValue
                    ? (int)(now - c.LastBookedDate.Value).TotalDays
                    : int.MaxValue
            }).ToList();

            var atRisk = customerData.Count(c => c.DaysSinceLastBooking > AtRiskDaysThreshold && c.TotalBookingsCount > 0);
            var vip = customerData.Count(c => c.Tags?.Contains("VIP", StringComparison.OrdinalIgnoreCase) == true);
            var fleet = customerData.Count(c => c.Tags?.Contains("Fleet", StringComparison.OrdinalIgnoreCase) == true);

            return new CrmStatsDto
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
            };
        }

        public async Task<BookingSourceStatsDto> GetBookingSourceStatsAsync()
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

            return new BookingSourceStatsDto
            {
                TotalBookings = completedBookings.Count,
                TotalRevenue = completedBookings.Sum(b => b.TotalAmount),
                Sources = sourceGroups
            };
        }

        public async Task<IEnumerable<CrmCustomerDto?>> GetCrmCustomersAsync(string? segment)
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
                .Select(c =>
                {
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
                        IsAtRisk = daysSinceLast > AtRiskDaysThreshold && totalBookings > 0,
                        AllowPreferredWorker = c.AllowPreferredWorker
                    };
                })
                .Where(c => c != null)
                .OrderByDescending(c => c!.TotalSpent)
                .ToList();

            return result;
        }

        public async Task<(CustomerProfileDto? Result, string? Error)> GetCustomerProfileAsync(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null || user.Role != "Customer")
                return (null, "Customer not found.");

            return (new CustomerProfileDto
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
            }, null);
        }

        public async Task<string?> UpdateCustomerAsync(int id, UpdateCustomerDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null || user.Role != "Customer")
                return "Customer not found.";

            if (dto.Tags != null) user.Tags = dto.Tags;
            if (dto.Notes != null) user.Notes = dto.Notes;
            if (dto.TotalSpent.HasValue) user.TotalSpent = dto.TotalSpent.Value;
            if (dto.TotalBookingsCount.HasValue) user.TotalBookingsCount = dto.TotalBookingsCount.Value;

            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<(string? Error, int Updated)> BulkUpdateTagsAsync(BulkTagDto dto)
        {
            if (dto.CustomerIds == null || dto.CustomerIds.Count == 0)
                return ("No customers selected.", 0);

            var customers = await _context.Users
                .Where(u => dto.CustomerIds.Contains(u.Id) && u.Role == "Customer")
                .ToListAsync();

            foreach (var customer in customers)
            {
                var currentTags = string.IsNullOrWhiteSpace(customer.Tags)
                    ? new List<string>()
                    : customer.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

                if (dto.Remove)
                    currentTags.RemoveAll(t => t.Equals(dto.Tag, StringComparison.OrdinalIgnoreCase));
                else if (!currentTags.Any(t => t.Equals(dto.Tag, StringComparison.OrdinalIgnoreCase)))
                    currentTags.Add(dto.Tag);

                customer.Tags = string.Join(", ", currentTags);
                customer.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return (null, customers.Count);
        }

        public async Task<(string? Error, int Sent)> BulkMessageAsync(BulkMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return ("Message cannot be empty.", 0);

            IQueryable<User> query = _context.Users.Where(u => u.Role == "Customer" && u.IsActive);

            if (dto.CustomerIds.Count > 0)
                query = query.Where(u => dto.CustomerIds.Contains(u.Id));

            var customers = await query.ToListAsync();
            int sent = 0;

            foreach (var customer in customers)
            {
                if (dto.Channel is "push" or "both" && !string.IsNullOrEmpty(customer.ExpoPushToken))
                {
                    try { await _notifications.SendPushNotificationAsync(customer.ExpoPushToken, "Message from us", dto.Message); sent++; }
                    catch { }
                }
                else if (dto.Channel is "sms" or "both" && !string.IsNullOrEmpty(customer.Phone))
                {
                    var (success, _) = await _sms.SendAsync(customer.Phone, dto.Message);
                    if (success) sent++;
                }

                _context.Notifications.Add(new Notification
                {
                    UserId = customer.Id,
                    Message = dto.Message,
                    Type = NotificationType.SpecialOffer,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                });
            }

            await _context.SaveChangesAsync();
            return (null, sent);
        }

        public async Task<IEnumerable<TimelineEventDto>> GetCommunicationTimelineAsync(int customerId)
        {
            var events = new List<TimelineEventDto>();

            var bookings = await _context.Bookings
                .Where(b => b.UserId == customerId)
                .OrderByDescending(b => b.CreatedAt)
                .Take(50)
                .ToListAsync();

            foreach (var b in bookings)
            {
                events.Add(new TimelineEventDto
                {
                    Type = "Booking",
                    Description = $"Booking #{b.BookingNumber} — {b.Status}",
                    OccurredAt = b.CreatedAt,
                    Metadata = new { b.BookingNumber, Status = b.Status.ToString(), b.TotalAmount }
                });
                if (b.WorkCompletedAt.HasValue)
                    events.Add(new TimelineEventDto { Type = "BookingCompleted", Description = $"Job completed for #{b.BookingNumber}", OccurredAt = b.WorkCompletedAt.Value });
                if (b.ReminderSentAt.HasValue)
                    events.Add(new TimelineEventDto { Type = "Reminder", Description = $"SMS reminder sent for #{b.BookingNumber}", OccurredAt = b.ReminderSentAt.Value });
            }

            var notifications = await _context.Notifications
                .Where(n => n.UserId == customerId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(30)
                .ToListAsync();

            foreach (var n in notifications)
                events.Add(new TimelineEventDto { Type = "Notification", Description = n.Message, OccurredAt = n.CreatedAt });

            var feedback = await _context.CustomerFeedbacks
                .Where(f => f.UserId == customerId)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            foreach (var f in feedback)
            {
                var commentPreview = f.Comment != null ? f.Comment.Substring(0, Math.Min(80, f.Comment.Length)) : "";
                events.Add(new TimelineEventDto { Type = "Feedback", Description = $"Feedback ({f.Type}): {commentPreview}", OccurredAt = f.CreatedAt });
            }

            return events.OrderByDescending(e => e.OccurredAt).ToList();
        }

        public async Task<IEnumerable<CrmCustomerDto>> GetAtRiskCustomersAsync()
        {
            var now = DateTime.UtcNow;
            var threshold = now.AddDays(-AtRiskDaysThreshold);

            var customers = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive && u.TotalBookingsCount > 0)
                .ToListAsync();

            return customers
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
        }

        public async Task<FeedbackDto> SubmitFeedbackAsync(CreateFeedbackDto dto, int? userId)
        {
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
            return MapFeedbackToDto(feedback);
        }

        public async Task<(IEnumerable<FeedbackDto>? Result, string? Error)> GetMyFeedbackAsync(int userId)
        {
            var feedback = await _context.CustomerFeedbacks
                .Where(cf => cf.UserId == userId)
                .OrderByDescending(cf => cf.CreatedAt)
                .ToListAsync();

            return (feedback.Select(MapFeedbackToDto), null);
        }

        public async Task<IEnumerable<FeedbackDto>> GetAllFeedbackAsync(FeedbackType? type, bool? resolved)
        {
            var query = _context.CustomerFeedbacks
                .Include(cf => cf.User)
                .Include(cf => cf.Booking)
                .Include(cf => cf.Worker)
                .AsQueryable();

            if (type.HasValue)
                query = query.Where(cf => cf.Type == type.Value);

            if (resolved.HasValue)
                query = query.Where(cf => cf.IsResolved == resolved.Value);

            var feedback = await query
                .OrderByDescending(cf => cf.CreatedAt)
                .ToListAsync();

            return feedback.Select(f => new FeedbackDto
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
            });
        }

        public async Task<string?> ResolveFeedbackAsync(int id, ResolveFeedbackDto dto)
        {
            var feedback = await _context.CustomerFeedbacks.FindAsync(id);
            if (feedback == null)
                return "Feedback not found.";

            feedback.IsResolved = true;
            feedback.ResolutionNote = dto.ResolutionNote;
            feedback.ResolvedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<(string Message, int Updated, int Total)> FixCustomerDataAsync()
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

            var statsMap = bookingStats.Where(b => b.UserId.HasValue).ToDictionary(b => b.UserId!.Value);

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
            return ($"Fixed customer data. Updated {updated} customers.", updated, customers.Count);
        }

        private string DetermineSegmentByData(string? tags, decimal totalSpent, int daysSinceLast, int totalBookings, DateTime createdAt)
        {
            var now = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(tags))
            {
                var tagList = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (tagList.Any(t => t.Equals("VIP", StringComparison.OrdinalIgnoreCase))) return "VIP";
                if (tagList.Any(t => t.Equals("Fleet", StringComparison.OrdinalIgnoreCase))) return "Fleet";
            }

            if (totalSpent >= 5000) return "VIP";
            if (daysSinceLast > AtRiskDaysThreshold && totalBookings > 0) return "At-Risk";
            if ((now - createdAt).TotalDays <= NewCustomerDays) return "New";
            if (daysSinceLast > 60) return "Inactive";
            if (totalBookings >= 10) return "Loyal";
            return "Regular";
        }

        private CrmCustomerDto MapSnapshotToDto(CustomerSnapshot c)
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
                Segment = DetermineSegmentByData(c.Tags, c.TotalSpent, c.DaysSinceLastBooking, c.TotalBookingsCount, c.CreatedAt),
                CreatedAt = c.CreatedAt,
                IsAtRisk = daysSinceLast > AtRiskDaysThreshold && c.TotalBookingsCount > 0,
                AllowPreferredWorker = c.AllowPreferredWorker
            };
        }

        private static FeedbackDto MapFeedbackToDto(CustomerFeedback f) => new()
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

        private class CustomerSnapshot
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string? Email { get; set; }
            public string? Phone { get; set; }
            public string? Tags { get; set; }
            public decimal TotalSpent { get; set; }
            public int TotalBookingsCount { get; set; }
            public DateTime? LastBookedDate { get; set; }
            public DateTime CreatedAt { get; set; }
            public int DaysSinceLastBooking { get; set; }
            public bool AllowPreferredWorker { get; set; }
        }
    }
}
