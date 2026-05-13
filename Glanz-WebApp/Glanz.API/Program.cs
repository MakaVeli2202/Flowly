using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.HttpOverrides;
using System.Text;
using System.Data.Common;
using Amazon.S3;
using Glanz.API.Data;
using Glanz.API.Services;
using Glanz.API.Hubs;
using Glanz.API.Filters;
using Glanz.API.Validators;
using Glanz.API.DTOs;
using AspNetCoreRateLimit;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

var jwtSecretFromConfig = builder.Configuration["JwtSettings:SecretKey"];

if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwtSecretFromConfig) || jwtSecretFromConfig.Length < 32)
    {
        throw new InvalidOperationException("JwtSettings:SecretKey must be at least 32 characters and must not be the default placeholder.");
    }
}

builder.WebHost.ConfigureKestrel(options =>
{
    var port = int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "5289");
    options.ListenAnyIP(port);
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB global cap — prevents DoS via oversized payloads
});

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<GlobalExceptionFilter>();
        options.Filters.Add<FluentValidationFilter>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();
builder.Services.AddHealthChecks();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Rate limiting - only enabled in production
if (!builder.Environment.IsDevelopment())
{
    builder.Services.AddMemoryCache();
    builder.Services.Configure<IpRateLimitOptions>(options =>
    {
        options.GeneralRules = new List<RateLimitRule>
        {
            new RateLimitRule
            {
                Endpoint = "*",
                Period = "1m",
                Limit = 500,
            },
            new RateLimitRule
            {
                Endpoint = "get:/api/*",
                Period = "1m",
                Limit = 300,
            },
            new RateLimitRule
            {
                Endpoint = "post:/api/auth/*",
                Period = "5m",
                Limit = 20,
            },
            new RateLimitRule
            {
                // Tighter per-IP cap on login to slow credential-stuffing attacks
                Endpoint = "post:/api/auth/login",
                Period = "10m",
                Limit = 10,
            },
            new RateLimitRule
            {
                // Limit account creation to block throwaway-account spam
                Endpoint = "post:/api/auth/register",
                Period = "10m",
                Limit = 5,
            },
            new RateLimitRule
            {
                Endpoint = "post:/api/bookings/*",
                Period = "1m",
                Limit = 30,
            },
            new RateLimitRule
            {
                Endpoint = "post:/api/payments/*",
                Period = "1m",
                Limit = 20,
            }
        };
    });
    builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
    builder.Services.AddInMemoryRateLimiting();
}
else
{
    builder.Services.AddMemoryCache();
    builder.Services.Configure<IpRateLimitOptions>(options =>
    {
        options.GeneralRules = new List<RateLimitRule>
        {
            new RateLimitRule
            {
                Endpoint = "*",
                Period = "1m",
                Limit = 10000,
            }
        };
    });
    builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
    builder.Services.AddInMemoryRateLimiting();
}

var postgresConnectionString = ResolvePostgresConnectionString(builder.Configuration);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(postgresConnectionString));

builder.Services.Configure<ObjectStorageOptions>(builder.Configuration.GetSection(ObjectStorageOptions.SectionName));
builder.Services.AddSingleton<IAmazonS3>(serviceProvider =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var options = configuration.GetSection(ObjectStorageOptions.SectionName).Get<ObjectStorageOptions>() ?? new ObjectStorageOptions();
    var provider = options.Provider?.Trim();

    if (!string.Equals(provider, ObjectStorageProviders.S3, StringComparison.OrdinalIgnoreCase))
    {
        return new AmazonS3Client(new AmazonS3Config
        {
            ServiceURL = "http://localhost",
            ForcePathStyle = true,
            UseHttp = true,
        });
    }

    if (string.IsNullOrWhiteSpace(options.AccessKey) || string.IsNullOrWhiteSpace(options.SecretKey))
    {
        throw new InvalidOperationException("ObjectStorage credentials must be configured when Provider is S3.");
    }

    var s3Config = new AmazonS3Config
    {
        ForcePathStyle = options.UsePathStyle,
    };

    if (!string.IsNullOrWhiteSpace(options.ServiceUrl))
    {
        s3Config.ServiceURL = options.ServiceUrl;
    }
    else if (!string.IsNullOrWhiteSpace(options.Region))
    {
        s3Config.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(options.Region);
    }

    return new AmazonS3Client(options.AccessKey, options.SecretKey, s3Config);
});
builder.Services.AddSingleton<IObjectStorageService, ObjectStorageService>();

