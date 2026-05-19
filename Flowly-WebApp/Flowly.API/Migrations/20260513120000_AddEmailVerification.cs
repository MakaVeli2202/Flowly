using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEmailVerified",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationToken",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationTokenExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetToken",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetTokenExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            // Grandfather all pre-existing users — they registered before email verification
            // was introduced, so they don't need to re-verify.
            migrationBuilder.Sql("UPDATE \"Users\" SET \"IsEmailVerified\" = true WHERE \"IsEmailVerified\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IsEmailVerified",              table: "Users");
            migrationBuilder.DropColumn(name: "EmailVerificationToken",       table: "Users");
            migrationBuilder.DropColumn(name: "EmailVerificationTokenExpiry", table: "Users");
            migrationBuilder.DropColumn(name: "PasswordResetToken",           table: "Users");
            migrationBuilder.DropColumn(name: "PasswordResetTokenExpiry",     table: "Users");
        }
    }
}
