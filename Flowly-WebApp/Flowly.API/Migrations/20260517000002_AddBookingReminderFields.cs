using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingReminderFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderSentAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReminderSentAt",
                table: "Bookings");
        }
    }
}