// Security & audit services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Glanz.API.Services.IAuditService, Glanz.API.Services.AuditService>();
builder.Services.AddScoped<Glanz.API.Services.ICredentialVerifier, Glanz.API.Services.CredentialVerifier>();
builder.Services.AddSingleton<Glanz.API.Services.CouponRateLimiter>();

// Register FluentValidation validators
builder.Services.AddTransient<IValidator<RegisterDto>, RegisterDtoValidator>();
builder.Services.AddTransient<IValidator<LoginDto>, LoginDtoValidator>();
builder.Services.AddTransient<IValidator<CreateWorkerDto>, CreateWorkerDtoValidator>();
builder.Services.AddTransient<IValidator<CreateBookingDto>, CreateBookingDtoValidator>();
builder.Services.AddTransient<IValidator<BookingPackageDto>, BookingPackageDtoValidator>();
builder.Services.AddTransient<IValidator<ConfirmBookingDto>, ConfirmBookingDtoValidator>();
builder.Services.AddTransient<IValidator<MarkRunningLateDto>, MarkRunningLateDtoValidator>();
builder.Services.AddTransient<IValidator<CreateVehicleDto>, CreateVehicleDtoValidator>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            var extraOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
            policy.SetIsOriginAllowed(origin =>
                {
                    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                    if (uri.Host == "localhost" || uri.Host == "127.0.0.1")
                        return true;
                    return extraOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
                })
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();

            return;
        }

        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        if (allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException("Cors:AllowedOrigins must be configured outside Development.");
        }

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!))
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                context.Token = accessToken;
            return Task.CompletedTask;
        }
    };
})
.AddGoogle(options =>
{
    options.ClientId = builder.Configuration["Authentication:Google:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? "";
    options.CallbackPath = "/api/auth/external-login-callback";
    options.SaveTokens = true;
    options.Events.OnAccessDenied = context =>
    {
        context.Response.Redirect("/");
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthorization();
builder.Services.AddHttpClient();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IExpoPushService, ExpoPushService>();
builder.Services.AddScoped<IAdminNotificationService, AdminNotificationService>();
builder.Services.AddScoped<IPricingService, PricingService>();
builder.Services.AddScoped<IRealtimeService, RealtimeService>();
builder.Services.AddScoped<ILocalizationTextResolver, LocalizationTextResolver>();
builder.Services.AddScoped<IAutoTranslationService, AutoTranslationService>();
builder.Services.AddScoped<IReferralService, ReferralService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
// Phase 3: background maintenance — cleans expired slot reservations + flags late bookings
builder.Services.AddHostedService<BookingMaintenanceService>();
// Customer reminder service — sends notifications to inactive customers
builder.Services.AddHostedService<CustomerReminderService>();

// SignalR — real-time WebSocket layer
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
});

var app = builder.Build();

// ── Security startup checks ───────────────────────────────────────────────
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
var tapWebhookSecret = app.Configuration["TapPayments:WebhookSecret"];
if (app.Environment.IsProduction() && string.IsNullOrWhiteSpace(tapWebhookSecret))
{
    startupLogger.LogCritical(
        "SECURITY WARNING: TapPayments:WebhookSecret is not configured. " +
        "Incoming Tap webhooks cannot be verified — a forged webhook could mark unpaid bookings as paid. " +
        "Set TapPayments:WebhookSecret to the signing key from the Tap dashboard immediately.");
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    await EnsurePostgresSchemaCompatibilityAsync(dbContext);
}

await AdminAccountBootstrapper.SyncFromConfigurationAsync(app.Services, builder.Configuration);

await DevelopmentDataSeeder.SeedAsync(app.Services, builder.Configuration, app.Environment);

// Load business hours from DB and apply to slot helpers
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hoursRow = await dbContext.SystemSettings
        .FirstOrDefaultAsync(s => s.Key == "booking.businessHours");
    if (hoursRow != null && !string.IsNullOrWhiteSpace(hoursRow.Value))
    {
        try
        {
            var hours = System.Text.Json.JsonSerializer.Deserialize<BusinessHoursPerDayDto>(hoursRow.Value,
                AppJsonOptions.CaseInsensitive);
            if (hours != null)
            {
                Glanz.API.Controllers.BookingsController.SetBusinessHoursFromSettings(hours);
                BookingSlotHelper.SetBusinessHoursFromSettings(hours);
            }
        }
        catch { }
    }
}

// Apply configured business timezone to slot helpers
var configuredTz = builder.Configuration["BusinessSettings:TimeZone"];
Glanz.API.Controllers.BookingsController.ApplyConfiguredTimeZone(configuredTz);
BookingSlotHelper.ApplyConfiguredTimeZone(configuredTz);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// ── Security response headers ─────────────────────────────────────────────
// Applied before any controller response so every endpoint benefits.
// CSP allows Tap checkout assets, fonts, and same-origin assets. Tighten per environment as needed.
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    if (!app.Environment.IsDevelopment())
    {
        // HSTS + CSP only in production (dev uses HTTP localhost)
        context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        context.Response.Headers.Append("Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' https://secure.gosell.io; " +
            "frame-src https://secure.gosell.io https://tap.company; " +
            "connect-src 'self' https://api.tap.company; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            // TODO: Remove 'unsafe-inline' from style-src — it allows CSS injection attacks.
            // Tailwind and some component inline styles currently require it.
            // Fix path: generate a per-request nonce, inject into style tags, include nonce
            // in the CSP header (requires SSR or middleware that patches the served index.html).
            "img-src 'self' data: https:;");
    }
    await next();
});

