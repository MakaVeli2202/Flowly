using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Flowly.API.Data;
using Xunit;

namespace Flowly.API.Tests.Integration
{
    // WebApplicationFactory wires up the real ASP.NET Core pipeline with an
    // in-memory SQLite database so we test routing, auth, and serialization
    // without touching a real database or external services.
    public class BookingFlowTests : IClassFixture<BookingFlowTests.FlowlyWebAppFactory>
    {
        public class FlowlyWebAppFactory : WebApplicationFactory<Program>, IDisposable
        {
            // Keep the connection alive so the in-memory SQLite DB persists for the factory lifetime
            private readonly SqliteConnection _connection = new("DataSource=:memory:");

            public FlowlyWebAppFactory() => _connection.Open();

            protected override void ConfigureWebHost(IWebHostBuilder builder)
            {
                // Development environment skips the JWT secret length check
                builder.UseEnvironment("Development");

                builder.ConfigureAppConfiguration((_, cfg) =>
                {
                    cfg.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["JwtSettings:SecretKey"]        = "integration-test-secret-key-at-least-32-chars",
                        ["JwtSettings:Issuer"]           = "FlowlyTest",
                        ["JwtSettings:Audience"]         = "FlowlyTest",
                        ["SeedData:SeedDemoData"]        = "false",
                        // Webhook secret active so signature tests work with the main factory
                        ["TapPayments:WebhookSecret"]    = "integration-webhook-secret-32chars!",
                    });
                });

                builder.ConfigureServices(services =>
                {
                    // EF Core 10 rejects both (a) multiple IDatabaseProvider registrations
                    // in the DI container and (b) DbContextOptions containing two relational
                    // extensions. Remove all EF registrations specific to AppDbContext —
                    // the options descriptor AND any IDbContextOptionsConfiguration<T>
                    // entries (used by EF 10 to build options lazily) — before adding SQLite.
                    var toRemove = services
                        .Where(d =>
                            d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                            || d.ServiceType == typeof(AppDbContext)
                            || (d.ServiceType.IsGenericType
                                && d.ServiceType.GetGenericTypeDefinition().Name
                                       .StartsWith("IDbContextOptionsConfiguration")
                                && d.ServiceType.GenericTypeArguments.Length == 1
                                && d.ServiceType.GenericTypeArguments[0] == typeof(AppDbContext)))
                        .ToList();
                    foreach (var d in toRemove) services.Remove(d);

                    services.AddDbContext<AppDbContext>(opts =>
                        opts.UseSqlite(_connection));
                });
            }

            protected override void Dispose(bool disposing)
            {
                base.Dispose(disposing);
                if (disposing) _connection.Dispose();
            }
        }

        private readonly FlowlyWebAppFactory _factory;

        public BookingFlowTests(FlowlyWebAppFactory factory)
        {
            _factory = factory;
        }

        // ── /Bookings/available-slots is publicly accessible ──────────────────
        [Fact]
        public async Task GetAvailableSlots_NoAuth_Returns200OrBadRequest()
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync("/api/Bookings/available-slots?date=2026-06-01");

            // 200 = slots returned; 400 = date in the past/invalid — both are valid
            // outcomes from an unauthenticated public endpoint (NOT 401/500)
            Assert.True(
                response.StatusCode == HttpStatusCode.OK ||
                response.StatusCode == HttpStatusCode.BadRequest,
                $"Expected 200 or 400, got {(int)response.StatusCode}");
        }

        // ── /Bookings/all requires Admin auth ─────────────────────────────────
        [Fact]
        public async Task GetAllBookings_NoAuth_Returns401()
        {
            var client = _factory.CreateClient(
                new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

            var response = await client.GetAsync("/api/Bookings/all");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ── /Bookings/availability-calendar is publicly accessible ───────────────
        [Fact]
        public async Task GetAvailabilityCalendar_NoAuth_Returns200()
        {
            var client = _factory.CreateClient();
            var from   = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var to     = DateTime.UtcNow.AddDays(7).ToString("yyyy-MM-dd");

            var response = await client.GetAsync($"/api/Bookings/availability-calendar?from={from}&to={to}");

            // Public endpoint — no auth required, should return 200
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // ── Webhook HMAC: missing signature header returns 400 ─────────────────
        // Factory has TapPayments:WebhookSecret configured, so signature is enforced
        [Fact]
        public async Task TapWebhook_MissingSignature_Returns400WhenSecretConfigured()
        {
            var client  = _factory.CreateClient();
            var content = new StringContent("{\"id\":\"ch_1\",\"status\":\"CAPTURED\"}", Encoding.UTF8, "application/json");

            var response = await client.PostAsync("/api/Webhooks/tap", content);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ── Webhook HMAC: valid signature is accepted ──────────────────────────
        [Fact]
        public async Task TapWebhook_ValidSignature_DoesNotReturn400()
        {
            const string secret = "integration-webhook-secret-32chars!";
            const string body   = "{\"id\":\"ch_999\",\"status\":\"CAPTURED\"}";

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();

            var client  = _factory.CreateClient();
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/Webhooks/tap")
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            request.Headers.Add("hashstring", sig);

            var response = await client.SendAsync(request);

            // Signature valid → not rejected (200 = processed, 200/ok = charge not in DB is fine)
            Assert.NotEqual(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
}
