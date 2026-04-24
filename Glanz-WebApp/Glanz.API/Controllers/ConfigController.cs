using Microsoft.AspNetCore.Mvc;

namespace Glanz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    [HttpGet("features")]
    public IActionResult GetFeatures()
    {
        return Ok(new {
            chatbotEnabled = true,
            loyaltyEnabled = true,
            subscriptionEnabled = true
        });
    }
}