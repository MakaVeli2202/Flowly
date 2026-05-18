using Glanz.API.Platform.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Glanz.API.Modules.AI
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AIController : ControllerBase
    {
        private readonly IAIService _ai;
        private readonly TenantContext _tenant;

        public AIController(IAIService ai, TenantContext tenant)
        {
            _ai = ai;
            _tenant = tenant;
        }

        // POST api/AI/crm-assist
        [HttpPost("crm-assist")]
        public async Task<ActionResult<AiReplyDto>> CrmAssist([FromBody] CrmAssistRequestDto dto, CancellationToken ct)
        {
            var reply = await _ai.CrmNextActionsAsync(_tenant.OrgId, dto.CustomerId, ct);
            return Ok(new AiReplyDto(reply));
        }

        // GET api/AI/insights
        [HttpGet("insights")]
        public async Task<ActionResult<AiReplyDto>> Insights(CancellationToken ct)
        {
            var reply = await _ai.BusinessInsightsAsync(_tenant.OrgId, ct);
            return Ok(new AiReplyDto(reply));
        }

        // POST api/AI/marketing
        [HttpPost("marketing")]
        public async Task<ActionResult<AiReplyDto>> Marketing([FromBody] MarketingRequestDto dto, CancellationToken ct)
        {
            var reply = await _ai.MarketingCopyAsync(_tenant.OrgId, dto.Objective, dto.Language ?? "en", ct);
            return Ok(new AiReplyDto(reply));
        }

        // GET api/AI/upsell/{bookingId}
        [HttpGet("upsell/{bookingId:int}")]
        public async Task<ActionResult<AiReplyDto>> Upsell(int bookingId, CancellationToken ct)
        {
            var reply = await _ai.UpsellSuggestionsAsync(_tenant.OrgId, bookingId, ct);
            return Ok(new AiReplyDto(reply));
        }
    }

    public record AiReplyDto(string Reply);
    public record CrmAssistRequestDto(int CustomerId);
    public record MarketingRequestDto(string Objective, string? Language);
}
