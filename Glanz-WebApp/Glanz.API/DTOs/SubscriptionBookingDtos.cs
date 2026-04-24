namespace Glanz.API.DTOs
{
    public class SubBookingItemDto
    {
        public int PackageId { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string TimeSlot { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    public class CreateSubscriptionBookingsDto
    {
        public List<SubBookingItemDto> Items { get; set; } = new();
        public string? VehicleType { get; set; }
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleYear { get; set; }
        public string? ServiceAddress { get; set; }
    }

    public class UpdateSubscriptionBookingDto
    {
        public int? WorkerId { get; set; }
        public string? Status { get; set; }
        public string? Notes { get; set; }
    }

    public class SubscriptionBookingDto
    {
        public int Id { get; set; }
        public string BookingNumber { get; set; } = string.Empty;
        public int? UserId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerEmail { get; set; }
        public int? UserSubscriptionId { get; set; }
        public string? PlanName { get; set; }
        public int? PackageId { get; set; }
        public string? PackageName { get; set; }
        public decimal PackagePrice { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string TimeSlot { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal OriginalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal FinalAmount { get; set; }
        public int? WorkerId { get; set; }
        public string? WorkerName { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SubBookingDayAvailabilityDto
    {
        public string Date { get; set; } = string.Empty;    // "YYYY-MM-DD"
        public string Color { get; set; } = "green";        // green / yellow / red
        public int AvailableSlots { get; set; }
        public int TotalSlots { get; set; }
    }

    public class SubBookingSlotDto
    {
        public string Slot { get; set; } = string.Empty;
        public bool Available { get; set; }
        public int BookingCount { get; set; }
        public int MaxBookings { get; set; }
    }
}
