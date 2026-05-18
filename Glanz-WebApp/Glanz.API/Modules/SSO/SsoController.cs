using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Glanz.API.Data;
using Glanz.API.Models;
using Glanz.API.Platform.Tenancy;
using Glanz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Glanz.API.Modules.SSO
{
    [ApiController]
    [Route("api/[controller]")]
    public class SsoController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _http;
        private readonly ITokenService _tokens;
        private readonly TenantContext _tenant;
        private readonly ILogger<SsoController> _logger;

        public SsoController(AppDbContext db, IConfiguration config, IHttpClientFactory http, ITokenService tokens, TenantContext tenant, ILogger<SsoController> logger)
        {
            _db = db;
            _config = config;
            _http = http;
            _tokens = tokens;
            _tenant = tenant;
            _logger = logger;
        }

        // GET api/sso/{orgSlug}/login
        // Initiates the OIDC authorization code flow for an org's SSO configuration.
        [HttpGet("{orgSlug}/login")]
        public async Task<IActionResult> Login(string orgSlug, [FromQuery] string? returnUrl)
        {
            var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Slug == orgSlug);
            if (org == null) return NotFound("Organization not found.");

            var ssoConfig = await _db.SsoConfigurations.AsNoTracking()
                .FirstOrDefaultAsync(c => c.OrgId == org.Id && c.Enabled);
            if (ssoConfig == null) return BadRequest("SSO is not configured for this organization.");

            var authority = BuildAuthority(ssoConfig);
            var redirectUri = BuildCallbackUrl();
            var state = BuildState(orgSlug, returnUrl);
            var scope = "openid profile email" + (ssoConfig.AdditionalScopes != null ? " " + ssoConfig.AdditionalScopes : "");

            var authUrl = $"{authority}/oauth2/v2.0/authorize" +
                $"?client_id={Uri.EscapeDataString(ssoConfig.ClientId)}" +
                $"&response_type=code" +
                $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                $"&scope={Uri.EscapeDataString(scope)}" +
                $"&state={Uri.EscapeDataString(state)}" +
                $"&response_mode=query";

            return Redirect(authUrl);
        }

        // GET api/sso/callback
        // Handles OIDC callback: exchanges code, validates token, issues JWT.
        [HttpGet("callback")]
        public async Task<IActionResult> Callback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
                return BadRequest("Missing code or state.");

            var (orgSlug, returnUrl) = ParseState(state);
            if (orgSlug == null) return BadRequest("Invalid state.");

            var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Slug == orgSlug, ct);
            if (org == null) return BadRequest("Organization not found.");

            var ssoConfig = await _db.SsoConfigurations.AsNoTracking()
                .FirstOrDefaultAsync(c => c.OrgId == org.Id && c.Enabled, ct);
            if (ssoConfig == null) return BadRequest("SSO not configured.");

            // Exchange code for tokens
            var tokenResponse = await ExchangeCodeAsync(ssoConfig, code, ct);
            if (tokenResponse == null) return StatusCode(502, "Token exchange failed.");

            // Validate and extract claims from ID token
            var claims = await ValidateIdTokenAsync(ssoConfig, tokenResponse.IdToken, ct);
            if (claims == null) return Unauthorized("ID token validation failed.");

            var email = claims.FindFirst(ClaimTypes.Email)?.Value ?? claims.FindFirst("email")?.Value;
            var name = claims.FindFirst(ClaimTypes.Name)?.Value ?? claims.FindFirst("name")?.Value ?? email;

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest("No email claim in SSO token.");

            // Find or create admin user for this org
            var user = await _db.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.OrgId == org.Id && u.Email == email, ct);

            if (user == null)
            {
                var parts = (name ?? email).Split(' ', 2);
                user = new User
                {
                    OrgId = org.Id,
                    Email = email,
                    FirstName = parts[0],
                    LastName = parts.Length > 1 ? parts[1] : string.Empty,
                    Role = "Staff", // SSO users default to Staff; admin can promote
                    PasswordHash = string.Empty,
                    IsEmailVerified = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync(ct);
            }

            var jwt = _tokens.GenerateToken(user);
            var frontendUrl = _config["FrontendUrl"] ?? "/";
            var destination = string.IsNullOrWhiteSpace(returnUrl) ? frontendUrl : returnUrl;

            return Redirect($"{destination}?sso_token={Uri.EscapeDataString(jwt)}");
        }

        // POST api/sso/config  (Admin)
        [Authorize(Roles = "Admin")]
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveSsoConfigDto dto)
        {
            var orgId = _tenant.OrgId;
            var existing = await _db.SsoConfigurations.FirstOrDefaultAsync(c => c.OrgId == orgId);

            if (existing == null)
            {
                _db.SsoConfigurations.Add(new SsoConfiguration
                {
                    OrgId = orgId,
                    Provider = dto.Provider,
                    TenantId = dto.TenantId,
                    ClientId = dto.ClientId,
                    ClientSecretHash = dto.ClientSecret,
                    AdditionalScopes = dto.AdditionalScopes,
                    Enabled = dto.Enabled
                });
            }
            else
            {
                existing.Provider = dto.Provider;
                existing.TenantId = dto.TenantId;
                existing.ClientId = dto.ClientId;
                if (!string.IsNullOrWhiteSpace(dto.ClientSecret))
                    existing.ClientSecretHash = dto.ClientSecret;
                existing.AdditionalScopes = dto.AdditionalScopes;
                existing.Enabled = dto.Enabled;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "SSO configuration saved." });
        }

        // GET api/sso/config  (Admin)
        [Authorize(Roles = "Admin")]
        [HttpGet("config")]
        public async Task<ActionResult<SsoConfigDto>> GetConfig()
        {
            var orgId = _tenant.OrgId;
            var cfg = await _db.SsoConfigurations.AsNoTracking()
                .FirstOrDefaultAsync(c => c.OrgId == orgId);

            if (cfg == null) return Ok(new SsoConfigDto());

            return Ok(new SsoConfigDto
            {
                Provider = cfg.Provider,
                TenantId = cfg.TenantId,
                ClientId = cfg.ClientId,
                AdditionalScopes = cfg.AdditionalScopes,
                Enabled = cfg.Enabled,
                HasSecret = !string.IsNullOrWhiteSpace(cfg.ClientSecretHash)
            });
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        private static string BuildAuthority(SsoConfiguration cfg)
        {
            var tenantId = string.IsNullOrWhiteSpace(cfg.TenantId) ? "common" : cfg.TenantId;
            return $"https://login.microsoftonline.com/{tenantId}";
        }

        private string BuildCallbackUrl()
        {
            var req = HttpContext.Request;
            return $"{req.Scheme}://{req.Host}/api/sso/callback";
        }

        private static string BuildState(string orgSlug, string? returnUrl)
        {
            var obj = new { orgSlug, returnUrl };
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(obj)));
        }

        private static (string? orgSlug, string? returnUrl) ParseState(string state)
        {
            try
            {
                var json = Encoding.UTF8.GetString(Convert.FromBase64String(state));
                using var doc = JsonDocument.Parse(json);
                var orgSlug = doc.RootElement.GetProperty("orgSlug").GetString();
                doc.RootElement.TryGetProperty("returnUrl", out var rv);
                return (orgSlug, rv.ValueKind == JsonValueKind.String ? rv.GetString() : null);
            }
            catch { return (null, null); }
        }

        private async Task<TokenResponse?> ExchangeCodeAsync(SsoConfiguration cfg, string code, CancellationToken ct)
        {
            var authority = BuildAuthority(cfg);
            var redirectUri = BuildCallbackUrl();
            var client = _http.CreateClient();

            var body = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["client_id"] = cfg.ClientId,
                ["client_secret"] = cfg.ClientSecretHash,
                ["code"] = code,
                ["redirect_uri"] = redirectUri,
                ["scope"] = "openid profile email"
            });

            try
            {
                var response = await client.PostAsync($"{authority}/oauth2/v2.0/token", body, ct);
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);
                return new TokenResponse(
                    doc.RootElement.GetProperty("id_token").GetString() ?? string.Empty,
                    doc.RootElement.TryGetProperty("access_token", out var at) ? at.GetString() : null
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSO token exchange failed");
                return null;
            }
        }

        private async Task<ClaimsPrincipal?> ValidateIdTokenAsync(SsoConfiguration cfg, string idToken, CancellationToken ct)
        {
            try
            {
                var authority = BuildAuthority(cfg);
                var configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                    $"{authority}/v2.0/.well-known/openid-configuration",
                    new OpenIdConnectConfigurationRetriever(),
                    new HttpDocumentRetriever { RequireHttps = true });

                var oidcConfig = await configManager.GetConfigurationAsync(ct);

                var validationParams = new TokenValidationParameters
                {
                    ValidateIssuer = false, // tenants vary; org admin is responsible for their config
                    ValidateAudience = true,
                    ValidAudience = cfg.ClientId,
                    ValidateLifetime = true,
                    IssuerSigningKeys = oidcConfig.SigningKeys
                };

                var handler = new JwtSecurityTokenHandler();
                return handler.ValidateToken(idToken, validationParams, out _);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSO ID token validation failed");
                return null;
            }
        }

        private record TokenResponse(string IdToken, string? AccessToken);
    }

    public record SaveSsoConfigDto(
        string Provider,
        string? TenantId,
        string ClientId,
        string ClientSecret,
        string? AdditionalScopes,
        bool Enabled);

    public class SsoConfigDto
    {
        public string Provider { get; set; } = "AzureAD";
        public string? TenantId { get; set; }
        public string? ClientId { get; set; }
        public string? AdditionalScopes { get; set; }
        public bool Enabled { get; set; }
        public bool HasSecret { get; set; }
    }
}
