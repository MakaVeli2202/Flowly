using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Flowly.API.Modules.Billing;

namespace Flowly.API.Controllers
{
    [ApiController]
    [Route("api/stripe")]
    [AllowAnonymous]
    public class StripeWebhookController : ControllerBase
    {
        private readonly IBillingService _billing;

        public StripeWebhookController(IBillingService billing)
        {
            _billing = billing;
        }

        [HttpPost("webhook")]
        public async Task<IActionResult> HandleWebhook()
        {
            var payload = await new StreamReader(Request.Body).ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? string.Empty;
            var (error, statusCode) = await _billing.HandleStripeWebhookAsync(payload, signature);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok();
        }
    }
}
