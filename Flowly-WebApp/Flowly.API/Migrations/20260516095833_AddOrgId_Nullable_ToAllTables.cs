using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgId_Nullable_ToAllTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "WorkerLocations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Vehicles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "UserSubscriptions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "UserOffers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SubscriptionPlans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SubscriptionPlanPackages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SubscriptionPlanFeatures",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SubscriptionPlanBenefits",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SubscriptionBookings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Staff",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "SlotReservations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "ServiceSubscriptions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Services",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "ServiceProducts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Referrals",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "PageViews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "PackageServices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Packages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Offers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Leads",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "JobPositions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "JobApplications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "CustomerFeedbacks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "BookingPhotos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "BookingItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "BookingChecklistItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "Availabilities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrgId",
                table: "AttendanceLogs",
                type: "integer",
                nullable: true);

            // Backfill: assign all existing rows to org 1
            migrationBuilder.Sql(@"
                UPDATE ""WorkerLocations"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Vehicles"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""UserSubscriptions"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Users"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""UserOffers"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SubscriptionPlans"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SubscriptionPlanPackages"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SubscriptionPlanFeatures"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SubscriptionPlanBenefits"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SubscriptionBookings"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Staff"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""SlotReservations"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""ServiceSubscriptions"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Services"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""ServiceProducts"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Referrals"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Products"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Packages"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""PackageServices"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""PageViews"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Offers"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Notifications"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Leads"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""JobPositions"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""JobApplications"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""CustomerFeedbacks"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""BookingPhotos"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""BookingItems"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""BookingChecklistItems"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Bookings"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""Availabilities"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""AuditLogs"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
                UPDATE ""AttendanceLogs"" SET ""OrgId"" = 1 WHERE ""OrgId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "WorkerLocations");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "UserSubscriptions");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "UserOffers");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SubscriptionPlans");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SubscriptionPlanPackages");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SubscriptionPlanFeatures");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SubscriptionPlanBenefits");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SubscriptionBookings");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "SlotReservations");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "ServiceSubscriptions");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "ServiceProducts");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Referrals");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "PageViews");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "PackageServices");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Packages");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Leads");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "JobApplications");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "CustomerFeedbacks");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "BookingPhotos");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "BookingItems");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "BookingChecklistItems");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "OrgId",
                table: "AttendanceLogs");
        }
    }
}
