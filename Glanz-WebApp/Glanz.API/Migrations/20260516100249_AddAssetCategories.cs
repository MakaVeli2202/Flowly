using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AutomationRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TriggerEvent = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DelayMinutes = table.Column<int>(type: "integer", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ConfigJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationRules_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BookingRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    RuleType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ConfigJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookingRules_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomFieldDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FieldKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FieldType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    OptionsJson = table.Column<string>(type: "text", nullable: true),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomFieldDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomFieldDefinitions_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DomainEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    EntityId = table.Column<int>(type: "integer", nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DomainEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DomainEvents_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IndustryTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DefaultAssetCategoriesJson = table.Column<string>(type: "text", nullable: true),
                    DefaultServiceTemplatesJson = table.Column<string>(type: "text", nullable: true),
                    DefaultChecklistTemplatesJson = table.Column<string>(type: "text", nullable: true),
                    DefaultCustomFieldsJson = table.Column<string>(type: "text", nullable: true),
                    DefaultWorkflowRulesJson = table.Column<string>(type: "text", nullable: true),
                    DefaultAutomationRulesJson = table.Column<string>(type: "text", nullable: true),
                    TerminologyJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndustryTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Module = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Resources",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    LocationId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Resources_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantConfigurationSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    IndustryTemplateKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FeatureFlagsJson = table.Column<string>(type: "text", nullable: true),
                    CustomFieldSchemaJson = table.Column<string>(type: "text", nullable: true),
                    TerminologyJson = table.Column<string>(type: "text", nullable: true),
                    WorkflowTemplatesJson = table.Column<string>(type: "text", nullable: true),
                    BrandingJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantConfigurationSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantConfigurationSnapshots_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantFeatureFlags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    FeatureKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ConfigJson = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantFeatureFlags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantFeatureFlags_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomFieldValues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrgId = table.Column<int>(type: "integer", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: false),
                    FieldDefinitionId = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomFieldValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomFieldValues_CustomFieldDefinitions_FieldDefinitionId",
                        column: x => x.FieldDefinitionId,
                        principalTable: "CustomFieldDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomFieldValues_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PermissionId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ResourceBookings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ResourceId = table.Column<int>(type: "integer", nullable: false),
                    BookingId = table.Column<int>(type: "integer", nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceBookings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResourceBookings_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ResourceBookings_Resources_ResourceId",
                        column: x => x.ResourceId,
                        principalTable: "Resources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AutomationRules_OrgId",
                table: "AutomationRules",
                column: "OrgId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingRules_OrgId",
                table: "BookingRules",
                column: "OrgId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldDefinitions_OrgId_EntityType_FieldKey",
                table: "CustomFieldDefinitions",
                columns: new[] { "OrgId", "EntityType", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldValues_FieldDefinitionId",
                table: "CustomFieldValues",
                column: "FieldDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldValues_OrgId_EntityType_EntityId_FieldDefinition~",
                table: "CustomFieldValues",
                columns: new[] { "OrgId", "EntityType", "EntityId", "FieldDefinitionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DomainEvents_OrgId_EventType_OccurredAt",
                table: "DomainEvents",
                columns: new[] { "OrgId", "EventType", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DomainEvents_ProcessedAt",
                table: "DomainEvents",
                column: "ProcessedAt");

            migrationBuilder.CreateIndex(
                name: "IX_IndustryTemplates_Key",
                table: "IndustryTemplates",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Key",
                table: "Permissions",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResourceBookings_BookingId",
                table: "ResourceBookings",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceBookings_ResourceId",
                table: "ResourceBookings",
                column: "ResourceId");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_OrgId",
                table: "Resources",
                column: "OrgId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                table: "RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_Role_PermissionId",
                table: "RolePermissions",
                columns: new[] { "Role", "PermissionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantConfigurationSnapshots_OrgId_Version",
                table: "TenantConfigurationSnapshots",
                columns: new[] { "OrgId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantFeatureFlags_OrgId_FeatureKey",
                table: "TenantFeatureFlags",
                columns: new[] { "OrgId", "FeatureKey" },
                unique: true);

            // Seed AssetCategories for default org 1
            migrationBuilder.Sql(@"
                INSERT INTO ""AssetCategories"" (""OrgId"", ""Name"", ""PricingMultiplier"", ""Icon"", ""SortOrder"", ""IsActive"")
                VALUES
                  (1, 'Motorcycle', 0.75, 'motorcycle', 1, true),
                  (1, 'Sedan',      1.00, 'car',        2, true),
                  (1, 'SUV',        1.25, 'suv',        3, true),
                  (1, 'Pickup',     1.50, 'pickup',     4, true)
                ON CONFLICT DO NOTHING;
            ");

            // Seed IndustryTemplates
            migrationBuilder.Sql(@"
                INSERT INTO ""IndustryTemplates"" (""Key"", ""DisplayName"", ""TerminologyJson"", ""DefaultAssetCategoriesJson"", ""IsActive"")
                VALUES
                  ('automotive_detailing', 'Automotive Detailing', '{""asset"":""Vehicle"",""asset_plural"":""Vehicles"",""staff_member"":""Detailer"",""booking"":""Booking"",""resource"":""Bay""}', '[""Sedan"",""SUV"",""Pickup"",""Motorcycle""]', true),
                  ('salon',               'Hair & Beauty Salon',  '{""asset"":""Client"",""asset_plural"":""Clients"",""staff_member"":""Stylist"",""booking"":""Appointment"",""resource"":""Chair""}', '[]', true),
                  ('cleaning',            'Cleaning Service',     '{""asset"":""Property"",""asset_plural"":""Properties"",""staff_member"":""Cleaner"",""booking"":""Job"",""resource"":""Zone""}', '[""Studio"",""1BR"",""2BR"",""3BR"",""Villa""]', true),
                  ('workshop',            'Auto Workshop',        '{""asset"":""Vehicle"",""asset_plural"":""Vehicles"",""staff_member"":""Technician"",""booking"":""Service"",""resource"":""Bay""}', '[""Sedan"",""SUV"",""Pickup"",""Truck""]', true)
                ON CONFLICT (""Key"") DO NOTHING;
            ");

            // Seed Permissions
            migrationBuilder.Sql(@"
                INSERT INTO ""Permissions"" (""Key"", ""Module"", ""Description"")
                VALUES
                  ('bookings.read',   'bookings',  'View bookings'),
                  ('bookings.write',  'bookings',  'Create and edit bookings'),
                  ('bookings.assign', 'bookings',  'Assign staff to bookings'),
                  ('staff.read',      'staff',     'View staff'),
                  ('staff.write',     'staff',     'Create and edit staff'),
                  ('inventory.read',  'inventory', 'View inventory'),
                  ('inventory.write', 'inventory', 'Edit inventory'),
                  ('reports.read',    'reports',   'View reports'),
                  ('billing.read',    'billing',   'View billing'),
                  ('billing.write',   'billing',   'Manage billing'),
                  ('settings.write',  'settings',  'Manage org settings'),
                  ('customers.read',  'crm',       'View customers'),
                  ('customers.write', 'crm',       'Edit customers')
                ON CONFLICT (""Key"") DO NOTHING;
            ");

            // Seed RolePermissions (org_owner gets all, org_admin gets most, org_staff limited, org_customer minimal)
            migrationBuilder.Sql(@"
                INSERT INTO ""RolePermissions"" (""Role"", ""PermissionId"")
                SELECT 'org_owner', ""Id"" FROM ""Permissions""
                ON CONFLICT DO NOTHING;

                INSERT INTO ""RolePermissions"" (""Role"", ""PermissionId"")
                SELECT 'org_admin', ""Id"" FROM ""Permissions"" WHERE ""Key"" NOT IN ('billing.write', 'settings.write')
                ON CONFLICT DO NOTHING;

                INSERT INTO ""RolePermissions"" (""Role"", ""PermissionId"")
                SELECT 'org_staff', ""Id"" FROM ""Permissions"" WHERE ""Key"" IN ('bookings.read', 'bookings.write', 'inventory.read', 'customers.read')
                ON CONFLICT DO NOTHING;

                INSERT INTO ""RolePermissions"" (""Role"", ""PermissionId"")
                SELECT 'org_customer', ""Id"" FROM ""Permissions"" WHERE ""Key"" IN ('bookings.read')
                ON CONFLICT DO NOTHING;
            ");

            // Seed initial TenantConfigurationSnapshot for default org 1
            migrationBuilder.Sql(@"
                INSERT INTO ""TenantConfigurationSnapshots"" (""OrgId"", ""Version"", ""IndustryTemplateKey"", ""FeatureFlagsJson"", ""TerminologyJson"", ""CreatedAt"", ""CreatedBy"")
                VALUES (1, 1, 'automotive_detailing',
                  '{""payments"":true,""subscriptions"":true,""inventory"":true,""ai_assistant"":false,""marketing"":false,""multi_location"":false,""white_label"":false}',
                  '{""asset"":""Vehicle"",""asset_plural"":""Vehicles"",""staff_member"":""Detailer"",""booking"":""Booking"",""resource"":""Bay""}',
                  NOW(), 'system')
                ON CONFLICT DO NOTHING;
            ");

            // Seed default feature flags for org 1
            migrationBuilder.Sql(@"
                INSERT INTO ""TenantFeatureFlags"" (""OrgId"", ""FeatureKey"", ""IsEnabled"", ""UpdatedAt"")
                VALUES
                  (1, 'payments',       true,  NOW()),
                  (1, 'subscriptions',  true,  NOW()),
                  (1, 'inventory',      true,  NOW()),
                  (1, 'ai_assistant',   false, NOW()),
                  (1, 'marketing',      false, NOW()),
                  (1, 'multi_location', false, NOW()),
                  (1, 'white_label',    false, NOW())
                ON CONFLICT (""OrgId"", ""FeatureKey"") DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AutomationRules");

            migrationBuilder.DropTable(
                name: "BookingRules");

            migrationBuilder.DropTable(
                name: "CustomFieldValues");

            migrationBuilder.DropTable(
                name: "DomainEvents");

            migrationBuilder.DropTable(
                name: "IndustryTemplates");

            migrationBuilder.DropTable(
                name: "ResourceBookings");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "TenantConfigurationSnapshots");

            migrationBuilder.DropTable(
                name: "TenantFeatureFlags");

            migrationBuilder.DropTable(
                name: "CustomFieldDefinitions");

            migrationBuilder.DropTable(
                name: "Resources");

            migrationBuilder.DropTable(
                name: "Permissions");
        }
    }
}
