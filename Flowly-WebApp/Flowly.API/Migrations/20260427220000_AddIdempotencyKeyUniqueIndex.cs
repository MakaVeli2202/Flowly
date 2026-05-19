using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flowly.API.Migrations
{
    /// <inheritdoc />
    public partial class AddIdempotencyKeyUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: De-duplicate any existing IdempotencyKey values before adding the unique
            // constraint. For each set of duplicates we keep the booking with the lowest Id
            // (the first one created) and clear the key on the rest so they don't violate
            // the constraint. This makes the migration safe to apply on a live database.
            migrationBuilder.Sql(
                @"UPDATE ""Bookings""
                  SET ""IdempotencyKey"" = NULL
                  WHERE ""Id"" NOT IN (
                      SELECT MIN(""Id"")
                      FROM   ""Bookings""
                      WHERE  ""IdempotencyKey"" IS NOT NULL
                      GROUP  BY ""IdempotencyKey""
                  )
                  AND ""IdempotencyKey"" IS NOT NULL;");

            // Step 2: Add the partial unique index (NULL values are excluded so they never conflict).
            migrationBuilder.CreateIndex(
                name: "IX_Bookings_IdempotencyKey",
                table: "Bookings",
                column: "IdempotencyKey",
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_IdempotencyKey",
                table: "Bookings");
        }
    }
}
