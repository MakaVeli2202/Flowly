using System.ComponentModel.DataAnnotations;

namespace Glanz.API.Models
{
    /// <summary>
    /// Holds a time slot for up to 15 minutes while a customer is completing payment.
    /// Created when a PaymentIntent is generated; deleted once the booking is confirmed
    /// or by BookingMaintenanceService when the reservation expires.
    ///
    /// Design decision: no FK to Booking — the reservation exists *before* the booking
    /// is created. When CreateBooking runs, it checks for active reservations that
    /// conflict with the slot and rejects the request if another customer's intent
    /// is still holding that slot.
    /// </summary>
    public class SlotReservation
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(120)]
        public string PaymentIntentId { get; set; } = string.Empty;

        [Required]
        public DateTime ScheduledDate { get; set; }

        [Required]
        [MaxLength(20)]
        public string TimeSlot { get; set; } = string.Empty;

        public int DurationMinutes { get; set; }

        [MaxLength(254)]
        public string? CustomerEmail { get; set; }

        /// <summary>UTC timestamp after which this reservation is ignored and can be cleaned up.</summary>
        public DateTime ExpiresAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
