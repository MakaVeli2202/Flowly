using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameWorkerRoleToEmployee : Migration
    {
        /// <inheritdoc />
protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Staff\" SET \"Role\" = 'Employee' WHERE \"Role\" = 'Worker';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Staff\" SET \"Role\" = 'Worker' WHERE \"Role\" = 'Employee';");
        }
    }
}
