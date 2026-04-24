using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Glanz.API.check;

public partial class GlanzDbContext : DbContext
{
    public GlanzDbContext()
    {
    }

    public GlanzDbContext(DbContextOptions<GlanzDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Availability> Availabilities { get; set; }

    public virtual DbSet<Booking> Bookings { get; set; }

    public virtual DbSet<BookingChecklistItem> BookingChecklistItems { get; set; }

    public virtual DbSet<BookingItem> BookingItems { get; set; }

    public virtual DbSet<BookingPhoto> BookingPhotos { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<Offer> Offers { get; set; }

    public virtual DbSet<Package> Packages { get; set; }

    public virtual DbSet<PackageService> PackageServices { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    public virtual DbSet<Service> Services { get; set; }

    public virtual DbSet<ServiceProduct> ServiceProducts { get; set; }

    public virtual DbSet<ServiceSubscription> ServiceSubscriptions { get; set; }

    public virtual DbSet<SlotReservation> SlotReservations { get; set; }

    public virtual DbSet<SubscriptionBooking> SubscriptionBookings { get; set; }

    public virtual DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }

    public virtual DbSet<SubscriptionPlanBenefit> SubscriptionPlanBenefits { get; set; }

    public virtual DbSet<SubscriptionPlanFeature> SubscriptionPlanFeatures { get; set; }

    public virtual DbSet<SubscriptionPlanPackage> SubscriptionPlanPackages { get; set; }

    public virtual DbSet<SystemSetting> SystemSettings { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserOffer> UserOffers { get; set; }

    public virtual DbSet<UserSubscription> UserSubscriptions { get; set; }

    public virtual DbSet<Vehicle> Vehicles { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=glanz_db;Username=postgres;Password=Passme123!");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Availability>(entity =>
        {
            entity.HasIndex(e => new { e.Date, e.TimeSlot }, "IX_Availabilities_Date_TimeSlot").IsUnique();

            entity.Property(e => e.TimeSlot).HasMaxLength(20);
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasIndex(e => e.AssignedWorkerId, "IX_Bookings_AssignedWorkerId");

            entity.HasIndex(e => e.BookingNumber, "IX_Bookings_BookingNumber").IsUnique();

            entity.HasIndex(e => e.UserId, "IX_Bookings_UserId");

            entity.Property(e => e.AddressType).HasMaxLength(50);
            entity.Property(e => e.AppliedOfferCode).HasMaxLength(80);
            entity.Property(e => e.BookingNumber).HasMaxLength(50);
            entity.Property(e => e.CustomerAddress).HasMaxLength(500);
            entity.Property(e => e.CustomerEmail).HasMaxLength(255);
            entity.Property(e => e.CustomerName).HasMaxLength(200);
            entity.Property(e => e.CustomerPhone).HasMaxLength(20);
            entity.Property(e => e.DiscountAmount).HasPrecision(10, 2);
            entity.Property(e => e.EstimatedCost).HasPrecision(10, 2);
            entity.Property(e => e.EstimatedProfit).HasPrecision(10, 2);
            entity.Property(e => e.HouseNumber).HasMaxLength(100);
            entity.Property(e => e.IdempotencyKey).HasMaxLength(100);
            entity.Property(e => e.StripePaymentIntentId).HasMaxLength(255);
            entity.Property(e => e.TimeSlot).HasMaxLength(20);
            entity.Property(e => e.TotalAmount).HasPrecision(10, 2);
            entity.Property(e => e.VehicleMake).HasMaxLength(100);
            entity.Property(e => e.VehicleModel).HasMaxLength(100);
            entity.Property(e => e.VehicleYear).HasMaxLength(4);

            entity.HasOne(d => d.AssignedWorker).WithMany(p => p.BookingAssignedWorkers).HasForeignKey(d => d.AssignedWorkerId);

            entity.HasOne(d => d.User).WithMany(p => p.BookingUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BookingChecklistItem>(entity =>
        {
            entity.HasIndex(e => e.BookingId, "IX_BookingChecklistItems_BookingId");

            entity.Property(e => e.Label).HasMaxLength(200);

            entity.HasOne(d => d.Booking).WithMany(p => p.BookingChecklistItems).HasForeignKey(d => d.BookingId);
        });

        modelBuilder.Entity<BookingItem>(entity =>
        {
            entity.HasIndex(e => e.BookingId, "IX_BookingItems_BookingId");

            entity.HasIndex(e => e.PackageId, "IX_BookingItems_PackageId");

            entity.Property(e => e.ItemCost).HasPrecision(10, 2);
            entity.Property(e => e.Price).HasPrecision(10, 2);

            entity.HasOne(d => d.Booking).WithMany(p => p.BookingItems).HasForeignKey(d => d.BookingId);

            entity.HasOne(d => d.Package).WithMany(p => p.BookingItems)
                .HasForeignKey(d => d.PackageId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingPhoto>(entity =>
        {
            entity.HasIndex(e => e.BookingId, "IX_BookingPhotos_BookingId");

            entity.HasIndex(e => e.UploadedByWorkerId, "IX_BookingPhotos_UploadedByWorkerId");

            entity.Property(e => e.Caption).HasMaxLength(500);
            entity.Property(e => e.ImageUrl).HasMaxLength(1000);

            entity.HasOne(d => d.Booking).WithMany(p => p.BookingPhotos).HasForeignKey(d => d.BookingId);

            entity.HasOne(d => d.UploadedByWorker).WithMany(p => p.BookingPhotos).HasForeignKey(d => d.UploadedByWorkerId);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(e => new { e.AdminId, e.IsRead }, "IX_Notifications_AdminId_IsRead");

            entity.HasIndex(e => e.BookingId, "IX_Notifications_BookingId");

            entity.HasIndex(e => new { e.UserId, e.IsRead }, "IX_Notifications_UserId_IsRead");

            entity.Property(e => e.Message).HasMaxLength(500);

            entity.HasOne(d => d.Admin).WithMany(p => p.NotificationAdmins)
                .HasForeignKey(d => d.AdminId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.Booking).WithMany(p => p.Notifications).HasForeignKey(d => d.BookingId);

            entity.HasOne(d => d.User).WithMany(p => p.NotificationUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Offer>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_Offers_Code").IsUnique();

            entity.Property(e => e.Code).HasMaxLength(60);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DiscountValue).HasPrecision(10, 2);
            entity.Property(e => e.MinBookingAmount).HasPrecision(10, 2);
            entity.Property(e => e.Name).HasMaxLength(120);
        });

        modelBuilder.Entity<Package>(entity =>
        {
            entity.HasIndex(e => e.Name, "IX_Packages_Name").IsUnique();

            entity.Property(e => e.ImageUrl).HasMaxLength(500);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Price).HasPrecision(10, 2);
            entity.Property(e => e.Tier).HasMaxLength(50);
        });

        modelBuilder.Entity<PackageService>(entity =>
        {
            entity.HasIndex(e => e.PackageId, "IX_PackageServices_PackageId");

            entity.HasIndex(e => e.ServiceId, "IX_PackageServices_ServiceId");

            entity.HasOne(d => d.Package).WithMany(p => p.PackageServices).HasForeignKey(d => d.PackageId);

            entity.HasOne(d => d.Service).WithMany(p => p.PackageServices)
                .HasForeignKey(d => d.ServiceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(e => e.CostPerUnit).HasPrecision(10, 2);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Unit).HasMaxLength(20);
            entity.Property(e => e.Vendor).HasMaxLength(100);
        });

        modelBuilder.Entity<Service>(entity =>
        {
            entity.Property(e => e.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<ServiceProduct>(entity =>
        {
            entity.HasIndex(e => e.ProductId, "IX_ServiceProducts_ProductId");

            entity.HasIndex(e => e.ServiceId, "IX_ServiceProducts_ServiceId");

            entity.Property(e => e.QuantityUsed).HasPrecision(10, 2);

            entity.HasOne(d => d.Product).WithMany(p => p.ServiceProducts)
                .HasForeignKey(d => d.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Service).WithMany(p => p.ServiceProducts).HasForeignKey(d => d.ServiceId);
        });

        modelBuilder.Entity<ServiceSubscription>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_ServiceSubscriptions_Code").IsUnique();

            entity.HasIndex(e => e.PackageId, "IX_ServiceSubscriptions_PackageId");

            entity.HasIndex(e => new { e.UserId, e.IsActive }, "IX_ServiceSubscriptions_UserId_IsActive");

            entity.Property(e => e.Code).HasMaxLength(80);
            entity.Property(e => e.DiscountPercent).HasPrecision(5, 2);
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.PricePerCycle).HasPrecision(10, 2);

            entity.HasOne(d => d.Package).WithMany(p => p.ServiceSubscriptions)
                .HasForeignKey(d => d.PackageId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.User).WithMany(p => p.ServiceSubscriptions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SlotReservation>(entity =>
        {
            entity.Property(e => e.CustomerEmail).HasMaxLength(254);
            entity.Property(e => e.PaymentIntentId).HasMaxLength(120);
            entity.Property(e => e.TimeSlot).HasMaxLength(20);
        });

        modelBuilder.Entity<SubscriptionBooking>(entity =>
        {
            entity.HasIndex(e => e.BookingNumber, "IX_SubscriptionBookings_BookingNumber").IsUnique();

            entity.HasIndex(e => e.PackageId, "IX_SubscriptionBookings_PackageId");

            entity.HasIndex(e => new { e.ScheduledDate, e.TimeSlot }, "IX_SubscriptionBookings_ScheduledDate_TimeSlot");

            entity.HasIndex(e => new { e.UserId, e.Status }, "IX_SubscriptionBookings_UserId_Status");

            entity.HasIndex(e => e.UserSubscriptionId, "IX_SubscriptionBookings_UserSubscriptionId");

            entity.HasIndex(e => e.WorkerId, "IX_SubscriptionBookings_WorkerId");

            entity.Property(e => e.BookingNumber).HasMaxLength(50);
            entity.Property(e => e.DiscountAmount).HasPrecision(10, 2);
            entity.Property(e => e.FinalAmount).HasPrecision(10, 2);
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.OriginalAmount).HasPrecision(10, 2);
            entity.Property(e => e.TimeSlot).HasMaxLength(20);

            entity.HasOne(d => d.Package).WithMany(p => p.SubscriptionBookings)
                .HasForeignKey(d => d.PackageId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.User).WithMany(p => p.SubscriptionBookingUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.UserSubscription).WithMany(p => p.SubscriptionBookings)
                .HasForeignKey(d => d.UserSubscriptionId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.Worker).WithMany(p => p.SubscriptionBookingWorkers)
                .HasForeignKey(d => d.WorkerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SubscriptionPlan>(entity =>
        {
            entity.HasIndex(e => new { e.VehicleType, e.IsActive, e.DisplayOrder }, "IX_SubscriptionPlans_VehicleType_IsActive_DisplayOrder");

            entity.Property(e => e.DiscountPercent).HasPrecision(5, 2);
            entity.Property(e => e.Name).HasMaxLength(120);
            entity.Property(e => e.Price).HasPrecision(10, 2);
        });

        modelBuilder.Entity<SubscriptionPlanBenefit>(entity =>
        {
            entity.HasIndex(e => e.PlanId, "IX_SubscriptionPlanBenefits_PlanId");

            entity.Property(e => e.BenefitText).HasMaxLength(200);

            entity.HasOne(d => d.Plan).WithMany(p => p.SubscriptionPlanBenefits).HasForeignKey(d => d.PlanId);
        });

        modelBuilder.Entity<SubscriptionPlanFeature>(entity =>
        {
            entity.HasIndex(e => e.PlanId, "IX_SubscriptionPlanFeatures_PlanId");

            entity.Property(e => e.FeatureText).HasMaxLength(200);

            entity.HasOne(d => d.Plan).WithMany(p => p.SubscriptionPlanFeatures).HasForeignKey(d => d.PlanId);
        });

        modelBuilder.Entity<SubscriptionPlanPackage>(entity =>
        {
            entity.HasIndex(e => e.PackageId, "IX_SubscriptionPlanPackages_PackageId");

            entity.HasIndex(e => new { e.PlanId, e.DisplayOrder }, "IX_SubscriptionPlanPackages_PlanId_DisplayOrder");

            entity.HasOne(d => d.Package).WithMany(p => p.SubscriptionPlanPackages)
                .HasForeignKey(d => d.PackageId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Plan).WithMany(p => p.SubscriptionPlanPackages).HasForeignKey(d => d.PlanId);
        });

        modelBuilder.Entity<SystemSetting>(entity =>
        {
            entity.HasKey(e => e.Key);

            entity.Property(e => e.Key).HasMaxLength(100);
            entity.Property(e => e.Value).HasMaxLength(500);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email, "IX_Users_Email").IsUnique();

            entity.HasIndex(e => e.Phone, "IX_Users_Phone")
                .IsUnique()
                .HasFilter("((\"Phone\" IS NOT NULL) AND ((\"Phone\")::text <> ''::text))");

            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.ExpoPushToken).HasMaxLength(500);
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.HomeAddress).HasMaxLength(500);
            entity.Property(e => e.HomeHouseNumber).HasMaxLength(100);
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.MonthlySalary).HasPrecision(10, 2);
            entity.Property(e => e.OtherAddress).HasMaxLength(500);
            entity.Property(e => e.OtherHouseNumber).HasMaxLength(100);
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.PreferredAddressType).HasMaxLength(20);
            entity.Property(e => e.ProfileImageUrl).HasMaxLength(1000);
            entity.Property(e => e.Role).HasMaxLength(20);
            entity.Property(e => e.ShiftEnd).HasMaxLength(10);
            entity.Property(e => e.ShiftStart).HasMaxLength(10);
            entity.Property(e => e.WorkAddress).HasMaxLength(500);
            entity.Property(e => e.WorkHouseNumber).HasMaxLength(100);
            entity.Property(e => e.WorkingDays).HasMaxLength(200);
        });

        modelBuilder.Entity<UserOffer>(entity =>
        {
            entity.HasIndex(e => e.OfferId, "IX_UserOffers_OfferId");

            entity.HasIndex(e => e.PersonalCode, "IX_UserOffers_PersonalCode").IsUnique();

            entity.HasIndex(e => new { e.UserId, e.OfferId, e.EarnedAtCompletedBookingsCount }, "IX_UserOffers_UserId_OfferId_EarnedAtCompletedBookingsCount").IsUnique();

            entity.Property(e => e.PersonalCode).HasMaxLength(80);

            entity.HasOne(d => d.Offer).WithMany(p => p.UserOffers).HasForeignKey(d => d.OfferId);

            entity.HasOne(d => d.User).WithMany(p => p.UserOffers).HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<UserSubscription>(entity =>
        {
            entity.HasIndex(e => new { e.PlanId, e.Status }, "IX_UserSubscriptions_PlanId_Status");

            entity.HasIndex(e => new { e.UserId, e.Status }, "IX_UserSubscriptions_UserId_Status");

            entity.HasOne(d => d.Plan).WithMany(p => p.UserSubscriptions)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.User).WithMany(p => p.UserSubscriptions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_Vehicles_UserId");

            entity.Property(e => e.Color).HasMaxLength(50);
            entity.Property(e => e.ImageUrl).HasMaxLength(1000);
            entity.Property(e => e.Make).HasMaxLength(100);
            entity.Property(e => e.Model).HasMaxLength(100);
            entity.Property(e => e.Nickname).HasMaxLength(100);
            entity.Property(e => e.PlateNumber).HasMaxLength(50);
            entity.Property(e => e.Year).HasMaxLength(4);

            entity.HasOne(d => d.User).WithMany(p => p.Vehicles).HasForeignKey(d => d.UserId);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
