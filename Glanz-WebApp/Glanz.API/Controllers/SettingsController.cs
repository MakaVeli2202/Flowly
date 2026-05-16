using Glanz.API.DTOs;
using Glanz.API.Modules.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private readonly ISettingsService _settingsService;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(ISettingsService settingsService, ILogger<SettingsController> logger)
        {
            _settingsService = settingsService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetSettings() =>
            Ok(await _settingsService.GetSettingsAsync());

        [HttpPut]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "Request body is required." });

            var (error, message) = await _settingsService.UpdateSettingsAsync(dto);
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message });
        }

        [HttpPost("gate/verify")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyGateAccess([FromBody] GateVerifyDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { message = "Email and password are required.", reasonCode = "invalid_payload" });

            var (token, error, reasonCode, statusCode) = await _settingsService.VerifyGateAccessAsync(dto.Email, dto.Password);
            if (token != null) return Ok(new { token });
            return StatusCode(statusCode, new { message = error, reasonCode });
        }

        [HttpPost("gate/recover-admin")]
        [AllowAnonymous]
        public async Task<IActionResult> RecoverAdminPassword([FromBody] GateAdminRecoveryDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.NewPassword) || string.IsNullOrWhiteSpace(dto.RecoveryToken))
                return BadRequest(new { message = "Email, newPassword, and recoveryToken are required.", reasonCode = "invalid_payload" });

            var (error, reasonCode, statusCode) = await _settingsService.RecoverAdminPasswordAsync(dto.Email, dto.NewPassword, dto.RecoveryToken);
            if (error != null) return StatusCode(statusCode, new { message = error, reasonCode });
            return Ok(new { message = "Admin password has been reset.", reasonCode });
        }
    }
}
