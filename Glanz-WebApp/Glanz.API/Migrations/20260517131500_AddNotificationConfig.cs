using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AnniversaryOfferSentYear",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BirthdayOfferSentYear",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewRequestSentAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrgNotificationConfigs",
                columns: table => new
                {
                    OrgId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BirthdayOfferEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    BirthdayDiscountPct = table.Column<int>(type: "integer", nullable: false),
                    BirthdayMessageTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    AnniversaryOfferEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AnniversaryDiscountPct = table.Column<int>(type: "integer", nullable: false),
                    AnniversaryMessageTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ReviewRequestEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReviewRequestDelayHours = table.Column<int>(type: "integer", nullable: false),
                    ReviewRequestTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ReminderEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReminderHoursBefore = table.Column<int>(type: "integer", nullable: false),
                    ReminderTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    EscalationEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    EscalationHoursBefore = table.Column<int>(type: "integer", nullable: false),
                    EscalationTemplate = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrgNotificationConfigs", x => x.OrgId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrgNotificationConfigs");

            migrationBuilder.DropColumn(
                name: "AnniversaryOfferSentYear",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BirthdayOfferSentYear",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReviewRequestSentAt",
                table: "Users");
        }
    }
}
