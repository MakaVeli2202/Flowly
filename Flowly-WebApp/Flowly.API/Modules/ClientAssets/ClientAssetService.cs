using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Flowly.API.Data;
using Flowly.API.DTOs;
using Flowly.API.Models;

namespace Flowly.API.Modules.ClientAssets
{
    public interface IClientAssetService
    {
        Task<IEnumerable<ClientAssetDto>> GetAssetsAsync(int orgId, int userId);
        Task<(ClientAssetDto? Result, string? Error, int StatusCode)> GetAssetAsync(int orgId, int userId, int id);
        Task<(ClientAssetDto? Result, string? Error, int StatusCode)> CreateAssetAsync(int orgId, int userId, CreateClientAssetDto dto);
        Task<(ClientAssetDto? Result, string? Error, int StatusCode)> UpdateAssetAsync(int orgId, int userId, int id, UpdateClientAssetDto dto);
        Task<(string? Error, int StatusCode)> DeleteAssetAsync(int orgId, int userId, int id);
        Task<(ClientAssetDto? Result, string? Error, int StatusCode)> SetDefaultAsync(int orgId, int userId, int id);
        Task<(object? Result, string? Error, int StatusCode)> GetHistoryAsync(int orgId, int userId, int id);
    }

    public class ClientAssetService : IClientAssetService
    {
        private readonly AppDbContext _context;

        public ClientAssetService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<ClientAssetDto>> GetAssetsAsync(int orgId, int userId)
        {
            var assets = await _context.ClientAssets
                .AsNoTracking()
                .Include(ca => ca.AssetCategory)
                .Where(ca => ca.CustomerId == userId && ca.IsActive)
                .OrderByDescending(ca => ca.IsDefault)
                .ThenBy(ca => ca.CreatedAt)
                .ToListAsync();
            return assets.Select(ToDto);
        }

        public async Task<(ClientAssetDto? Result, string? Error, int StatusCode)> GetAssetAsync(int orgId, int userId, int id)
        {
            var asset = await _context.ClientAssets
                .AsNoTracking()
                .Include(ca => ca.AssetCategory)
                .FirstOrDefaultAsync(ca => ca.Id == id && ca.CustomerId == userId);
            if (asset == null) return (null, "Asset not found.", 404);
            return (ToDto(asset), null, 200);
        }