app.UseStaticFiles();
app.UseMiddleware<Glanz.API.Middleware.CorrelationIdMiddleware>();
app.UseIpRateLimiting();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/healthz");
app.MapHub<GlanzHub>("/hubs/glanz");

// Auto-apply migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        Console.WriteLine("Database migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Migration warning: {ex.Message}");
    }
}

app.Run();

static async Task EnsurePostgresSchemaCompatibilityAsync(AppDbContext dbContext)
{
    if (!dbContext.Database.IsNpgsql())
    {
        return;
    }

    DbConnection connection = dbContext.Database.GetDbConnection();
    var shouldClose = connection.State != System.Data.ConnectionState.Open;

    if (shouldClose)
    {
        await connection.OpenAsync();
    }

    try
    {
        await EnsureColumnAsync(connection, "Users", "LoyaltyGoogleReviewActivatedAt", "timestamp with time zone NULL");
        await EnsureColumnAsync(connection, "Users", "ProfileImageUrl", "character varying(1000) NULL");
        await EnsureColumnAsync(connection, "Users", "DaySchedulesJson", "text NULL");
        await EnsureColumnAsync(connection, "Users", "FirstWashCompletedAt", "timestamp with time zone NULL");
        await EnsureColumnAsync(connection, "UserOffers", "GoogleReviewActivatedAt", "timestamp with time zone NULL");

        // Columns added in hand-crafted migrations that lack .Designer.cs and are not
        // discovered by EF Core's migration runner on a fresh database.
        await EnsureColumnAsync(connection, "Bookings", "IdempotencyKey", "character varying(100) NULL");
        await EnsureIndexAsync(connection, "IX_Bookings_IdempotencyKey", "CREATE INDEX IF NOT EXISTS \"IX_Bookings_IdempotencyKey\" ON \"Bookings\" (\"IdempotencyKey\");");
        await EnsureColumnAsync(connection, "BookingItems", "SnapshotDurationMinutes", "integer NOT NULL DEFAULT 0");

        // Back-fill SnapshotDurationMinutes for legacy rows that still have the default 0.
        // Uses the CURRENT Package.EstimatedDurationMinutes — the best available approximation.
        await using (var backfillCmd = connection.CreateCommand())
        {
            backfillCmd.CommandText = @"
UPDATE ""BookingItems"" bi
SET ""SnapshotDurationMinutes"" = p.""EstimatedDurationMinutes""
FROM ""Packages"" p
WHERE bi.""PackageId"" = p.""Id""
  AND bi.""SnapshotDurationMinutes"" = 0
  AND p.""EstimatedDurationMinutes"" > 0;";
            await backfillCmd.ExecuteNonQueryAsync();
        }

        await EnsureSlotReservationsTableAsync(connection);
        // ServiceSubscriptions table must exist before we can add columns to it.
        await EnsureSubscriptionsTableAsync(connection);
        await EnsureColumnAsync(connection, "ServiceSubscriptions", "DiscountPercent", "numeric(5,2) NOT NULL DEFAULT 0");
        // Referrals table may be missing DiscountPercent column from initial migration
        await EnsureColumnAsync(connection, "Referrals", "DiscountPercent", "numeric(5,2) NULL");
        await EnsureStandaloneSubscriptionTablesAsync(connection);
        await EnsureTranslationTablesAsync(connection);

        var boolColumns = new (string Table, string Column)[]
        {
            ("Availabilities", "IsAvailable"),
            ("BookingChecklistItems", "IsCompleted"),
            ("Notifications", "IsRead"),
            ("Offers", "IsLoyaltyProgram"),
            ("Offers", "IsActive"),
            ("Packages", "IsActive"),
            ("Products", "IsActive"),
            ("Services", "IsActive"),
            ("Users", "IsActive"),
            ("UserOffers", "IsRedeemed")
        };

        foreach (var (table, column) in boolColumns)
        {
            await EnsureBooleanColumnAsync(connection, table, column);
        }
    }
    finally
    {
        if (shouldClose)
        {
            await connection.CloseAsync();
        }
    }
}

