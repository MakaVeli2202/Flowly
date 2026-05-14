using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Glanz.API.Migrations
{
    public partial class AddSortOrderToPackagesAndServices : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Packages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Services",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SortOrder", table: "Packages");
            migrationBuilder.DropColumn(name: "SortOrder", table: "Services");
        }
    }
}
