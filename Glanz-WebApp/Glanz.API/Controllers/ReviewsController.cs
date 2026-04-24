using Microsoft.AspNetCore.Mvc;

namespace Glanz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    [HttpGet("public")]
    public IActionResult GetPublic()
    {
        return Ok(new[] {
            new { id = 1, customerName = "Ahmed K.", rating = 5, comment = "Amazing service! My car looks brand new.", createdAt = "2026-04-20" },
            new { id = 2, customerName = "Sara M.", rating = 5, comment = "Very professional team. Highly recommend!", createdAt = "2026-04-18" },
            new { id = 3, customerName = "Khalid R.", rating = 4, comment = "Great job on the interior detailing.", createdAt = "2026-04-15" }
        });
    }
}