static string ResolvePostgresConnectionString(IConfiguration configuration)
{
    var configured = configuration.GetConnectionString("DefaultConnection");
    var fromEnvConnectionStrings = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    var fromDatabaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

    var candidate = FirstNonEmpty(fromEnvConnectionStrings, configured);

    if (!string.IsNullOrWhiteSpace(fromDatabaseUrl))
    {
        candidate = TryConvertDatabaseUrlToNpgsql(fromDatabaseUrl) ?? fromDatabaseUrl;
    }

    if (string.IsNullOrWhiteSpace(candidate) || LooksLikePlaceholder(candidate))
    {
        throw new InvalidOperationException(
            "PostgreSQL connection string missing. Set ConnectionStrings__DefaultConnection or DATABASE_URL.");
    }

    if (!candidate.Contains('=') && !candidate.StartsWith("Host", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "Invalid PostgreSQL connection string format. Use key/value format (Host=...;Database=...;Username=...;Password=...) or set DATABASE_URL as postgres://... URI.");
    }

    return candidate;
}

static bool LooksLikePlaceholder(string value)
{
    return value.Trim().Equals("SET_IN_ENV_CONNECTIONSTRING", StringComparison.OrdinalIgnoreCase);
}

static string FirstNonEmpty(params string?[] values)
{
    foreach (var value in values)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    return string.Empty;
}

