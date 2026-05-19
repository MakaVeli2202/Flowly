using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSlotCapacityConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Prevent CurrentBookings from ever exceeding MaxBookings at the DB level.
            // Application code already enforces this, but this constraint catches any
            // bugs, race conditions, or direct DB edits.
            migrationBuilder.Sql(
                "ALTER TABLE \"Availabilities\" ADD CONSTRAINT \"CK_Availabilities_CurrentBookings\" " +
                "CHECK (\"CurrentBookings\" <= \"MaxBookings\");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE \"Availabilities\" DROP CONSTRAINT IF EXISTS \"CK_Availabilities_CurrentBookings\";");
        }
    }
}
