using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;

namespace Glanz.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ConfigureWarnings(warnings =>
                warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Staff> Staff { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Service> Services { get; set; }
        public DbSet<ServiceProduct> ServiceProducts { get; set; }
        public DbSet<Package> Packages { get; set; }
        public DbSet<PackageService> PackageServices { get; set; }
        public DbSet<Booking> Bookings { get; set; }
        public DbSet<BookingItem> BookingItems { get; set; }
        public DbSet<BookingChecklistItem> BookingChecklistItems { get; set; }
        public DbSet<Availability> Availabilities { get; set; }
        public DbSet<Offer> Offers { get; set; }
        public DbSet<UserOffer> UserOffers { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }
        public DbSet<ServiceSubscription> ServiceSubscriptions { get; set; }
        public DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }
        public DbSet<SubscriptionPlanFeature> SubscriptionPlanFeatures { get; set; }
        public DbSet<SubscriptionPlanBenefit> SubscriptionPlanBenefits { get; set; }
        public DbSet<UserSubscription> UserSubscriptions { get; set; }
        public DbSet<SubscriptionBooking> SubscriptionBookings { get; set; }
        public DbSet<SubscriptionPlanPackage> SubscriptionPlanPackages { get; set; }
        public DbSet<Vehicle> Vehicles { get; set; }
        public DbSet<SlotReservation> SlotReservations { get; set; }
        public DbSet<BookingPhoto> BookingPhotos { get; set; }
        public DbSet<WorkerLocation> WorkerLocations { get; set; }
        public DbSet<JobApplication> JobApplications { get; set; }
        public DbSet<JobPosition> JobPositions { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<CustomerFeedback> CustomerFeedbacks { get; set; }
        public DbSet<Lead> Leads { get; set; }
        public DbSet<Referral> Referrals { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure decimal precision
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    if (property.ClrType == typeof(decimal))
                    {
                        property.SetPrecision(10);
                        property.SetScale(2);
                    }
                }
            }

            // User - Email unique
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // User - Phone unique when provided
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Phone)
                .IsUnique()
                .HasFilter("\"Phone\" IS NOT NULL AND \"Phone\" <> ''");

            // Staff - Email unique
            modelBuilder.Entity<Staff>()
                .HasIndex(s => s.Email)
                .IsUnique();

            // Booking - BookingNumber unique
            modelBuilder.Entity<Booking>()
                .HasIndex(b => b.BookingNumber)
                .IsUnique();

            // Booking - IdempotencyKey unique (nullable; null rows are excluded so they don't conflict)
            modelBuilder.Entity<Booking>()
                .HasIndex(b => b.IdempotencyKey)
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL");

            // Availability - Date + TimeSlot unique
            modelBuilder.Entity<Availability>()
                .HasIndex(a => new { a.Date, a.TimeSlot })
                .IsUnique();

            // Package - Name unique
            modelBuilder.Entity<Package>()
                .HasIndex(p => p.Name)
                .IsUnique();

            modelBuilder.Entity<Offer>()
                .HasIndex(o => o.Code)
                .IsUnique();

            modelBuilder.Entity<UserOffer>()
                .HasIndex(uo => uo.PersonalCode)
                .IsUnique();

            modelBuilder.Entity<UserOffer>()
                .HasIndex(uo => new { uo.UserId, uo.OfferId, uo.EarnedAtCompletedBookingsCount })
                .IsUnique();

            // Relationships
            modelBuilder.Entity<Booking>()
                .HasOne(b => b.User)
                .WithMany(u => u.Bookings)
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<BookingItem>()
                .HasOne(bi => bi.Booking)
                .WithMany(b => b.BookingItems)
                .HasForeignKey(bi => bi.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<BookingItem>()
                .HasOne(bi => bi.Package)
                .WithMany(p => p.BookingItems)
                .HasForeignKey(bi => bi.PackageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<BookingChecklistItem>()
                .HasOne(ci => ci.Booking)
                .WithMany(b => b.ChecklistItems)
                .HasForeignKey(ci => ci.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ServiceProduct>()
                .HasOne(sp => sp.Service)
                .WithMany(s => s.ServiceProducts)
                .HasForeignKey(sp => sp.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ServiceProduct>()
                .HasOne(sp => sp.Product)
                .WithMany(p => p.ServiceProducts)
                .HasForeignKey(sp => sp.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PackageService>()
                .HasOne(ps => ps.Package)
                .WithMany(p => p.PackageServices)
                .HasForeignKey(ps => ps.PackageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PackageService>()
                .HasOne(ps => ps.Service)
                .WithMany(s => s.PackageServices)
                .HasForeignKey(ps => ps.ServiceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserOffer>()
                .HasOne(uo => uo.User)
                .WithMany()
                .HasForeignKey(uo => uo.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserOffer>()
                .HasOne(uo => uo.Offer)
                .WithMany(o => o.UserOffers)
                .HasForeignKey(uo => uo.OfferId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.Admin)
                .WithMany()
                .HasForeignKey(n => n.AdminId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.AdminId, n.IsRead });

            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead });

            modelBuilder.Entity<SystemSetting>()
                .HasKey(s => s.Key);

            modelBuilder.Entity<SystemSetting>()
                .Property(s => s.Key)
                .HasMaxLength(100);

            modelBuilder.Entity<SystemSetting>()
                .Property(s => s.Value)
                .HasMaxLength(500);

            modelBuilder.Entity<ServiceSubscription>()
                .HasIndex(s => s.Code)
                .IsUnique();

            modelBuilder.Entity<ServiceSubscription>()
                .HasIndex(s => new { s.UserId, s.IsActive });

            modelBuilder.Entity<ServiceSubscription>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ServiceSubscription>()
                .HasOne(s => s.Package)
                .WithMany()
                .HasForeignKey(s => s.PackageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SubscriptionPlan>()
                .HasIndex(p => new { p.VehicleType, p.IsActive, p.DisplayOrder });

            modelBuilder.Entity<SubscriptionPlanFeature>()
                .HasOne(f => f.Plan)
                .WithMany(p => p.Features)
                .HasForeignKey(f => f.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SubscriptionPlanBenefit>()
                .HasOne(b => b.Plan)
                .WithMany(p => p.Benefits)
                .HasForeignKey(b => b.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserSubscription>()
                .HasIndex(s => new { s.UserId, s.Status });

            modelBuilder.Entity<UserSubscription>()
                .HasIndex(s => new { s.PlanId, s.Status });

            modelBuilder.Entity<UserSubscription>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserSubscription>()
                .HasOne(s => s.Plan)
                .WithMany(p => p.UserSubscriptions)
                .HasForeignKey(s => s.PlanId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SubscriptionBooking>()
                .HasIndex(sb => sb.BookingNumber)
                .IsUnique();

            modelBuilder.Entity<SubscriptionBooking>()
                .HasIndex(sb => new { sb.UserId, sb.Status });

            modelBuilder.Entity<SubscriptionBooking>()
                .HasIndex(sb => new { sb.ScheduledDate, sb.TimeSlot });

            modelBuilder.Entity<SubscriptionBooking>()
                .HasOne(sb => sb.User)
                .WithMany()
                .HasForeignKey(sb => sb.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<SubscriptionBooking>()
                .HasOne(sb => sb.UserSubscription)
                .WithMany()
                .HasForeignKey(sb => sb.UserSubscriptionId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<SubscriptionBooking>()
                .HasOne(sb => sb.Package)
                .WithMany()
                .HasForeignKey(sb => sb.PackageId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<SubscriptionBooking>()
                .HasOne(sb => sb.Worker)
                .WithMany()
                .HasForeignKey(sb => sb.WorkerId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<SubscriptionPlanPackage>()
                .HasIndex(pp => new { pp.PlanId, pp.DisplayOrder });

            modelBuilder.Entity<SubscriptionPlanPackage>()
                .HasOne(pp => pp.Plan)
                .WithMany(p => p.PlanPackages)
                .HasForeignKey(pp => pp.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SubscriptionPlanPackage>()
                .HasOne(pp => pp.Package)
                .WithMany()
                .HasForeignKey(pp => pp.PackageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Vehicle>()
                .HasOne(v => v.User)
                .WithMany()
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Vehicle>()
                .HasIndex(v => v.UserId);

            modelBuilder.Entity<WorkerLocation>()
                .HasIndex(wl => wl.WorkerId);

            modelBuilder.Entity<WorkerLocation>()
                .HasOne(wl => wl.Worker)
                .WithMany()
                .HasForeignKey(wl => wl.WorkerId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkerLocation>()
                .HasOne(wl => wl.Booking)
                .WithMany()
                .HasForeignKey(wl => wl.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<JobApplication>()
                .HasOne(ja => ja.JobPosition)
                .WithMany(jp => jp.Applications)
                .HasForeignKey(ja => ja.JobPositionId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<JobApplication>()
                .HasIndex(ja => ja.Email);

            modelBuilder.Entity<JobPosition>()
                .HasIndex(jp => new { jp.IsOpen, jp.Rank });

            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => new { a.UserId, a.Timestamp });

            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => new { a.Action, a.Timestamp });

            modelBuilder.Entity<CustomerFeedback>()
                .HasIndex(cf => new { cf.UserId, cf.CreatedAt });

            modelBuilder.Entity<CustomerFeedback>()
                .HasIndex(cf => cf.BookingId);

            modelBuilder.Entity<CustomerFeedback>()
                .HasOne(cf => cf.User)
                .WithMany()
                .HasForeignKey(cf => cf.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CustomerFeedback>()
                .HasOne(cf => cf.Booking)
                .WithMany()
                .HasForeignKey(cf => cf.BookingId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CustomerFeedback>()
                .HasOne(cf => cf.Worker)
                .WithMany()
                .HasForeignKey(cf => cf.WorkerId)
                .OnDelete(DeleteBehavior.SetNull);

        }
    }
}

namespace Glanz.API.Models
{
    // Keep the model definition available in a consistently loaded compilation unit.
    public partial class SystemSetting
    {
        [Key]
        [StringLength(100)]
        public string Key { get; set; } = string.Empty;

        [StringLength(500)]
        public string Value { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
