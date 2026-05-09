using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;
using Microsoft.AspNetCore.Http;

namespace Glanz.API.DTOs
{
    public class CreateBookingDto
    {
        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        [StringLength(10)]
        public string TimeSlot { get; set; } = string.Empty;

        [Required]
        public string CustomerName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string CustomerEmail { get; set; } = string.Empty;

        [Required]
        [Phone]
        public string CustomerPhone { get; set; } = string.Empty;

        [StringLength(500)]
        public string? CustomerAddress { get; set; }
        [StringLength(20)]
        public string? HouseNumber { get; set; }
        [StringLength(10)]
        public string? AddressType { get; set; } // "Home" or "Work"

        [StringLength(100)]
        public string? VehicleMake { get; set; }
        [StringLength(100)]
        public string? VehicleModel { get; set; }
        [StringLength(10)]
        public string? VehicleYear { get; set; }
        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;
        [StringLength(1000)]
        public string? SpecialInstructions { get; set; }
        [StringLength(60)]
        public string? OfferCode { get; set; }
        public int? CustomerSubscriptionId { get; set; }

        public bool IsMonthlySubscription { get; set; } = false;

        [Range(1, 12)]
        public int SubscriptionMonths { get; set; } = 1;

        public string? StripePaymentIntentId { get; set; }

        // Client-generated idempotency key. Server returns existing booking instead of creating
        // a duplicate if the key matches a previous request from the same customer.
        public string? IdempotencyKey { get; set; }

        // Lead tracking - how did the customer find us?
        public LeadSource LeadSource { get; set; } = LeadSource.Direct;
        
        // Additional lead details (UTM parameters, campaign name, etc.)
        [StringLength(500)]
        public string? LeadSourceDetails { get; set; }

        [Required]
        public List<BookingPackageDto> Packages { get; set; } = new();
    }

    public class BookingPackageDto
    {
        [Required]
        public int PackageId { get; set; }

        [Required]
        [Range(1, 10)]
        public int Quantity { get; set; } = 1;
    }

    public class ConfirmBookingDto
    {
        [Required]
        public string PaymentIntentId { get; set; } = string.Empty;
    }

    public class UpdateBookingStatusDto
    {
        [Required]
        public BookingStatus Status { get; set; }
    }

    public class UpdatePaymentStatusDto
    {
        [Required]
        public PaymentStatus PaymentStatus { get; set; }
    }

    public class UpdateChecklistItemDto
    {
        [Required]
        public bool IsCompleted { get; set; }
    }

    public class MarkRunningLateDto
    {
        [Range(5, 120)]
        public int DelayMinutes { get; set; } = 10;

        [MaxLength(250)]
        public string? Reason { get; set; }
    }

    public class UpdateAssignmentModeDto
    {
        [Required]
        public bool AutoAssignEnabled { get; set; }
    }

    public class AssignmentModeDto
    {
        public bool AutoAssignEnabled { get; set; }
    }

