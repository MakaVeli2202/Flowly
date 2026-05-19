using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferredDetailerFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All DDL uses IF NOT EXISTS / DO blocks to be idempotent — the startup
            // compatibility check may have already created some of these columns.

            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_PageViews_FirstSeen"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_PageViews_LastHeartbeat"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_PageViews_SessionId"";");

            migrationBuilder.Sql(@"ALTER TABLE ""Users""  ADD COLUMN IF NOT EXISTS ""AllowPreferredWorker"" boolean NOT NULL DEFAULT false;");
            migrationBuilder.Sql(@"ALTER TABLE ""Staff""  ADD COLUMN IF NOT EXISTS ""CompensationType""    character varying(20) NOT NULL DEFAULT '';");
            migrationBuilder.Sql(@"ALTER TABLE ""Staff""  ADD COLUMN IF NOT EXISTS ""PercentageRate""      numeric(5,2) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Staff""  ADD COLUMN IF NOT EXISTS ""ShortCode""           character varying(10) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Staff""  ADD COLUMN IF NOT EXISTS ""SkillsJson""          text NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Services"" ADD COLUMN IF NOT EXISTS ""SortOrder""         integer NOT NULL DEFAULT 0;");
            migrationBuilder.Sql(@"ALTER TABLE ""Referrals"" ADD COLUMN IF NOT EXISTS ""DiscountPercent""  numeric NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Packages"" ADD COLUMN IF NOT EXISTS ""SortOrder""         integer NOT NULL DEFAULT 0;");
            migrationBuilder.Sql(@"ALTER TABLE ""Bookings"" ADD COLUMN IF NOT EXISTS ""PreferredWorkerId"" integer NULL;");

            // Remove defaults that were only needed for the NOT NULL constraint population
            migrationBuilder.Sql(@"ALTER TABLE ""PageViews"" ALTER COLUMN ""Source""     DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""PageViews"" ALTER COLUMN ""Page""       DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""PageViews"" ALTER COLUMN ""DeviceType"" DROP DEFAULT;");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Bookings_PreferredWorkerId"" ON ""Bookings"" (""PreferredWorkerId"");");

            migrationBuilder.Sql(@"
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_Bookings_Staff_PreferredWorkerId'
          AND table_name = 'Bookings'
    ) THEN
        ALTER TABLE ""Bookings""
            ADD CONSTRAINT ""FK_Bookings_Staff_PreferredWorkerId""
            FOREIGN KEY (""PreferredWorkerId"") REFERENCES ""Staff"" (""Id"");
    END IF;
END $$;");
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
