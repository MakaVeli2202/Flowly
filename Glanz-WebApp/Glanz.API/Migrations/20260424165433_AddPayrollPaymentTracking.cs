using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollPaymentTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastPaidAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastPaidMonth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastPaidYear",
                table: "Users");
        }
    }
}
