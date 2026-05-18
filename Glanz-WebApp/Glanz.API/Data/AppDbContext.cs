using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Glanz.API.Models;
using Glanz.API.Modules.AI.Models;
using Glanz.API.Modules.Reseller;
using Glanz.API.Modules.Webhooks;
using Glanz.API.Modules.SSO;
using Glanz.API.Platform.Tenancy;

namespace Glanz.API.Data
{
    public class AppDbContext : DbContext
    {
        private readonly TenantContext? _tenantContext;

        public AppDbContext(DbContextOptions<AppDbContext> options, TenantContext? tenantContext = null) : base(options)
        {
            _tenantContext = tenantContext;
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            base.OnConfiguring(optionsBuilder);
        }

        private int CurrentOrgId => _tenantContext?.OrgId ?? 1;
        private bool IsPlatformAdmin => _tenantContext?.IsPlatformAdmin ?? false;

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
        public DbSet<PageView> PageViews { get; set; }
        public DbSet<AttendanceLog> AttendanceLogs { get; set; }
        public DbSet<RecurringBookingRule> RecurringBookingRules { get; set; }
        public DbSet<WaitlistEntry> WaitlistEntries { get; set; }
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<PurchaseOrder> PurchaseOrders { get; set; }
        public DbSet<PurchaseOrderItem> PurchaseOrderItems { get; set; }

        // Platform: multi-tenancy
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<OrganizationLocation> OrganizationLocations { get; set; }
        public DbSet<OrganizationBranding> OrganizationBrandings { get; set; }

        // Platform: billing
        public DbSet<PlatformPlan> PlatformPlans { get; set; }
        public DbSet<OrganizationSubscription> OrganizationSubscriptions { get; set; }
        public DbSet<UsageRecord> UsageRecords { get; set; }

        // Platform: domain abstraction
        public DbSet<AssetCategory> AssetCategories { get; set; }
        public DbSet<ClientAsset> ClientAssets { get; set; }

        // Platform: RBAC
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }

        // Platform: resources
        public DbSet<Resource> Resources { get; set; }
        public DbSet<ResourceBooking> ResourceBookings { get; set; }

        // Platform: custom fields
        public DbSet<CustomFieldDefinition> CustomFieldDefinitions { get; set; }
        public DbSet<CustomFieldValue> CustomFieldValues { get; set; }

        // Platform: event store
        public DbSet<DomainEvent> DomainEvents { get; set; }

        // Platform: tenant config
        public DbSet<TenantConfigurationSnapshot> TenantConfigurationSnapshots { get; set; }
        public DbSet<TenantFeatureFlag> TenantFeatureFlags { get; set; }

        // Notification configuration per org
        public DbSet<OrgNotificationConfig> OrgNotificationConfigs { get; set; }

        // Package add-ons
        public DbSet<ServiceAddOn> ServiceAddOns { get; set; }
        public DbSet<BookingAddOn> BookingAddOns { get; set; }

        // Loyalty points
        public DbSet<LoyaltyAccount> LoyaltyAccounts { get; set; }
        public DbSet<LoyaltyTransaction> LoyaltyTransactions { get; set; }
        public DbSet<OrgLoyaltyConfig> OrgLoyaltyConfigs { get; set; }

        // Staff certifications
        public DbSet<StaffCertification> StaffCertifications { get; set; }

        // Worker ratings
        public DbSet<StaffRating> StaffRatings { get; set; }

        // Corporate / fleet accounts
        public DbSet<CorporateAccount> CorporateAccounts { get; set; }
        public DbSet<CorporateAccountMember> CorporateAccountMembers { get; set; }

        // Platform: automation
        public DbSet<BookingRule> BookingRules { get; set; }
        public DbSet<AutomationRule> AutomationRules { get; set; }

        // Platform: industry templates
        public DbSet<IndustryTemplate> IndustryTemplates { get; set; }

        // AI module
        public DbSet<AIConversation> AIConversations { get; set; }

        // Enterprise SSO
        public DbSet<SsoConfiguration> SsoConfigurations { get; set; }

        // Reseller / agency console
        public DbSet<ResellerProfile> ResellerProfiles { get; set; }
        public DbSet<ResellerManagedOrg> ResellerManagedOrgs { get; set; }

        // Webhooks
        public DbSet<WebhookSubscription> WebhookSubscriptions { get; set; }
        public DbSet<WebhookDelivery> WebhookDeliveries { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Global query filters: enforce tenant isolation on all OrgId-scoped tables.
            // OR OrgId IS NULL handles the migration period before backfill enforces NOT NULL.
            // Platform admin bypass: when IsPlatformAdmin the filter is a no-op (returns all rows).
            modelBuilder.Entity<User>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Staff>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Booking>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<BookingItem>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<BookingChecklistItem>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<BookingPhoto>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Package>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<PackageService>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Service>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ServiceProduct>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Product>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Offer>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<UserOffer>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Notification>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ServiceSubscription>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<SubscriptionPlan>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<UserSubscription>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<SubscriptionBooking>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<SubscriptionPlanPackage>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Vehicle>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<SlotReservation>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<WorkerLocation>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<JobApplication>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<JobPosition>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<AuditLog>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<CustomerFeedback>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Lead>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Referral>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<PageView>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<AttendanceLog>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Availability>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<RecurringBookingRule>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<WaitlistEntry>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);

