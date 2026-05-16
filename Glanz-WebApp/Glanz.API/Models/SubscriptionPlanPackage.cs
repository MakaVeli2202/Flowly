using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class SubscriptionPlanPackage
    {
        [Key]
        public int Id { get; set; }

        public int? OrgId { get; set; }

        public int PlanId { get; set; }

        [ForeignKey("PlanId")]
        public SubscriptionPlan Plan { get; set; } = null!;

        public int PackageId { get; set; }

        [ForeignKey("PackageId")]
        public Package Package { get; set; } = null!;

        public int DisplayOrder { get; set; } = 0;
    }
}