        public async Task<(ClientAssetDto? Result, string? Error, int StatusCode)> CreateAssetAsync(int orgId, int userId, CreateClientAssetDto dto)
        {
            var count = await _context.ClientAssets.CountAsync(ca => ca.CustomerId == userId && ca.IsActive);
            var isDefault = dto.IsDefault || count == 0;

            if (isDefault)
                await ClearDefaultAsync(userId);

            var asset = new ClientAsset
            {
                OrgId = orgId,
                CustomerId = userId,
                AssetCategoryId = dto.AssetCategoryId,
                Label = dto.Label.Trim(),
                AttributesJson = dto.AttributesJson,
                IsDefault = isDefault,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.ClientAssets.Add(asset);

            await DualWriteToVehicleAsync(userId, orgId, asset, dto.AttributesJson, isDefault);

            await _context.SaveChangesAsync();
            return (ToDto(asset), null, 201);
        }

        public async Task<(ClientAssetDto? Result, string? Error, int StatusCode)> UpdateAssetAsync(int orgId, int userId, int id, UpdateClientAssetDto dto)
        {
            var asset = await _context.ClientAssets
                .Include(ca => ca.AssetCategory)
                .FirstOrDefaultAsync(ca => ca.Id == id && ca.CustomerId == userId);
            if (asset == null) return (null, "Asset not found.", 404);

            if (dto.IsDefault && !asset.IsDefault)
                await ClearDefaultAsync(userId);

            asset.Label = dto.Label.Trim();
            asset.AssetCategoryId = dto.AssetCategoryId;
            asset.AttributesJson = dto.AttributesJson;
            asset.IsDefault = dto.IsDefault;

            await _context.SaveChangesAsync();
            return (ToDto(asset), null, 200);
        }

        public async Task<(string? Error, int StatusCode)> DeleteAssetAsync(int orgId, int userId, int id)
        {
            var asset = await _context.ClientAssets
                .FirstOrDefaultAsync(ca => ca.Id == id && ca.CustomerId == userId);
            if (asset == null) return ("Asset not found.", 404);

            asset.IsActive = false;
            await _context.SaveChangesAsync();

            if (asset.IsDefault)
            {
                var next = await _context.ClientAssets
                    .Where(ca => ca.CustomerId == userId && ca.IsActive)
                    .OrderBy(ca => ca.CreatedAt)
                    .FirstOrDefaultAsync();
                if (next != null) { next.IsDefault = true; await _context.SaveChangesAsync(); }
            }

            return (null, 204);
        }

        public async Task<(ClientAssetDto? Result, string? Error, int StatusCode)> SetDefaultAsync(int orgId, int userId, int id)
        {
            var asset = await _context.ClientAssets
                .Include(ca => ca.AssetCategory)
                .FirstOrDefaultAsync(ca => ca.Id == id && ca.CustomerId == userId);
            if (asset == null) return (null, "Asset not found.", 404);

            await ClearDefaultAsync(userId);
            asset.IsDefault = true;
            await _context.SaveChangesAsync();
            return (ToDto(asset), null, 200);
        }

        private async Task ClearDefaultAsync(int userId)
        {
            await _context.ClientAssets
                .Where(ca => ca.CustomerId == userId && ca.IsDefault && ca.IsActive)
                .ExecuteUpdateAsync(s => s.SetProperty(ca => ca.IsDefault, false));
        }

        private async Task DualWriteToVehicleAsync(int userId, int orgId, ClientAsset asset, string? attributesJson, bool isDefault)
        {
            if (isDefault)
            {
                await _context.Vehicles
                    .Where(v => v.UserId == userId && v.IsDefault)
                    .ExecuteUpdateAsync(s => s.SetProperty(v => v.IsDefault, false));
            }

            string? make = null, model = null, year = null;
            VehicleType vehicleType = VehicleType.Sedan;

            if (attributesJson != null)
            {
                try
                {
                    var attrs = JsonSerializer.Deserialize<Dictionary<string, string>>(attributesJson);
                    if (attrs != null)
                    {
                        attrs.TryGetValue("make", out make);
                        attrs.TryGetValue("model", out model);
                        attrs.TryGetValue("year", out year);
                        if (attrs.TryGetValue("vehicleType", out var vtStr)
                            && Enum.TryParse<VehicleType>(vtStr, true, out var vt))
                            vehicleType = vt;
                    }
                }
                catch { }
            }

            _context.Vehicles.Add(new Vehicle
            {
                UserId = userId,
                OrgId = orgId,
                Nickname = asset.Label,
                Make = make,
                Model = model,
                Year = year,
                VehicleType = vehicleType,
                IsDefault = isDefault
            });
        }

        public async Task<(object? Result, string? Error, int StatusCode)> GetHistoryAsync(int orgId, int userId, int id)
        {
            var asset = await _context.ClientAssets.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id && a.OrgId == orgId && a.CustomerId == userId);
            if (asset == null) return (null, "Asset not found", 404);

            var bookings = await _context.Bookings
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(b => b.ClientAssetId == id && b.OrgId == orgId)
                .OrderByDescending(b => b.ScheduledDate)
                .Select(b => new
                {
                    b.Id,
                    b.BookingNumber,
                    b.ScheduledDate,
                    b.TimeSlot,
                    Status = b.Status.ToString(),
                    b.TotalAmount,
                    b.TipAmount,
                    b.WorkerRating,
                    b.InvoicePdfUrl
                })
                .ToListAsync();

            return (new { asset = ToDto(asset), bookings }, null, 200);
        }

        private static ClientAssetDto ToDto(ClientAsset ca) => new()
        {
            Id = ca.Id,
            Label = ca.Label,
            AssetCategoryId = ca.AssetCategoryId,
            AssetCategoryName = ca.AssetCategory?.Name,
            AttributesJson = ca.AttributesJson,
            IsDefault = ca.IsDefault,
            CreatedAt = ca.CreatedAt
        };
    }
}