            // Platform: tenant-scoped tables
            modelBuilder.Entity<AssetCategory>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ClientAsset>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<Resource>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<CustomFieldDefinition>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<CustomFieldValue>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<DomainEvent>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<TenantConfigurationSnapshot>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<TenantFeatureFlag>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<BookingRule>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<AutomationRule>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<OrganizationSubscription>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<UsageRecord>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<AIConversation>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<SsoConfiguration>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ResellerProfile>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ResellerManagedOrg>().HasQueryFilter(e => IsPlatformAdmin || e.ResellerOrgId == CurrentOrgId);
            modelBuilder.Entity<WebhookSubscription>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<WebhookDelivery>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<ServiceAddOn>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<LoyaltyAccount>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<LoyaltyTransaction>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<StaffCertification>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<StaffRating>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == null || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<CorporateAccount>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);
            modelBuilder.Entity<CorporateAccountMember>().HasQueryFilter(e => IsPlatformAdmin || e.OrgId == CurrentOrgId);

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

            // Platform: RBAC
            modelBuilder.Entity<Permission>()
                .HasIndex(p => p.Key)
                .IsUnique();

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<RolePermission>()
                .HasIndex(rp => new { rp.Role, rp.PermissionId })
                .IsUnique();

            // Platform: resources
            modelBuilder.Entity<Resource>()
                .HasOne(r => r.Organization)
                .WithMany()
                .HasForeignKey(r => r.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ResourceBooking>()
                .HasOne(rb => rb.Resource)
                .WithMany(r => r.ResourceBookings)
                .HasForeignKey(rb => rb.ResourceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ResourceBooking>()
                .HasOne(rb => rb.Booking)
                .WithMany()
                .HasForeignKey(rb => rb.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            // Platform: custom fields
            modelBuilder.Entity<CustomFieldDefinition>()
                .HasOne(cf => cf.Organization)
                .WithMany()
                .HasForeignKey(cf => cf.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CustomFieldDefinition>()
                .HasIndex(cf => new { cf.OrgId, cf.EntityType, cf.FieldKey })
                .IsUnique();

            modelBuilder.Entity<CustomFieldValue>()
                .HasOne(v => v.Organization)
                .WithMany()
                .HasForeignKey(v => v.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CustomFieldValue>()
                .HasOne(v => v.FieldDefinition)
                .WithMany(d => d.Values)
                .HasForeignKey(v => v.FieldDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CustomFieldValue>()
                .HasIndex(v => new { v.OrgId, v.EntityType, v.EntityId, v.FieldDefinitionId })
                .IsUnique();

            // Platform: event store
            modelBuilder.Entity<DomainEvent>()
                .HasOne(e => e.Organization)
                .WithMany()
                .HasForeignKey(e => e.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DomainEvent>()
                .HasIndex(e => new { e.OrgId, e.EventType, e.OccurredAt });

            modelBuilder.Entity<DomainEvent>()
                .HasIndex(e => e.ProcessedAt);

            // Platform: tenant config
            modelBuilder.Entity<TenantConfigurationSnapshot>()
                .HasOne(s => s.Organization)
                .WithMany()
                .HasForeignKey(s => s.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TenantConfigurationSnapshot>()
                .HasIndex(s => new { s.OrgId, s.Version })
                .IsUnique();

            modelBuilder.Entity<TenantFeatureFlag>()
                .HasOne(f => f.Organization)
                .WithMany()
                .HasForeignKey(f => f.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TenantFeatureFlag>()
                .HasIndex(f => new { f.OrgId, f.FeatureKey })
                .IsUnique();

            // Platform: automation
            modelBuilder.Entity<BookingRule>()
                .HasOne(r => r.Organization)
                .WithMany()
                .HasForeignKey(r => r.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AutomationRule>()
                .HasOne(r => r.Organization)
                .WithMany()
                .HasForeignKey(r => r.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            // Platform: industry templates
            modelBuilder.Entity<IndustryTemplate>()
                .HasIndex(t => t.Key)
                .IsUnique();

            // Platform: domain abstraction
            modelBuilder.Entity<AssetCategory>()
                .HasOne(ac => ac.Organization)
                .WithMany()
                .HasForeignKey(ac => ac.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ClientAsset>()
                .HasOne(ca => ca.Organization)
                .WithMany()
                .HasForeignKey(ca => ca.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ClientAsset>()
                .HasOne(ca => ca.AssetCategory)
                .WithMany(ac => ac.ClientAssets)
                .HasForeignKey(ca => ca.AssetCategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<ClientAsset>()
                .HasIndex(ca => new { ca.OrgId, ca.CustomerId });

            // Platform: billing
            modelBuilder.Entity<OrganizationSubscription>()
                .HasOne(s => s.Organization)
                .WithMany()
                .HasForeignKey(s => s.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationSubscription>()
                .HasOne(s => s.Plan)
                .WithMany(p => p.OrganizationSubscriptions)
                .HasForeignKey(s => s.PlanId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<OrganizationSubscription>()
                .HasIndex(s => new { s.OrgId, s.Status });

            modelBuilder.Entity<UsageRecord>()
                .HasOne(u => u.Organization)
                .WithMany()
                .HasForeignKey(u => u.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UsageRecord>()
                .HasIndex(u => new { u.OrgId, u.Year, u.Month })
                .IsUnique();

            // Platform: Organizations
            modelBuilder.Entity<Organization>()
                .HasIndex(o => o.Slug)
                .IsUnique();

            modelBuilder.Entity<OrganizationLocation>()
                .HasOne(l => l.Organization)
                .WithMany(o => o.Locations)
                .HasForeignKey(l => l.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationBranding>()
                .HasOne(b => b.Organization)
                .WithOne(o => o.Branding)
                .HasForeignKey<OrganizationBranding>(b => b.OrgId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationBranding>()
                .HasIndex(b => b.CustomDomain)
                .IsUnique()
                .HasFilter("\"CustomDomain\" IS NOT NULL");

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
