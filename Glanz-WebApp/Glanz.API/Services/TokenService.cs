using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Glanz.API.Models;

namespace Glanz.API.Services
{
    public interface ITokenService
    {
        string GenerateToken(User user);
        string GenerateToken(Staff staff);
        string GenerateRefreshToken();
    }

    public class TokenService : ITokenService
    {
        private readonly IConfiguration _configuration;
        private readonly IHostEnvironment _env;
        private readonly ILogger<TokenService> _logger;

        public TokenService(IConfiguration configuration, IHostEnvironment env, ILogger<TokenService> logger)
        {
            _configuration = configuration;
            _env = env;
            _logger = logger;
        }

        public string GenerateRefreshToken()
        {
            var bytes = new byte[64];
            System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
            return Convert.ToBase64String(bytes);
        }

        public string GenerateToken(User user)
        {
            return BuildToken(user.Id, user.Email, user.FirstName, user.LastName, user.Role);
        }

        public string GenerateToken(Staff staff)
        {
            return BuildToken(staff.Id, staff.Email, staff.FirstName, staff.LastName, staff.Role);
        }

        private string BuildToken(int id, string email, string firstName, string lastName, string role)
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["SecretKey"];
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!));

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.GivenName, firstName),
                new Claim(ClaimTypes.Surname, lastName),
                new Claim(ClaimTypes.Role, role)
            };

            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Development: use configured ExpirationMinutes (default 720 = 12 h) for friction-free testing.
            // Production: cap to 30 minutes regardless of config. Override via JwtSettings__ExpirationMinutes
            // Railway env var if a different production window is needed.
            var configuredMinutes = Convert.ToDouble(jwtSettings["ExpirationMinutes"] ?? "720");
            var expiryMinutes = _env.IsProduction()
                ? Math.Min(configuredMinutes, 30)
                : configuredMinutes;

            // Log expiry so mismatches between dev and prod are immediately visible.
            _logger.LogInformation(
                "[JWT] Issued token for {Email} ({Role}) — expires in {Minutes} min ({Env})",
                email, role, expiryMinutes, _env.EnvironmentName);

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
