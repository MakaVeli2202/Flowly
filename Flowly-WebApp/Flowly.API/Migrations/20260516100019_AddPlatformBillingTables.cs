using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformBillingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlatformPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    AnnualPrice = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    MaxLocations = table.Column<int>(type: "integer", nullable: false),
                    MaxStaff = table.Column<int>(type: "integer", nullable: false),
                    MaxBookingsPerMonth = table.Column<int>(type: "integer", nullable: false),
                    AITokenMonthlyLimit = table.Column<int>(type: "integer", nullable: false),
                    FeaturesJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UsageRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    BookingCount = table.Column<int>(type: "integer", nullable: false),
                    StaffCount = table.Column<int>(type: "integer", nullable: false),
                    AITokensUsed = table.Column<long>(type: "bigint", nullable: false),
                    SMSSent = table.Column<int>(type: "integer", nullable: false),
                    StorageGb = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 2, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsageRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsageRecords_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationSubscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    PlanId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BillingCycle = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CurrentPeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CurrentPeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StripeSubscriptionId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    StripePriceId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    StripeCustomerId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    TrialEndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationSubscriptions_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationSubscriptions_PlatformPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "PlatformPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationSubscriptions_OrgId_Status",
                table: "OrganizationSubscriptions",
                columns: new[] { "OrgId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationSubscriptions_PlanId",
                table: "OrganizationSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_UsageRecords_OrgId_Year_Month",
                table: "UsageRecords",
                columns: new[] { "OrgId", "Year", "Month" },
                unique: true);

            // Seed 4 platform plans
            migrationBuilder.Sql(@"
                INSERT INTO ""PlatformPlans"" (""Name"", ""MonthlyPrice"", ""AnnualPrice"", ""MaxLocations"", ""MaxStaff"", ""MaxBookingsPerMonth"", ""AITokenMonthlyLimit"", ""FeaturesJson"", ""IsActive"", ""SortOrder"", ""CreatedAt"")
                VALUES
                  ('Starter',    49,   470, 1,  5,    200,      0,      '{""payments"":true,""subscriptions"":false,""inventory"":false,""ai_assistant"":false,""marketing"":false,""multi_location"":false,""white_label"":false}', true, 1, NOW()),
                  ('Growth',    129,  1238, 3, 25,   1000,      0,      '{""payments"":true,""subscriptions"":true,""inventory"":true,""ai_assistant"":false,""marketing"":false,""multi_location"":true,""white_label"":false}', true, 2, NOW()),
                  ('Pro',       299,  2870, 10, -1,  5000, 100000,      '{""payments"":true,""subscriptions"":true,""inventory"":true,""ai_assistant"":true,""marketing"":true,""multi_location"":true,""white_label"":true}', true, 3, NOW()),
                  ('Enterprise',  0,     0, -1, -1,    -1,      -1,     '{""payments"":true,""subscriptions"":true,""inventory"":true,""ai_assistant"":true,""marketing"":true,""multi_location"":true,""white_label"":true}', true, 4, NOW())
                ON CONFLICT DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationSubscriptions");

            migrationBuilder.DropTable(
                name: "UsageRecords");

            migrationBuilder.DropTable(
                name: "PlatformPlans");
        }
    }
}
