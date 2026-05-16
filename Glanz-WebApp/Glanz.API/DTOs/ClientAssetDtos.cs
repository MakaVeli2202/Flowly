namespace Glanz.API.DTOs
{
    public class ClientAssetDto
    {
        public int Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public int? AssetCategoryId { get; set; }
        public string? AssetCategoryName { get; set; }
        public string? AttributesJson { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateClientAssetDto
    {
        public string Label { get; set; } = string.Empty;
        public int? AssetCategoryId { get; set; }
        public string? AttributesJson { get; set; }
        public bool IsDefault { get; set; }
    }

    public class UpdateClientAssetDto : CreateClientAssetDto { }
}
