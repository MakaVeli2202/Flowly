using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Glanz.API.Services;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/admin/translations")]
    [Authorize(Roles = "Admin")]
    public class AdminTranslationsController : ControllerBase
    {
        private readonly IAutoTranslationService _autoTranslationService;

        public AdminTranslationsController(IAutoTranslationService autoTranslationService)
        {
            _autoTranslationService = autoTranslationService;
        }

        [HttpPost("backfill")]
        public async Task<ActionResult> Backfill(CancellationToken cancellationToken)
        {
            var result = await _autoTranslationService.BackfillAllAsync(cancellationToken);
            return Ok(new
            {
                message = "Translations backfill completed",
                result.PackagesProcessed,
                result.ServicesProcessed
            });
        }
    }
}
