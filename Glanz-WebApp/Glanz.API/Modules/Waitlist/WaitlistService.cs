using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.Models;

namespace Glanz.API.Modules.Waitlist
{
    public class WaitlistService : IWaitlistService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<WaitlistService> _logger;

        public WaitlistService(AppDbContext context, ILogger<WaitlistService> logger)
        {
            _context = context;
            _logger  = logger;
        }

        public async Task<IEnumerable<WaitlistEntryDto>> GetMyEntriesAsync(int userId)
        {
            var entries = await _context.WaitlistEntries
                .AsNoTracking()
                .Include(e => e.Package)
                .Where(e => e.UserId == userId)
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();
            return entries.Select(ToDto);
        }

        public async Task<(WaitlistEntryDto? Result, string? Error, int StatusCode)> JoinAsync(int userId, int orgId, JoinWaitlistDto dto)
        {
            if (dto.RequestedDate.Date < DateTime.UtcNow.Date)
                return (null, "Requested date cannot be in the past.", 400);

            var existing = await _context.WaitlistEntries
                .AnyAsync(e => e.UserId == userId
                            && e.RequestedDate.Date == dto.RequestedDate.Date
                            && e.Status == "Waiting");
            if (existing)
                return (null, "You already have a waiting entry for this date.", 409);

            var entry = new WaitlistEntry
            {
                OrgId             = orgId,
                UserId            = userId,
                RequestedDate     = dto.RequestedDate.Date,
                PreferredTimeSlot = dto.PreferredTimeSlot,
                PackageId         = dto.PackageId,
                Status            = "Waiting",
                CreatedAt         = DateTime.UtcNow,
            };

            _context.WaitlistEntries.Add(entry);
            await _context.SaveChangesAsync();

            await _context.Entry(entry).Reference(e => e.Package).LoadAsync();
            return (ToDto(entry), null, 201);
        }

        public async Task<(string? Error, int StatusCode)> LeaveAsync(int userId, int id)
        {
            var entry = await _context.WaitlistEntries
                .FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);
            if (entry == null) return ("Entry not found.", 404);
            if (entry.Status == "Booked") return ("Cannot leave waitlist for an already-booked slot.", 400);
            _context.WaitlistEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<WaitlistEntryDto>> GetAllAdminAsync(int orgId, string? date)
        {
            var query = _context.WaitlistEntries
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Include(e => e.User)
                .Include(e => e.Package)
                .Where(e => e.OrgId == orgId);

            if (DateTime.TryParse(date, out var parsedDate))
                query = query.Where(e => e.RequestedDate.Date == parsedDate.Date);

            var entries = await query.OrderBy(e => e.RequestedDate).ThenBy(e => e.CreatedAt).ToListAsync();
            return entries.Select(e =>
            {
                var dto = ToDto(e);
                dto.CustomerName = e.User != null ? $"{e.User.FirstName} {e.User.LastName}".Trim() : null;
                return dto;
            });
        }

        public async Task<int> NotifyWaitlistAsync(int orgId, DateTime date, string? timeSlot, CancellationToken ct)
        {
            var query = _context.WaitlistEntries
                .IgnoreQueryFilters()
                .Where(e => e.OrgId == orgId
                         && e.RequestedDate.Date == date.Date
                         && e.Status == "Waiting");

            if (!string.IsNullOrWhiteSpace(timeSlot))
                query = query.Where(e => e.PreferredTimeSlot == null || e.PreferredTimeSlot == timeSlot);

            var entries = await query.ToListAsync(ct);
            if (entries.Count == 0) return 0;

            foreach (var entry in entries)
                entry.Status = "Notified";

            await _context.SaveChangesAsync(ct);
            _logger.LogInformation("[Waitlist] Notified {Count} waitlist entries for {Date} {Slot}", entries.Count, date.ToString("yyyy-MM-dd"), timeSlot ?? "any");
            return entries.Count;
        }

        private static WaitlistEntryDto ToDto(WaitlistEntry e) => new()
        {
            Id                = e.Id,
            UserId            = e.UserId,
            RequestedDate     = e.RequestedDate,
            PreferredTimeSlot = e.PreferredTimeSlot,
            PackageId         = e.PackageId,
            PackageName       = e.Package?.Name,
            Status            = e.Status,
            CreatedAt         = e.CreatedAt,
        };
    }
}