    public class BookingDto
    {
        public int Id { get; set; }
        public string BookingNumber { get; set; } = string.Empty;
        public DateTime ScheduledDate { get; set; }
        public string TimeSlot { get; set; } = string.Empty;
        public int EstimatedDurationMinutes { get; set; }
        public string Status { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? AppliedOfferCode { get; set; }
        public decimal EstimatedCost { get; set; }
        public decimal EstimatedProfit { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerEmail { get; set; } = string.Empty;
        public string CustomerPhone { get; set; } = string.Empty;
        public string? CustomerAddress { get; set; }
        public string? AddressType { get; set; }
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleYear { get; set; }
        public string VehicleType { get; set; } = string.Empty;
        public string? SpecialInstructions { get; set; }
        public int? AssignedWorkerId { get; set; }
        public string? AssignedWorkerName { get; set; }
        public DateTime? WorkerArrivedAt { get; set; }
        public DateTime? WorkerOnMyWayAt { get; set; }
        public DateTime? WorkerRunningLateAt { get; set; }
        public DateTime? WorkStartedAt { get; set; }
        public DateTime? WorkCompletedAt { get; set; }
        public int? WorkDurationSeconds { get; set; }
        public DateTime CreatedAt { get; set; }
        // Customer change requests
        public bool CancellationRequested { get; set; }
        public string? CancellationRequestReason { get; set; }
        public DateTime? CancellationRequestedAt { get; set; }
        public bool RescheduleRequested { get; set; }
        public string? RescheduleRequestNote { get; set; }
        public string? ReschedulePreferredDate { get; set; }
        public DateTime? RescheduleRequestedAt { get; set; }
        // Lead tracking
        public string LeadSource { get; set; } = "Direct";
        public string? LeadSourceDetails { get; set; }
        public List<BookingItemDetailDto> Items { get; set; } = new();
        public List<BookingChecklistItemDto> ChecklistItems { get; set; } = new();
    }

    public class BookingChecklistItemDto
    {
        public int Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public int DisplayOrder { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class BookingItemDetailDto
    {
        public int PackageId { get; set; }
        public string PackageName { get; set; } = string.Empty;
        public string PackageTier { get; set; } = string.Empty;
        public string? PackageDescription { get; set; }
        public List<string> IncludedServices { get; set; } = new();
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal { get; set; }
        public decimal ItemCost { get; set; }
        public decimal ItemProfit { get; set; }
    }

    public class PaymentIntentResponseDto
    {
        public string ClientSecret { get; set; } = string.Empty;
        public string PaymentIntentId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? AppliedOfferCode { get; set; }
    }

    public enum DayAvailabilityStatus
    {
        Available,
        Medium,
        Full
    }

    public class DayAvailabilityDto
    {
        public DateTime Date { get; set; }
        public DayAvailabilityStatus Status { get; set; }
        public int TotalSlots { get; set; }
        public int FreeSlots { get; set; }
        public int Capacity { get; set; }
        public int Reserved { get; set; }
        public decimal UtilizationPercent { get; set; }
    }

    public class BookingConstraintsDto
    {
        public int MinimumJobDurationMinutes { get; set; }
        public int SlotStepMinutes { get; set; }
        public int WorkerTravelBufferMinutes { get; set; }
        /// <summary>Business day open time, e.g. "09:00"</summary>
        public string BusinessHoursStart { get; set; } = "09:00";
        /// <summary>Business day close time, e.g. "18:00"</summary>
        public string BusinessHoursEnd { get; set; } = "18:00";
    }

    public class WorkerDailyLoadDto
    {
        public int WorkerId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? ShiftStart { get; set; }
        public string? ShiftEnd { get; set; }
        public bool WorksOnDay { get; set; }
        public int BookingsCount { get; set; }
        public int TotalShiftMinutes { get; set; }
        public int UsableFreeMinutes { get; set; }
        public int AvailableStartCount { get; set; }
        public decimal UtilizationPercent { get; set; }
    }

    public class WorkerScheduleDayDto
    {
        public DateTime Date { get; set; }
        public DayAvailabilityStatus Status { get; set; }
        public int MinimumJobDurationMinutes { get; set; }
        public int TotalWorkers { get; set; }
        public int ActiveWorkersForDay { get; set; }
        public int TotalStartsCapacity { get; set; }
        public int AvailableStarts { get; set; }
        public decimal UtilizationPercent { get; set; }
        public List<WorkerDailyLoadDto> Workers { get; set; } = new();
    }

    public class AssignWorkerDto
    {
        [Required]
        public int BookingId { get; set; }

        public int? WorkerId { get; set; }

        /// <summary>
        /// Admin override: skip shift-hours and working-day checks.
        /// </summary>
        public bool ForceAssign { get; set; }
    }

    public class WorkerAbsenceDto
    {
        [Required]
        public int WorkerId { get; set; }

        [Required]
        public DateTime FromDate { get; set; }

        [Required]
        public DateTime ToDate { get; set; }

        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    public class WorkerAbsenceResultDto
    {
        public int Reassigned { get; set; }
        public int Unassigned { get; set; }
        public List<string> UnassignedBookingNumbers { get; set; } = new();
        public string Summary { get; set; } = string.Empty;
    }

    public class RequestCancellationDto
    {
        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;
    }

    public class RequestRescheduleDto
    {
        [MaxLength(500)]
        public string? Reason { get; set; }

        [MaxLength(100)]
        public string? PreferredDate { get; set; }

        [MaxLength(50)]
        public string? PreferredTime { get; set; }
    }

    public class NotificationDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public int? BookingId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class WorkerAvailabilityDto
    {
        public int WorkerId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
        public string? Note { get; set; }
    }   
    public class PauseJobDto
    {
        [Required]
        [MaxLength(250)]
        public string Reason { get; set; } = string.Empty;
    }

    public class AddBookingPackageDto
    {
        [Required]
        public int PackageId { get; set; }

        [Range(1, 10)]
        public int Quantity { get; set; } = 1;
    }

    public class AddBookingServiceDto
    {
        [Required]
        public int ServiceId { get; set; }

        [Range(1, 10)]
        public int Quantity { get; set; } = 1;
    }

    // ── Admin: full booking edit ─────────────────────────────────────────────
    public class AdminEditBookingDto
    {
        public DateTime? ScheduledDate { get; set; }

        [MaxLength(20)]
        public string? TimeSlot { get; set; }

        [MaxLength(100)]
        public string? VehicleMake { get; set; }

        [MaxLength(100)]
        public string? VehicleModel { get; set; }

        [MaxLength(4)]
        public string? VehicleYear { get; set; }

        public VehicleType? VehicleType { get; set; }

        [MaxLength(500)]
        public string? CustomerAddress { get; set; }

        [MaxLength(100)]
        public string? HouseNumber { get; set; }

        [MaxLength(50)]
        public string? AddressType { get; set; }

        [MaxLength(500)]
        public string? SpecialInstructions { get; set; }

        /// <summary>
        /// When provided, replaces the booking's package selection entirely.
        /// Leave null to keep existing packages unchanged.
        /// </summary>
        public List<EditPackageItemDto>? Packages { get; set; }
    }

    public class EditPackageItemDto
    {
        [Required]
        public int PackageId { get; set; }

        [Range(1, 10)]
        public int Quantity { get; set; } = 1;
    }

    // ── Cancellation fee calculation ─────────────────────────────────────────
    public class CancellationFeeInfoDto
    {
        public bool FeeEnabled { get; set; }
        public string FeeType { get; set; } = "Percent"; // "Percent" or "Flat"
        public decimal FeeAmount { get; set; }
        public int FreeWindowHours { get; set; }
        public decimal BookingTotal { get; set; }
        public decimal CalculatedFee { get; set; }
        public bool WithinFreeWindow { get; set; }
        public double HoursUntilAppointment { get; set; }
    }

    // ── Admin: cancel booking + Stripe void/refund ───────────────────────────
    public class AdminCancelRefundDto
    {
        /// <summary>
        /// Optional override for the refund amount (0 – booking total).
        /// When null the backend auto-calculates total minus cancellation fee.
        /// </summary>
        [Range(0, (double)decimal.MaxValue, ErrorMessage = "Refund amount cannot be negative.")]
        public decimal? RefundAmountOverride { get; set; }

        [MaxLength(500)]
        public string? CancellationNote { get; set; }
    }

    public class AdminCancelRefundResultDto
    {
        public string Message { get; set; } = string.Empty;
        public string BookingStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public decimal RefundedAmount { get; set; }
        public string? StripeRefundId { get; set; }
        /// <summary>"Voided" | "Refunded" | "NoPayment" | "AlreadyCancelled"</summary>
        public string StripeAction { get; set; } = string.Empty;
    }

    // ── Cancellation policy settings (admin) ─────────────────────────────────
    public class CancellationPolicyDto
    {
        public bool FeeEnabled { get; set; }
        public string FeeType { get; set; } = "Percent";
        public decimal FeeAmount { get; set; }
        public int FreeWindowHours { get; set; }
    }

    public class WhatsAppBusinessDto
    {
        public string? WhatsAppBusinessNumber { get; set; }
    }

    public class BusinessHoursDto
    {
        /// <summary>Opening time, e.g. "09:00"</summary>
        [Required]
        public string DayStart { get; set; } = "09:00";
        /// <summary>Closing time, e.g. "18:00"</summary>
        [Required]
        public string DayEnd { get; set; } = "18:00";
    }

    public class BusinessHoursPerDayDto
    {
        public string Sunday { get; set; } = "09:00-18:00";
        public string Monday { get; set; } = "09:00-18:00";
        public string Tuesday { get; set; } = "09:00-18:00";
        public string Wednesday { get; set; } = "09:00-18:00";
        public string Thursday { get; set; } = "09:00-18:00";
        public string Friday { get; set; } = "00:00-00:00";
        public string Saturday { get; set; } = "10:00-16:00";
    }

    // ── Customer: self-service booking edit ─────────────────────────────────
    public class CustomerEditBookingDto
    {
        public DateTime? ScheduledDate { get; set; }

        [MaxLength(20)]
        public string? TimeSlot { get; set; }

        [MaxLength(100)]
        public string? VehicleMake { get; set; }

        [MaxLength(100)]
        public string? VehicleModel { get; set; }

        [MaxLength(4)]
        public string? VehicleYear { get; set; }

        public VehicleType? VehicleType { get; set; }

        [MaxLength(500)]
        public string? CustomerAddress { get; set; }

        [MaxLength(100)]
        public string? HouseNumber { get; set; }

        [MaxLength(50)]
        public string? AddressType { get; set; }

        [MaxLength(500)]
        public string? SpecialInstructions { get; set; }

        /// <summary>
        /// When provided, replaces the booking's package selection entirely.
        /// Leave null to keep existing packages unchanged.
        /// </summary>
        public List<EditPackageItemDto>? Packages { get; set; }
    }

    // ── Day-level visual timeline (Outlook-style schedule) ───────────────────
    public class DayBookingSlotDto
    {
        public int BookingId { get; set; }
        public string BookingNumber { get; set; } = string.Empty;
        /// <summary>Start time string, e.g. "09:00"</summary>
        public string StartTime { get; set; } = string.Empty;
        public int EstimatedDurationMinutes { get; set; }
        public string Status { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public string PackagesSummary { get; set; } = string.Empty;
    }

    public class WorkerDayTimelineDto
    {
        public int WorkerId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string ShiftStart { get; set; } = string.Empty;
        public string ShiftEnd { get; set; } = string.Empty;
        public bool WorksOnDay { get; set; }
        public List<DayBookingSlotDto> Bookings { get; set; } = new();
    }

    // ── Chatbot ──────────────────────────────────────────────────────────────
    public class ChatMessageDto
    {
        [Required]
        [MaxLength(2000)]
        public string Message { get; set; } = string.Empty;
    }

    public class ChatReplyDto
    {
        public string Reply { get; set; } = string.Empty;
        public bool IsAI { get; set; } = true;
    }

    // ── Booking quote (server-calculated price breakdown) ─────────────────────
    // Mobile calls POST /Bookings/quote before confirming a booking to get the
    // authoritative price from the backend instead of computing it client-side.
    public class BookingQuoteRequestDto
    {
        [Required]
        public List<BookingPackageDto> Packages { get; set; } = new();

        public VehicleType VehicleType { get; set; } = VehicleType.Sedan;

        /// <summary>Optional: active subscription ID to apply discount.</summary>
        public int? CustomerSubscriptionId { get; set; }

        /// <summary>Optional: offer/coupon code to apply.</summary>
        [MaxLength(80)]
        public string? OfferCode { get; set; }
    }

    public class BookingQuoteDto
    {
        /// <summary>Sum of (package.Price × vehicleMultiplier × qty) before any discounts.</summary>
        public decimal BaseAmount { get; set; }

        /// <summary>Vehicle type multiplier used (e.g. 1.25 for SUV).</summary>
        public decimal VehicleMultiplier { get; set; }

        /// <summary>Subscription discount percentage (0 if not applicable).</summary>
        public decimal SubscriptionDiscountPercent { get; set; }

        /// <summary>Monetary amount deducted by subscription discount.</summary>
        public decimal SubscriptionDiscountAmount { get; set; }

        /// <summary>Monetary amount deducted by offer code.</summary>
        public decimal OfferDiscountAmount { get; set; }

        /// <summary>Total discount (subscription + offer).</summary>
        public decimal TotalDiscountAmount { get; set; }

        /// <summary>Final amount the customer pays.</summary>
        public decimal FinalPrice { get; set; }

        /// <summary>Offer code that was successfully applied (null if none).</summary>
        public string? AppliedOfferCode { get; set; }
    }

    public class UploadBookingPhotoDto
    {
        [Required]
        public IFormFile Photo { get; set; } = null!;

        /// <summary>"Before" or "After"</summary>
        [Required]
        [StringLength(10)]
        public string PhotoType { get; set; } = "Before";

        [StringLength(500)]
        public string? Caption { get; set; }
    }
}