static string? TryConvertDatabaseUrlToNpgsql(string databaseUrl)
{
    var raw = databaseUrl.Trim().Trim('"');
    if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
    {
        return null;
    }

    if (!uri.Scheme.Equals("postgres", StringComparison.OrdinalIgnoreCase)
        && !uri.Scheme.Equals("postgresql", StringComparison.OrdinalIgnoreCase))
    {
        return null;
    }

    var userInfoParts = uri.UserInfo.Split(':', 2);
    var username = userInfoParts.Length > 0 ? Uri.UnescapeDataString(userInfoParts[0]) : string.Empty;
    var password = userInfoParts.Length > 1 ? Uri.UnescapeDataString(userInfoParts[1]) : string.Empty;
    var database = uri.AbsolutePath.Trim('/');

    var builder = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Username = username,
        Password = password,
        Database = database
    };

    if (!string.IsNullOrWhiteSpace(uri.Query))
    {
        var query = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in query)
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2)
            {
                continue;
            }

            var key = Uri.UnescapeDataString(kv[0]);
            var value = Uri.UnescapeDataString(kv[1]);

            if (key.Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<Npgsql.SslMode>(value, true, out var sslMode))
            {
                builder.SslMode = sslMode;
                continue;
            }

        }
    }

    if (builder.SslMode == Npgsql.SslMode.Disable && !builder.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
    {
        builder.SslMode = Npgsql.SslMode.Require;
    }

    return builder.ConnectionString;
}

static async Task EnsureSubscriptionsTableAsync(DbConnection connection)
{
    await using var tableCommand = connection.CreateCommand();
    tableCommand.CommandText = @"
CREATE TABLE IF NOT EXISTS ""ServiceSubscriptions"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""Code"" character varying(80) NOT NULL,
    ""UserId"" integer NOT NULL,
    ""PackageId"" integer NOT NULL,
    ""StartDate"" timestamp with time zone NOT NULL,
    ""EndDate"" timestamp with time zone NULL,
    ""Frequency"" integer NOT NULL,
    ""PricePerCycle"" numeric(10,2) NOT NULL,
    ""Notes"" character varying(500) NULL,
    ""IsActive"" boolean NOT NULL DEFAULT TRUE,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""FK_ServiceSubscriptions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
    CONSTRAINT ""FK_ServiceSubscriptions_Packages_PackageId"" FOREIGN KEY (""PackageId"") REFERENCES ""Packages""(""Id"") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ServiceSubscriptions_Code"" ON ""ServiceSubscriptions"" (""Code"");
CREATE INDEX IF NOT EXISTS ""IX_ServiceSubscriptions_UserId_IsActive"" ON ""ServiceSubscriptions"" (""UserId"", ""IsActive"");
";
    await tableCommand.ExecuteNonQueryAsync();
}

