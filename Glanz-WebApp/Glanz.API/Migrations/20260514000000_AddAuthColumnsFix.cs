using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Glanz.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthColumnsFix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'IsEmailVerified') THEN
                        ALTER TABLE ""Users"" ADD COLUMN ""IsEmailVerified"" boolean NOT NULL DEFAULT false;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'EmailVerificationToken') THEN
                        ALTER TABLE ""Users"" ADD COLUMN ""EmailVerificationToken"" varchar(200);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'EmailVerificationTokenExpiry') THEN
                        ALTER TABLE ""Users"" ADD COLUMN ""EmailVerificationTokenExpiry"" timestamptz;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'PasswordResetToken') THEN
                        ALTER TABLE ""Users"" ADD COLUMN ""PasswordResetToken"" varchar(200);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'PasswordResetTokenExpiry') THEN
                        ALTER TABLE ""Users"" ADD COLUMN ""PasswordResetTokenExpiry"" timestamptz;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql("UPDATE \"Users\" SET \"IsEmailVerified\" = true WHERE \"IsEmailVerified\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}