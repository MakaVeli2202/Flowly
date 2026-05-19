using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Models
{
    public class Permission
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Key { get; set; } = string.Empty; // e.g. "bookings.read", "staff.write"

        [StringLength(200)]
        public string? Description { get; set; }

        [StringLength(50)]
        public string Module { get; set; } = string.Empty; // "bookings", "staff", "reports"

        public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }

    public class RolePermission
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Role { get; set; } = string.Empty; // "org_owner", "org_admin", "org_staff", "org_customer"

        public int PermissionId { get; set; }

        public Permission Permission { get; set; } = null!;
    }
}