static async Task EnsureStandaloneSubscriptionTablesAsync(DbConnection connection)
{
    await using var tableCommand = connection.CreateCommand();
    tableCommand.CommandText = @"
CREATE TABLE IF NOT EXISTS ""SubscriptionPlans"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""Name"" character varying(120) NOT NULL,
    ""VehicleType"" integer NOT NULL,
    ""BillingCycle"" integer NOT NULL,
    ""Price"" numeric(10,2) NOT NULL,
    ""DiscountPercent"" numeric(5,2) NOT NULL DEFAULT 0,
    ""IsActive"" boolean NOT NULL DEFAULT TRUE,
    ""IsPopular"" boolean NOT NULL DEFAULT FALSE,
    ""DisplayOrder"" integer NOT NULL DEFAULT 0,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS ""SubscriptionPlanFeatures"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""PlanId"" integer NOT NULL,
    ""FeatureText"" character varying(200) NOT NULL,
    ""DisplayOrder"" integer NOT NULL DEFAULT 0,
    CONSTRAINT ""FK_SubscriptionPlanFeatures_SubscriptionPlans_PlanId"" FOREIGN KEY (""PlanId"") REFERENCES ""SubscriptionPlans""(""Id"") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ""SubscriptionPlanBenefits"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""PlanId"" integer NOT NULL,
    ""BenefitText"" character varying(200) NOT NULL,
    ""DisplayOrder"" integer NOT NULL DEFAULT 0,
    CONSTRAINT ""FK_SubscriptionPlanBenefits_SubscriptionPlans_PlanId"" FOREIGN KEY (""PlanId"") REFERENCES ""SubscriptionPlans""(""Id"") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ""UserSubscriptions"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""UserId"" integer NOT NULL,
    ""PlanId"" integer NOT NULL,
    ""StartDate"" timestamp with time zone NOT NULL,
    ""NextBillingDate"" timestamp with time zone NOT NULL,
    ""Status"" integer NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""FK_UserSubscriptions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users""(""Id"") ON DELETE RESTRICT,
    CONSTRAINT ""FK_UserSubscriptions_SubscriptionPlans_PlanId"" FOREIGN KEY (""PlanId"") REFERENCES ""SubscriptionPlans""(""Id"") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ""SubscriptionPlanPackages"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""PlanId"" integer NOT NULL,
    ""PackageId"" integer NOT NULL,
    ""DisplayOrder"" integer NOT NULL DEFAULT 0,
    CONSTRAINT ""FK_SubscriptionPlanPackages_Plans_PlanId"" FOREIGN KEY (""PlanId"") REFERENCES ""SubscriptionPlans""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_SubscriptionPlanPackages_Packages_PackageId"" FOREIGN KEY (""PackageId"") REFERENCES ""Packages""(""Id"") ON DELETE RESTRICT
);
";
    await tableCommand.ExecuteNonQueryAsync();

    // Older builds created lowercase column names; normalize them before index creation.
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "vehicletype", "VehicleType");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "vehicle_type", "VehicleType");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "billingcycle", "BillingCycle");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "billing_cycle", "BillingCycle");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "discountpercent", "DiscountPercent");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "discount_percent", "DiscountPercent");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "isactive", "IsActive");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "is_active", "IsActive");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "ispopular", "IsPopular");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "is_popular", "IsPopular");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "displayorder", "DisplayOrder");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "display_order", "DisplayOrder");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "createdat", "CreatedAt");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "created_at", "CreatedAt");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "updatedat", "UpdatedAt");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlans", "updated_at", "UpdatedAt");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlanFeatures", "planid", "PlanId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanFeatures", "featuretext", "FeatureText");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanFeatures", "displayorder", "DisplayOrder");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlanBenefits", "planid", "PlanId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanBenefits", "benefittext", "BenefitText");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanBenefits", "displayorder", "DisplayOrder");

    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "userid", "UserId");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "planid", "PlanId");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "startdate", "StartDate");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "nextbillingdate", "NextBillingDate");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "status", "Status");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "createdat", "CreatedAt");
    await EnsureColumnCasingAsync(connection, "UserSubscriptions", "updatedat", "UpdatedAt");

    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "planid", "PlanId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "plan_id", "PlanId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "packageid", "PackageId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "package_id", "PackageId");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "displayorder", "DisplayOrder");
    await EnsureColumnCasingAsync(connection, "SubscriptionPlanPackages", "display_order", "DisplayOrder");

    await EnsureIndexAsync(connection, "IX_SubscriptionPlans_VehicleType_IsActive_DisplayOrder","CREATE INDEX IF NOT EXISTS \"IX_SubscriptionPlans_VehicleType_IsActive_DisplayOrder\" ON \"SubscriptionPlans\" (\"VehicleType\", \"IsActive\", \"DisplayOrder\");");
    await EnsureIndexAsync(connection, "IX_SubscriptionPlanFeatures_PlanId", "CREATE INDEX IF NOT EXISTS \"IX_SubscriptionPlanFeatures_PlanId\" ON \"SubscriptionPlanFeatures\" (\"PlanId\");");
    await EnsureIndexAsync(connection, "IX_SubscriptionPlanBenefits_PlanId", "CREATE INDEX IF NOT EXISTS \"IX_SubscriptionPlanBenefits_PlanId\" ON \"SubscriptionPlanBenefits\" (\"PlanId\");");
    await EnsureIndexAsync(connection, "IX_UserSubscriptions_UserId_Status", "CREATE INDEX IF NOT EXISTS \"IX_UserSubscriptions_UserId_Status\" ON \"UserSubscriptions\" (\"UserId\", \"Status\");");
    await EnsureIndexAsync(connection, "IX_UserSubscriptions_PlanId_Status", "CREATE INDEX IF NOT EXISTS \"IX_UserSubscriptions_PlanId_Status\" ON \"UserSubscriptions\" (\"PlanId\", \"Status\");");
    await EnsureIndexAsync(connection, "IX_SubscriptionPlanPackages_PlanId_DisplayOrder", "CREATE INDEX IF NOT EXISTS \"IX_SubscriptionPlanPackages_PlanId_DisplayOrder\" ON \"SubscriptionPlanPackages\" (\"PlanId\", \"DisplayOrder\");");
    await EnsureIndexAsync(connection, "IX_SubscriptionPlanPackages_PackageId", "CREATE INDEX IF NOT EXISTS \"IX_SubscriptionPlanPackages_PackageId\" ON \"SubscriptionPlanPackages\" (\"PackageId\");");
    
    await EnsureColumnAsync(connection, "SubscriptionPlans", "DiscountPercent", "numeric(5,2) NOT NULL DEFAULT 0");
}

