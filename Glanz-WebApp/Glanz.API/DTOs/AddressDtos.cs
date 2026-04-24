namespace Glanz.API.DTOs
{
    public class AddressSuggestionDto
    {
        public string DisplayName { get; set; } = string.Empty;
        public string? StreetAddress { get; set; }
        public string? Latitude { get; set; }
        public string? Longitude { get; set; }
        public string Source { get; set; } = string.Empty;
    }
}