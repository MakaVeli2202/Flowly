using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Glanz.API.Models
{
    public class OrgNotificationConfig
    {
        [Key]
        public int OrgId { get; set; }

        // ── Birthday offer ────────────────────────────────────────────────────
        public bool BirthdayOfferEnabled { get; set; } = true;
        public int BirthdayDiscountPct { get; set; } = 20;

        [StringLength(500)]
        public string BirthdayMessageTemplate { get; set; } =
            "Happy Birthday {firstName}! Enjoy {discount}% off your next booking this week. Use code: BDAY{discount}";

        // ── First-booking anniversary offer ───────────────────────────────────
        public bool AnniversaryOfferEnabled { get; set; } = true;
        public int AnniversaryDiscountPct { get; set; } = 15;

        [StringLength(500)]
        public string AnniversaryMessageTemplate { get; set; } =
            "It's been a year since your first booking! Thanks for being with us. Here's {discount}% off: ANNIV{discount}";

        // ── Review request ────────────────────────────────────────────────────
        public bool ReviewRequestEnabled { get; set; } = true;
        public int ReviewRequestDelayHours { get; set; } = 2;

        [StringLength(500)]
        public string ReviewRequestTemplate { get; set; } =
            "How was your experience today? We'd love a quick review - it means a lot to our team!";

        // ── Booking reminder ──────────────────────────────────────────────────
        public bool ReminderEnabled { get; set; } = true;
        public int ReminderHoursBefore { get; set; } = 24;

        [StringLength(500)]
        public string ReminderTemplate { get; set; } =
            "Reminder: your booking is tomorrow at {time}. We're looking forward to seeing you!";

        // ── Escalation (no confirmation after first reminder) ─────────────────
        public bool EscalationEnabled { get; set; } = true;
        public int EscalationHoursBefore { get; set; } = 2;

        [StringLength(500)]
        public string EscalationTemplate { get; set; } =
            "Your appointment is in {hours} hours. Please confirm or call us to reschedule.";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