static async Task EnsureColumnAsync(DbConnection connection, string tableName, string columnName, string columnDefinition)
{
    await using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = @"
SELECT 1
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = @tableName
  AND column_name = @columnName
LIMIT 1;";

    var tableParam = existsCommand.CreateParameter();
    tableParam.ParameterName = "@tableName";
    tableParam.Value = tableName;
    existsCommand.Parameters.Add(tableParam);

    var columnParam = existsCommand.CreateParameter();
    columnParam.ParameterName = "@columnName";
    columnParam.Value = columnName;
    existsCommand.Parameters.Add(columnParam);

    var exists = await existsCommand.ExecuteScalarAsync() != null;
    if (exists)
    {
        return;
    }

    await using var alterCommand = connection.CreateCommand();
    alterCommand.CommandText = $"ALTER TABLE \"{tableName}\" ADD COLUMN \"{columnName}\" {columnDefinition};";
    await alterCommand.ExecuteNonQueryAsync();
}

static async Task EnsureColumnCasingAsync(DbConnection connection, string tableName, string legacyColumnName, string targetColumnName)
{
    await using var existsCommand = connection.CreateCommand();
    existsCommand.CommandText = @"
SELECT 1
FROM information_schema.columns
WHERE table_schema = 'public'
  AND lower(table_name) = lower(@tableName)
  AND column_name = @columnName
LIMIT 1;";

    var tableParam = existsCommand.CreateParameter();
    tableParam.ParameterName = "@tableName";
    tableParam.Value = tableName;
    existsCommand.Parameters.Add(tableParam);

    var targetColumnParam = existsCommand.CreateParameter();
    targetColumnParam.ParameterName = "@columnName";
    targetColumnParam.Value = targetColumnName;
    existsCommand.Parameters.Add(targetColumnParam);

    var targetExists = await existsCommand.ExecuteScalarAsync() != null;
    if (targetExists)
    {
        return;
    }

    existsCommand.Parameters.Clear();

    var legacyTableParam = existsCommand.CreateParameter();
    legacyTableParam.ParameterName = "@tableName";
    legacyTableParam.Value = tableName;
    existsCommand.Parameters.Add(legacyTableParam);

    var legacyColumnParam = existsCommand.CreateParameter();
    legacyColumnParam.ParameterName = "@columnName";
    legacyColumnParam.Value = legacyColumnName;
    existsCommand.Parameters.Add(legacyColumnParam);

    var legacyExists = await existsCommand.ExecuteScalarAsync() != null;
    if (!legacyExists)
    {
        return;
    }

    await using var renameCommand = connection.CreateCommand();
    renameCommand.CommandText = $"ALTER TABLE \"{tableName}\" RENAME COLUMN {legacyColumnName} TO \"{targetColumnName}\";";
    await renameCommand.ExecuteNonQueryAsync();
}

