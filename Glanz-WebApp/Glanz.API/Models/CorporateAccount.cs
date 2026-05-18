using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class CorporateAccount
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string CompanyName { get; set; } = string.Empty;

        [StringLength(200)]
        public string? BillingEmail { get; set; }

        [StringLength(50)]
        public string? BillingPhone { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal CreditLimit { get; set; } = 0m;

        [Column(TypeName = "decimal(10,2)")]
        public decimal UsedCredit { get; set; } = 0m;

        [Column(TypeName = "decimal(5,2)")]
        public decimal DiscountPercent { get; set; } = 0m;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<CorporateAccountMember> Members { get; set; } = new List<CorporateAccountMember>();
    }

    public class CorporateAccountMember
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        public int CorporateAccountId { get; set; }

        public int UserId { get; set; }

        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("CorporateAccountId")]
        public CorporateAccount Account { get; set; } = null!;

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
