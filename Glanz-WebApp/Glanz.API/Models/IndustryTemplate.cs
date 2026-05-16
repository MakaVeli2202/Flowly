using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class IndustryTemplate
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Key { get; set; } = string.Empty; // "automotive_detailing", "salon", "cleaning", "workshop"

        [Required]
        [StringLength(200)]
        public string DisplayName { get; set; } = string.Empty;

        // JSON arrays of seed data applied at org creation
        public string? DefaultAssetCategoriesJson { get; set; }
        public string? DefaultServiceTemplatesJson { get; set; }
        public string? DefaultChecklistTemplatesJson { get; set; }
        public string? DefaultCustomFieldsJson { get; set; }
        public string? DefaultWorkflowRulesJson { get; set; }
        public string? DefaultAutomationRulesJson { get; set; }

        // JSON: { "asset": "Vehicle", "staff": "Detailer", "booking": "Appointment" }
        public string? TerminologyJson { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
