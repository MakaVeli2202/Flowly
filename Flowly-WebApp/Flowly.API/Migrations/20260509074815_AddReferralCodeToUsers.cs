using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddReferralCodeToUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReferralCode",
                table: "Users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReferralPoints",
                table: "Users",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ReferredByUserId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LeadSource",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "LeadSourceDetails",
                table: "Bookings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferralCode",
                table: "Bookings",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Leads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    SourceDetails = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastContactedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignedToUserId = table.Column<int>(type: "integer", nullable: true),
                    ConvertedToBookingId = table.Column<int>(type: "integer", nullable: true),
                    PreferredService = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UtmCampaign = table.Column<string>(type: "text", nullable: true),
                    UtmContent = table.Column<string>(type: "text", nullable: true),
                    UtmTerm = table.Column<string>(type: "text", nullable: true),
                    Gclid = table.Column<string>(type: "text", nullable: true),
                    Fbclid = table.Column<string>(type: "text", nullable: true),
                    FbLeadId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Leads_Bookings_ConvertedToBookingId",
                        column: x => x.ConvertedToBookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Leads_Users_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Referrals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReferrerId = table.Column<int>(type: "integer", nullable: false),
                    ReferredUserId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FirstBookingAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RewardedBookingId = table.Column<int>(type: "integer", nullable: true),
                    RewardAmount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RewardedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Referrals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Referrals_Users_ReferredUserId",
                        column: x => x.ReferredUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Referrals_Users_ReferrerId",
                        column: x => x.ReferrerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_ReferredByUserId",
                table: "Users",
                column: "ReferredByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_AssignedToUserId",
                table: "Leads",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_ConvertedToBookingId",
                table: "Leads",
                column: "ConvertedToBookingId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_ReferredUserId",
                table: "Referrals",
                column: "ReferredUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_ReferrerId",
                table: "Referrals",
                column: "ReferrerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Users_ReferredByUserId",
                table: "Users",
                column: "ReferredByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Users_ReferredByUserId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "Leads");

            migrationBuilder.DropTable(
                name: "Referrals");

            migrationBuilder.DropIndex(
                name: "IX_Users_ReferredByUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReferralCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReferralPoints",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReferredByUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LeadSource",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "LeadSourceDetails",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ReferralCode",
                table: "Bookings");
        }
    }
}
