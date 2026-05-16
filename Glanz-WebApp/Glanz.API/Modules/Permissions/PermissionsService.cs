using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;

namespace Glanz.API.Modules.Permissions
{
    public interface IPermissionsService
    {
        Task<IEnumerable<string>> GetPermissionsForRoleAsync(string role);
        Task<bool> HasPermissionAsync(string role, string permissionKey);
        Task<(string? Error, int StatusCode)> GrantPermissionAsync(string role, string permissionKey);
        Task<(string? Error, int StatusCode)> RevokePermissionAsync(string role, string permissionKey);
    }

    public class PermissionsService : IPermissionsService
    {
        private readonly AppDbContext _context;

        public PermissionsService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<string>> GetPermissionsForRoleAsync(string role)
        {
            return await _context.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.Role == role)
                .Select(rp => rp.Permission.Key)
                .ToListAsync();
        }

        public async Task<bool> HasPermissionAsync(string role, string permissionKey)
        {
            return await _context.RolePermissions
                .AsNoTracking()
                .AnyAsync(rp => rp.Role == role && rp.Permission.Key == permissionKey);
        }

        public async Task<(string? Error, int StatusCode)> GrantPermissionAsync(string role, string permissionKey)
        {
            var permission = await _context.Permissions.FirstOrDefaultAsync(p => p.Key == permissionKey);
            if (permission == null) return ("Permission not found.", 404);

            var existing = await _context.RolePermissions.AnyAsync(rp => rp.Role == role && rp.PermissionId == permission.Id);
            if (existing) return (null, 200); // idempotent

            _context.RolePermissions.Add(new Models.RolePermission { Role = role, PermissionId = permission.Id });
            await _context.SaveChangesAsync();
            return (null, 201);
        }

        public async Task<(string? Error, int StatusCode)> RevokePermissionAsync(string role, string permissionKey)
        {
            var rp = await _context.RolePermissions
                .Include(r => r.Permission)
                .FirstOrDefaultAsync(r => r.Role == role && r.Permission.Key == permissionKey);
            if (rp == null) return ("Role permission not found.", 404);
            _context.RolePermissions.Remove(rp);
            await _context.SaveChangesAsync();
            return (null, 204);
        }
    }
}