static async Task EnsureBooleanColumnAsync(DbConnection connection, string tableName, string columnName)
{
    await using var typeCommand = connection.CreateCommand();
    typeCommand.CommandText = @"
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = @tableName
  AND column_name = @columnName
LIMIT 1;";

    var tableParam = typeCommand.CreateParameter();
    tableParam.ParameterName = "@tableName";
    tableParam.Value = tableName;
    typeCommand.Parameters.Add(tableParam);

    var columnParam = typeCommand.CreateParameter();
    columnParam.ParameterName = "@columnName";
    columnParam.Value = columnName;
    typeCommand.Parameters.Add(columnParam);

    var dataType = (await typeCommand.ExecuteScalarAsync())?.ToString();

    if (string.IsNullOrWhiteSpace(dataType) || string.Equals(dataType, "boolean", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    if (!string.Equals(dataType, "smallint", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(dataType, "integer", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(dataType, "bigint", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    await using var alterCommand = connection.CreateCommand();
    alterCommand.CommandText = $@"
ALTER TABLE ""{tableName}""
ALTER COLUMN ""{columnName}"" TYPE boolean
USING CASE WHEN ""{columnName}"" = 0 THEN FALSE ELSE TRUE END;";
    await alterCommand.ExecuteNonQueryAsync();
}

static async Task EnsureIndexAsync(DbConnection connection, string indexName, string createSql)
{
    await using var cmd = connection.CreateCommand();
    cmd.CommandText = createSql;
    await cmd.ExecuteNonQueryAsync();
}

static async Task EnsureSlotReservationsTableAsync(DbConnection connection)
{
    await using var cmd = connection.CreateCommand();
    cmd.CommandText = @"
CREATE TABLE IF NOT EXISTS ""SlotReservations"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""PaymentIntentId"" character varying(120) NOT NULL,
    ""ScheduledDate"" timestamp with time zone NOT NULL,
    ""TimeSlot"" character varying(20) NOT NULL,
    ""DurationMinutes"" integer NOT NULL,
    ""CustomerEmail"" character varying(254) NULL,
    ""ExpiresAt"" timestamp with time zone NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS ""IX_SlotReservations_PaymentIntentId"" ON ""SlotReservations"" (""PaymentIntentId"");
CREATE INDEX IF NOT EXISTS ""IX_SlotReservations_ScheduledDate_TimeSlot"" ON ""SlotReservations"" (""ScheduledDate"", ""TimeSlot"");
CREATE INDEX IF NOT EXISTS ""IX_SlotReservations_ExpiresAt"" ON ""SlotReservations"" (""ExpiresAt"");
";
    await cmd.ExecuteNonQueryAsync();
}

static async Task EnsureTranslationTablesAsync(DbConnection connection)
{
    await using var cmd = connection.CreateCommand();
    cmd.CommandText = @"
CREATE TABLE IF NOT EXISTS ""package_translations"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""PackageId"" integer NOT NULL,
    ""Language"" character varying(10) NOT NULL,
    ""Name"" text NOT NULL,
    ""Description"" text NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT ""FK_package_translations_Packages_PackageId"" FOREIGN KEY (""PackageId"") REFERENCES ""Packages""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""UQ_package_translations_PackageId_Language"" UNIQUE (""PackageId"", ""Language"")
);

CREATE TABLE IF NOT EXISTS ""service_translations"" (
    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ""ServiceId"" integer NOT NULL,
    ""Language"" character varying(10) NOT NULL,
    ""Name"" text NOT NULL,
    ""Description"" text NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT ""FK_service_translations_Services_ServiceId"" FOREIGN KEY (""ServiceId"") REFERENCES ""Services""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""UQ_service_translations_ServiceId_Language"" UNIQUE (""ServiceId"", ""Language"")
);

CREATE INDEX IF NOT EXISTS ""IX_package_translations_Language"" ON ""package_translations"" (""Language"");
CREATE INDEX IF NOT EXISTS ""IX_service_translations_Language"" ON ""service_translations"" (""Language"");
";

    await cmd.ExecuteNonQueryAsync();
}
