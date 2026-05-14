using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class SplitStaffTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Drop old FKs that point from child tables → Users (worker rows)
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Users_AssignedWorkerId",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_SubscriptionBookings_Users_WorkerId",
                table: "SubscriptionBookings");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkerLocations_Users_WorkerId",
                table: "WorkerLocations");

            // 2. Create the Staff table (BEFORE copying data out of Users)
            migrationBuilder.CreateTable(
                name: "Staff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FirstName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ProfileImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StaffType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    WorkingDays = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ShiftStart = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ShiftEnd = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DaySchedulesJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    MonthlySalary = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    LastPaidMonth = table.Column<int>(type: "integer", nullable: true),
                    LastPaidYear = table.Column<int>(type: "integer", nullable: true),
                    LastPaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IBAN = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ExpoPushToken = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RefreshToken = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Staff", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Staff_Email",
                table: "Staff",
                column: "Email",
                unique: true);

            // 3. Copy worker rows from Users → Staff (preserving IDs so child FK values remain valid)
            migrationBuilder.Sql(@"
                INSERT INTO ""Staff"" (
                    ""Id"", ""FirstName"", ""LastName"", ""Email"", ""PasswordHash"",
                    ""Phone"", ""ProfileImageUrl"", ""Role"", ""StaffType"",
                    ""WorkingDays"", ""ShiftStart"", ""ShiftEnd"", ""DaySchedulesJson"",
                    ""IsActive"", ""MonthlySalary"", ""LastPaidMonth"", ""LastPaidYear"", ""LastPaidAt"",
                    ""IBAN"", ""ExpoPushToken"", ""RefreshToken"", ""RefreshTokenExpiry"",
                    ""CreatedAt"", ""UpdatedAt""
                )
                OVERRIDING SYSTEM VALUE
                SELECT
                    ""Id"", ""FirstName"", ""LastName"", ""Email"", ""PasswordHash"",
                    ""Phone"", ""ProfileImageUrl"", ""Role"", 'Detailer',
                    COALESCE(""WorkingDays"", 'Monday,Tuesday,Wednesday,Thursday,Friday'),
                    COALESCE(""ShiftStart"", '09:00'),
                    COALESCE(""ShiftEnd"", '18:00'),
                    ""DaySchedulesJson"",
                    ""IsActive"", ""MonthlySalary"", ""LastPaidMonth"", ""LastPaidYear"", ""LastPaidAt"",
                    NULL, ""ExpoPushToken"", ""RefreshToken"", ""RefreshTokenExpiry"",
                    ""CreatedAt"", ""UpdatedAt""
                FROM ""Users""
                WHERE ""Role"" = 'Worker';

                SELECT setval(
                    pg_get_serial_sequence('""Staff""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""Staff""), 1)
                );

                DELETE FROM ""Users"" WHERE ""Role"" = 'Worker';
            ");

            // 4. Now drop the staff-specific columns from Users
            migrationBuilder.DropColumn(
                name: "DaySchedulesJson",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastPaidAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastPaidMonth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastPaidYear",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MonthlySalary",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ShiftEnd",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ShiftStart",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WorkingDays",
                table: "Users");

            // 5. Re-add FKs pointing to Staff
            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Staff_AssignedWorkerId",
                table: "Bookings",
                column: "AssignedWorkerId",
                principalTable: "Staff",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SubscriptionBookings_Staff_WorkerId",
                table: "SubscriptionBookings",
                column: "WorkerId",
                principalTable: "Staff",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkerLocations_Staff_WorkerId",
                table: "WorkerLocations",
                column: "WorkerId",
                principalTable: "Staff",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Staff_AssignedWorkerId",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_SubscriptionBookings_Staff_WorkerId",
                table: "SubscriptionBookings");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkerLocations_Staff_WorkerId",
                table: "WorkerLocations");

            migrationBuilder.DropTable(
                name: "Staff");

            migrationBuilder.AddColumn<string>(
                name: "DaySchedulesJson",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastPaidAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastPaidMonth",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastPaidYear",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlySalary",
                table: "Users",
                type: "numeric(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShiftEnd",
                table: "Users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ShiftStart",
                table: "Users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WorkingDays",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Users_AssignedWorkerId",
                table: "Bookings",
                column: "AssignedWorkerId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SubscriptionBookings_Users_WorkerId",
                table: "SubscriptionBookings",
                column: "WorkerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkerLocations_Users_WorkerId",
                table: "WorkerLocations",
                column: "WorkerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
