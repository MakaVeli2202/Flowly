using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddHasUsedReferralCodeOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasUsedReferralCode",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasUsedReferralCode",
                table: "Users");
        }
    }
}
