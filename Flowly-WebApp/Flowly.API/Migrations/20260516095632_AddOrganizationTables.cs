using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IndustryType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BillingEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DefaultLocale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DefaultTimezone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DefaultCurrency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationBrandings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    LogoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    FaviconUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PrimaryColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SecondaryColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CustomDomain = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    CustomDomainVerified = table.Column<bool>(type: "boolean", nullable: false),
                    WhiteLabelEnabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationBrandings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationBrandings_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationLocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Timezone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationLocations_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBrandings_CustomDomain",
                table: "OrganizationBrandings",
                column: "CustomDomain",
                unique: true,
                filter: "\"CustomDomain\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBrandings_OrgId",
                table: "OrganizationBrandings",
                column: "OrgId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationLocations_OrgId",
                table: "OrganizationLocations",
                column: "OrgId");

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_Slug",
                table: "Organizations",
                column: "Slug",
                unique: true);

            // Seed default org (ID=1) for all existing single-tenant data
            migrationBuilder.Sql(@"
                INSERT INTO ""Organizations"" (""Id"", ""Slug"", ""Name"", ""IndustryType"", ""DefaultLocale"", ""DefaultTimezone"", ""DefaultCurrency"", ""IsActive"", ""CreatedAt"")
                VALUES (1, 'default', 'Default Organization', 'automotive_detailing', 'en', 'UTC', 'QAR', true, NOW())
                ON CONFLICT (""Id"") DO NOTHING;

                SELECT pg_catalog.setval(pg_get_serial_sequence('""Organizations""', 'Id'), 2, false);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationBrandings");

            migrationBuilder.DropTable(
                name: "OrganizationLocations");

            migrationBuilder.DropTable(
                name: "Organizations");
        }
    }
}
