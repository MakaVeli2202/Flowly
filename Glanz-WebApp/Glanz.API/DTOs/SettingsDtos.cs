using System.ComponentModel.DataAnnotations;

namespace Glanz.API.DTOs
{
    public class UpdateSettingsDto
    {
        public int?     WorkerTravelBufferMinutes   { get; set; }
        public decimal? SubscriptionDiscountPercent { get; set; }
        public bool?    SmsFollowUpEnabled          { get; set; }
        public bool?    SitePublished               { get; set; }
        public string?  SiteLaunchDate              { get; set; }
        public int?     ReferralRewardAmount        { get; set; }
        public decimal? ReferralDiscountPercent     { get; set; }
        public int?     ReferralRequiredBookings    { get; set; }
        public VehicleMultipliersDto?  VehicleMultipliers { get; set; }
        public BusinessHoursPerDayDto? BusinessHours      { get; set; }
        public BusinessConfigDto?      BusinessConfig     { get; set; }
        public List<string>?           ClosedDates        { get; set; }
    }

    public class VehicleMultipliersDto
    {
        public decimal Motorcycle { get; set; } = 0.8m;
        public decimal Sedan      { get; set; } = 1.0m;
        public decimal SUV        { get; set; } = 1.25m;
        public decimal Pickup     { get; set; } = 1.5m;
    }

    public class BusinessConfigDto
    {
        public string?       Name         { get; set; }
        public string?       Logo         { get; set; }
        public string?       Tagline      { get; set; }
        public string?       Phone        { get; set; }
        public string?       Email        { get; set; }
        public string?       Location     { get; set; }
        public List<string>? ServiceAreas { get; set; }
    }

    public class GateVerifyDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class GateAdminRecoveryDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        public string RecoveryToken { get; set; } = string.Empty;
    }
}
