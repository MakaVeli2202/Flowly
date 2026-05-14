using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Glanz.API.Migrations
{
    public partial class AddPageViews : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PageViews",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SessionId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Page = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false, defaultValue: "/"),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Direct"),
                    Referrer = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DeviceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Desktop"),
                    IsNewVisitor = table.Column<bool>(type: "boolean", nullable: false),
                    FirstSeen = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastHeartbeat = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PageViews", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_SessionId",
                table: "PageViews",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_LastHeartbeat",
                table: "PageViews",
                column: "LastHeartbeat");

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_FirstSeen",
                table: "PageViews",
                column: "FirstSeen");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PageViews");
        }
    }
}
