using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class LoyaltyAccount
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int UserId { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal Balance { get; set; } = 0;

        [Column(TypeName = "decimal(10,2)")]
        public decimal LifetimeEarned { get; set; } = 0;

        [Column(TypeName = "decimal(10,2)")]
        public decimal LifetimeRedeemed { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }

    public class LoyaltyTransaction
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int UserId { get; set; }

        public int? BookingId { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal Points { get; set; }

        // "Earn" | "Redeem" | "Expire" | "Adjust"
        [Required]
        [StringLength(20)]
        public string Type { get; set; } = "Earn";

        [StringLength(300)]
        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class OrgLoyaltyConfig
    {
        [Key]
        public int OrgId { get; set; }

        public bool IsEnabled { get; set; } = true;

        // Points earned per QAR spent (e.g. 1 = 1 point per QAR)
        [Column(TypeName = "decimal(5,2)")]
        public decimal PointsPerQar { get; set; } = 1m;

        // Value of 1 point in QAR when redeeming (e.g. 0.05 = 1 point = 0.05 QAR)
        [Column(TypeName = "decimal(5,4)")]
        public decimal RedemptionRateQar { get; set; } = 0.05m;

        // Minimum points before customer can redeem
        public int MinRedemptionPoints { get; set; } = 100;

        // Max % of booking total that can be covered by points (e.g. 50 = max 50%)
        public int MaxRedemptionPct { get; set; } = 50;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
