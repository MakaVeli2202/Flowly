using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    public partial class AddStaffExtendedFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ShortCode",
                table: "Staff",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompensationType",
                table: "Staff",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Salary");

            migrationBuilder.AddColumn<decimal>(
                name: "PercentageRate",
                table: "Staff",
                type: "decimal(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SkillsJson",
                table: "Staff",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Staff_ShortCode",
                table: "Staff",
                column: "ShortCode",
                unique: true,
                filter: "\"ShortCode\" IS NOT NULL");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Staff_ShortCode",
                table: "Staff");

            migrationBuilder.DropColumn(name: "ShortCode",         table: "Staff");
            migrationBuilder.DropColumn(name: "CompensationType",   table: "Staff");
            migrationBuilder.DropColumn(name: "PercentageRate",     table: "Staff");
            migrationBuilder.DropColumn(name: "SkillsJson",         table: "Staff");
        }
    }
}
