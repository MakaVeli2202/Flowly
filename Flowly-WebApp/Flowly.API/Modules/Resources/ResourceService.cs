using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Modules.Resources
{
    public record ResourceDto(int Id, string Name, string Type, int Capacity, bool IsActive);
    public record CreateResourceDto(string Name, string Type = "Room", int Capacity = 1);
    public record UpdateResourceDto(string? Name, string? Type, int? Capacity, bool? IsActive);
    public record ResourceAvailabilityDto(int Id, string Name, string Type, int Capacity, bool Available, string? ConflictingBooking);
    public record AttachResourceDto(int ResourceId);

    public interface IResourceService
    {
        Task<IEnumerable<ResourceDto>> GetResourcesAsync(int orgId);
        Task<(ResourceDto? Result, string? Error, int StatusCode)> CreateResourceAsync(int orgId, CreateResourceDto dto);
        Task<(ResourceDto? Result, string? Error, int StatusCode)> UpdateResourceAsync(int orgId, int id, UpdateResourceDto dto);
        Task<(string? Error, int StatusCode)> DeleteResourceAsync(int orgId, int id);
        Task<IEnumerable<ResourceAvailabilityDto>> GetAvailabilityAsync(int orgId, DateTime startAt, DateTime endAt);
        Task<(string? Error, int StatusCode)> AttachToBookingAsync(int orgId, int bookingId, int resourceId, DateTime startAt, DateTime endAt);
        Task<(string? Error, int StatusCode)> DetachFromBookingAsync(int orgId, int bookingId, int resourceId);
        Task<IEnumerable<ResourceDto>> GetBookingResourcesAsync(int bookingId);
    }

    public class ResourceService : IResourceService
    {
        private readonly AppDbContext _context;

        public ResourceService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<ResourceDto>> GetResourcesAsync(int orgId)
        {
            var items = await _context.Resources.AsNoTracking().Where(r => r.IsActive).ToListAsync();
            return items.Select(r => new ResourceDto(r.Id, r.Name, r.Type, r.Capacity, r.IsActive));
        }

        public async Task<(ResourceDto? Result, string? Error, int StatusCode)> CreateResourceAsync(int orgId, CreateResourceDto dto)
        {
            var resource = new Resource { OrgId = orgId, Name = dto.Name.Trim(), Type = dto.Type, Capacity = dto.Capacity, IsActive = true };
            _context.Resources.Add(resource);
            await _context.SaveChangesAsync();
            return (new ResourceDto(resource.Id, resource.Name, resource.Type, resource.Capacity, resource.IsActive), null, 201);
        }

        public async Task<(ResourceDto? Result, string? Error, int StatusCode)> UpdateResourceAsync(int orgId, int id, UpdateResourceDto dto)
        {
            var resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == id);
            if (resource == null) return (null, "Resource not found.", 404);
            if (dto.Name != null) resource.Name = dto.Name.Trim();
            if (dto.Type != null) resource.Type = dto.Type;
            if (dto.Capacity.HasValue) resource.Capacity = dto.Capacity.Value;
            if (dto.IsActive.HasValue) resource.IsActive = dto.IsActive.Value;
            await _context.SaveChangesAsync();
            return (new ResourceDto(resource.Id, resource.Name, resource.Type, resource.Capacity, resource.IsActive), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteResourceAsync(int orgId, int id)
        {
            var resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == id);
            if (resource == null) return ("Resource not found.", 404);
            resource.IsActive = false;
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<ResourceAvailabilityDto>> GetAvailabilityAsync(int orgId, DateTime startAt, DateTime endAt)
        {
            var resources = await _context.Resources
                .Where(r => r.IsActive)
                .Include(r => r.ResourceBookings)
                .AsNoTracking()
                .ToListAsync();

            return resources.Select(r =>
            {
                var conflict = r.ResourceBookings.FirstOrDefault(rb =>
                    rb.StartAt < endAt && rb.EndAt > startAt);
                return new ResourceAvailabilityDto(
                    r.Id, r.Name, r.Type, r.Capacity,
                    Available: conflict == null,
                    ConflictingBooking: conflict == null ? null : $"Booking #{conflict.BookingId}");
            });
        }

        public async Task<(string? Error, int StatusCode)> AttachToBookingAsync(int orgId, int bookingId, int resourceId, DateTime startAt, DateTime endAt)
        {
            var resource = await _context.Resources.FirstOrDefaultAsync(r => r.Id == resourceId && r.IsActive);
            if (resource == null) return ("Resource not found.", 404);

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking == null) return ("Booking not found.", 404);

            var conflict = await _context.ResourceBookings.AnyAsync(rb =>
                rb.ResourceId == resourceId && rb.BookingId != bookingId &&
                rb.StartAt < endAt && rb.EndAt > startAt);
            if (conflict) return ("Resource is already booked for that time slot.", 409);

            var existing = await _context.ResourceBookings.FirstOrDefaultAsync(rb =>
                rb.ResourceId == resourceId && rb.BookingId == bookingId);
            if (existing != null)
            {
                existing.StartAt = startAt;
                existing.EndAt = endAt;
            }
            else
            {
                _context.ResourceBookings.Add(new ResourceBooking
                {
                    ResourceId = resourceId,
                    BookingId = bookingId,
                    StartAt = startAt,
                    EndAt = endAt
                });
            }

            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DetachFromBookingAsync(int orgId, int bookingId, int resourceId)
        {
            var rb = await _context.ResourceBookings.FirstOrDefaultAsync(rb =>
                rb.BookingId == bookingId && rb.ResourceId == resourceId);
            if (rb == null) return ("Resource booking not found.", 404);
            _context.ResourceBookings.Remove(rb);
            await _context.SaveChangesAsync();
            return (null, 204);
        }

        public async Task<IEnumerable<ResourceDto>> GetBookingResourcesAsync(int bookingId)
        {
            var rbs = await _context.ResourceBookings
                .Include(rb => rb.Resource)
                .Where(rb => rb.BookingId == bookingId)
                .AsNoTracking()
                .ToListAsync();
            return rbs.Select(rb => new ResourceDto(rb.Resource.Id, rb.Resource.Name, rb.Resource.Type, rb.Resource.Capacity, rb.Resource.IsActive));
        }
    }
}
