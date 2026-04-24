using System;
using System.Collections.Generic;

namespace Glanz.API.check;

public partial class User
{
    public int Id { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? Phone { get; set; }

    public string? ProfileImageUrl { get; set; }

    public string? HomeAddress { get; set; }

    public string? HomeHouseNumber { get; set; }

    public string? WorkAddress { get; set; }

    public string? WorkHouseNumber { get; set; }

    public string? OtherAddress { get; set; }

    public string? OtherHouseNumber { get; set; }

    public string PreferredAddressType { get; set; } = null!;

    public string Role { get; set; } = null!;

    public string WorkingDays { get; set; } = null!;

    public string ShiftStart { get; set; } = null!;

    public string ShiftEnd { get; set; } = null!;

    public string? DaySchedulesJson { get; set; }

    public bool IsActive { get; set; }

    public DateTime? LoyaltyGoogleReviewActivatedAt { get; set; }

    public decimal? MonthlySalary { get; set; }

    public string? ExpoPushToken { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? LastPaidAt { get; set; }

    public int? LastPaidMonth { get; set; }

    public int? LastPaidYear { get; set; }

    public virtual ICollection<Booking> BookingAssignedWorkers { get; set; } = new List<Booking>();

    public virtual ICollection<BookingPhoto> BookingPhotos { get; set; } = new List<BookingPhoto>();

    public virtual ICollection<Booking> BookingUsers { get; set; } = new List<Booking>();

    public virtual ICollection<Notification> NotificationAdmins { get; set; } = new List<Notification>();

    public virtual ICollection<Notification> NotificationUsers { get; set; } = new List<Notification>();

    public virtual ICollection<ServiceSubscription> ServiceSubscriptions { get; set; } = new List<ServiceSubscription>();

    public virtual ICollection<SubscriptionBooking> SubscriptionBookingUsers { get; set; } = new List<SubscriptionBooking>();

    public virtual ICollection<SubscriptionBooking> SubscriptionBookingWorkers { get; set; } = new List<SubscriptionBooking>();

    public virtual ICollection<UserOffer> UserOffers { get; set; } = new List<UserOffer>();

    public virtual ICollection<UserSubscription> UserSubscriptions { get; set; } = new List<UserSubscription>();

    public virtual ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}
