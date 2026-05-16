using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    public class CustomFieldDefinition
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(50)]
        public string EntityType { get; set; } = string.Empty; // Booking, Customer, ClientAsset, Staff

        [Required]
        [StringLength(100)]
        public string FieldKey { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string Label { get; set; } = string.Empty;

        [Required]
        [StringLength(30)]
        public string FieldType { get; set; } = "Text"; // Text, Number, Select, Date, Boolean, MultiSelect

        // JSON array for Select options: ["Option1","Option2"]
        public string? OptionsJson { get; set; }

        public bool IsRequired { get; set; } = false;
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;

        public Organization Organization { get; set; } = null!;
        public ICollection<CustomFieldValue> Values { get; set; } = new List<CustomFieldValue>();
    }

    public class CustomFieldValue
    {
        [Key]
        public int Id { get; set; }

        public int OrgId { get; set; }

        [Required]
        [StringLength(50)]
        public string EntityType { get; set; } = string.Empty;

        public int EntityId { get; set; }

        public int FieldDefinitionId { get; set; }

        public string? Value { get; set; }

        public Organization Organization { get; set; } = null!;
        public CustomFieldDefinition FieldDefinition { get; set; } = null!;
    }
}
