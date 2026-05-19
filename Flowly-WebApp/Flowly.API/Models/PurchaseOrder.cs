using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Flowly.API.Models
{
    public class Supplier
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(255)]
        public string? Email { get; set; }

        [StringLength(20)]
        public string? Phone { get; set; }

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(100)]
        public string? ContactPerson { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    }

    public enum PurchaseOrderStatus { Draft, Sent, Received, Cancelled }

    public class PurchaseOrder
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        [Required]
        [StringLength(50)]
        public string OrderNumber { get; set; } = string.Empty;

        public int SupplierId { get; set; }
        public Supplier? Supplier { get; set; }

        public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;

        [Column(TypeName = "decimal(10,2)")]
        public decimal TotalAmount { get; set; }

        public DateTime? OrderedAt { get; set; }
        public DateTime? ExpectedDelivery { get; set; }
        public DateTime? ReceivedAt { get; set; }

        [StringLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    }

    public class PurchaseOrderItem
    {
        [Key]
        public int Id { get; set; }

        public int PurchaseOrderId { get; set; }
        public PurchaseOrder? PurchaseOrder { get; set; }

        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        [Required]
        [StringLength(200)]
        public string Description { get; set; } = string.Empty;

        public int Quantity { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal UnitCost { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal LineTotal => Quantity * UnitCost;
    }
}
