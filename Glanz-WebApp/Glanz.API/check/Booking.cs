using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class Booking
{
    public int Id { get; set; }

    public string BookingNumber { get; set; } = null!;

    public int? UserId { get; set; }

    public DateTime ScheduledDate { get; set; }

    public string TimeSlot { get; set; } = null!;

    public int Status { get; set; }

    public int PaymentStatus { get; set; }

    public decimal TotalAmount { get; set; }

    public decimal DiscountAmount { get; set; }

    public string? AppliedOfferCode { get; set; }

    public decimal EstimatedCost { get; set; }

    public decimal EstimatedProfit { get; set; }

    public string CustomerName { get; set; } = null!;

    public string CustomerEmail { get; set; } = null!;

    public string CustomerPhone { get; set; } = null!;

    public string? CustomerAddress { get; set; }

    public string? HouseNumber { get; set; }

    public string? AddressType { get; set; }

    public string? VehicleMake { get; set; }

    public string? VehicleModel { get; set; }

    public string? VehicleYear { get; set; }

    public int VehicleType { get; set; }

    public string? SpecialInstructions { get; set; }

    public string? StripePaymentIntentId { get; set; }

    public string? IdempotencyKey { get; set; }

    public int? AssignedWorkerId { get; set; }

    public DateTime? WorkStartedAt { get; set; }

    public DateTime? WorkerArrivedAt { get; set; }

    public DateTime? WorkerRunningLateAt { get; set; }

    public DateTime? WorkCompletedAt { get; set; }

    public int? WorkDurationSeconds { get; set; }

    public DateTime? StockDeductedAt { get; set; }

    public bool CancellationRequested { get; set; }

    public string? CancellationRequestReason { get; set; }

    public DateTime? CancellationRequestedAt { get; set; }

    public bool RescheduleRequested { get; set; }

    public string? RescheduleRequestNote { get; set; }

    public string? ReschedulePreferredDate { get; set; }

    public DateTime? RescheduleRequestedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User? AssignedWorker { get; set; }

    public virtual ICollection<BookingChecklistItem> BookingChecklistItems { get; set; } = new List<BookingChecklistItem>();

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<BookingPhoto> BookingPhotos { get; set; } = new List<BookingPhoto>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual User? User { get; set; }
}
