using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferredDetailerFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PageViews_FirstSeen",
                table: "PageViews");

            migrationBuilder.DropIndex(
                name: "IX_PageViews_LastHeartbeat",
                table: "PageViews");

            migrationBuilder.DropIndex(
                name: "IX_PageViews_SessionId",
                table: "PageViews");

            migrationBuilder.AddColumn<bool>(
                name: "AllowPreferredWorker",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CompensationType",
                table: "Staff",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "PercentageRate",
                table: "Staff",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShortCode",
                table: "Staff",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SkillsJson",
                table: "Staff",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Services",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountPercent",
                table: "Referrals",
                type: "numeric",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Source",
                table: "PageViews",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValue: "Direct");

            migrationBuilder.AlterColumn<string>(
                name: "Page",
                table: "PageViews",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255,
                oldDefaultValue: "/");

            migrationBuilder.AlterColumn<string>(
                name: "DeviceType",
                table: "PageViews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Desktop");

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Packages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PreferredWorkerId",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PreferredWorkerId",
                table: "Bookings",
                column: "PreferredWorkerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Staff_PreferredWorkerId",
                table: "Bookings",
                column: "PreferredWorkerId",
                principalTable: "Staff",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Staff_PreferredWorkerId",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_PreferredWorkerId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "AllowPreferredWorker",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CompensationType",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "PercentageRate",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "ShortCode",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "SkillsJson",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "DiscountPercent",
                table: "Referrals");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Packages");

            migrationBuilder.DropColumn(
                name: "PreferredWorkerId",
                table: "Bookings");

            migrationBuilder.AlterColumn<string>(
                name: "Source",
                table: "PageViews",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Direct",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Page",
                table: "PageViews",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "/",
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);

            migrationBuilder.AlterColumn<string>(
                name: "DeviceType",
                table: "PageViews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Desktop",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_FirstSeen",
                table: "PageViews",
                column: "FirstSeen");

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_LastHeartbeat",
                table: "PageViews",
                column: "LastHeartbeat");

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_SessionId",
                table: "PageViews",
                column: "SessionId");
        }
    }
}
