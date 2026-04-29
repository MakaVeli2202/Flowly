using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Phone]
        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(1000)]
        public string? ProfileImageUrl { get; set; }

        [StringLength(500)]
        public string? HomeAddress { get; set; }

        [StringLength(100)]
        public string? HomeHouseNumber { get; set; }

        [StringLength(500)]
        public string? WorkAddress { get; set; }

        [StringLength(100)]
        public string? WorkHouseNumber { get; set; }

        [StringLength(500)]
        public string? OtherAddress { get; set; }

        [StringLength(100)]
        public string? OtherHouseNumber { get; set; }

        [StringLength(20)]
        public string PreferredAddressType { get; set; } = "Home";

        [Required]
        [StringLength(20)]
        public string Role { get; set; } = "Customer";

        public bool IsActive { get; set; } = true;
        public DateTime? LoyaltyReviewPendingAt { get; set; }
        public DateTime? LoyaltyGoogleReviewActivatedAt { get; set; }

        [StringLength(500)]
        public string? LoyaltyReviewScreenshotUrl { get; set; }

        [StringLength(500)]
        public string? ExpoPushToken { get; set; }

        [StringLength(200)]
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiry { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}
