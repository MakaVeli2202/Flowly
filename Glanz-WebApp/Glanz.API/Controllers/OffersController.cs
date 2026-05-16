using Glanz.API.DTOs;
using Glanz.API.Modules.Offers;
using Glanz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OffersController : ControllerBase
    {
        private readonly IOfferService _offerService;

        public OffersController(IOfferService offerService)
        {
            _offerService = offerService;
        }

        private int? GetUserId() => User.GetCurrentUserId();

        [Authorize(Roles = "Admin,Employee")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OfferDto>>> GetOffers() =>
            Ok(await _offerService.GetOffersAsync());

        [Authorize]
        [HttpGet("my-coupons")]
        public async Task<ActionResult<IEnumerable<UserOfferDto>>> GetMyCoupons()
        {
            if (!GetUserId().HasValue) return Unauthorized();
            return Ok(await _offerService.GetMyCouponsAsync(GetUserId()!.Value));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("user-coupons")]
        public async Task<ActionResult<IEnumerable<UserOfferDto>>> GetAllUserCoupons() =>
            Ok(await _offerService.GetAllUserCouponsAsync());

        [Authorize]
        [HttpGet("my-loyalty")]
        public async Task<ActionResult<CustomerLoyaltyDto>> GetMyLoyalty()
        {
            if (!GetUserId().HasValue) return Unauthorized();
            var (result, error) = await _offerService.GetMyLoyaltyAsync(GetUserId()!.Value);
            if (result == null) return Unauthorized();
            return Ok(result);
        }

        [Authorize]
        [HttpPost("loyalty/activate-google-review")]
        public async Task<ActionResult> ActivateGoogleReviewLoyalty(IFormFile? screenshot)
        {
            if (!GetUserId().HasValue) return Unauthorized();
            var (error, data) = await _offerService.ActivateGoogleReviewLoyaltyAsync(GetUserId()!.Value, screenshot);
            if (error == "User not found.") return Unauthorized();
            if (error != null) return BadRequest(new { message = error });
            return Ok(data);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("loyalty/pending-reviews")]
        public async Task<ActionResult<IEnumerable<PendingReviewDto>>> GetPendingReviews() =>
            Ok(await _offerService.GetPendingReviewsAsync());

        [Authorize(Roles = "Admin")]
        [HttpPost("loyalty/{userId:int}/approve-review")]
        public async Task<IActionResult> ApproveGoogleReview(int userId)
        {
            var error = await _offerService.ApproveGoogleReviewAsync(userId, GetUserId());
            if (error == "User not found.") return NotFound(new { message = error });
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = $"Loyalty counter activated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("loyalty/{userId:int}/reject-review")]
        public async Task<IActionResult> RejectGoogleReview(int userId)
        {
            var error = await _offerService.RejectGoogleReviewAsync(userId, GetUserId());
            if (error == "User not found.") return NotFound(new { message = error });
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = "Review request rejected." });
        }

        [Authorize]
        [HttpPost("coupons/{id}/activate-google-review")]
        public async Task<ActionResult<UserOfferDto>> ActivateGoogleReviewReward(int id)
        {
            if (!GetUserId().HasValue) return Unauthorized();
            var (result, error) = await _offerService.ActivateGoogleReviewRewardAsync(id, GetUserId()!.Value);
            if (error == "Reward not found.") return NotFound(new { message = error });
            if (error != null) return BadRequest(new { message = error });
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("loyalty-progress")]
        public async Task<ActionResult<IEnumerable<LoyaltyProgressDto>>> GetLoyaltyProgress() =>
            Ok(await _offerService.GetLoyaltyProgressAsync());

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<OfferDto>> CreateOffer([FromBody] CreateOfferDto dto)
        {
            var (result, error, statusCode) = await _offerService.CreateOfferAsync(dto);
            if (result == null) return StatusCode(statusCode, new { message = error });
            return StatusCode(201, result);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateOffer(int id, [FromBody] UpdateOfferDto dto)
        {
            var (error, statusCode) = await _offerService.UpdateOfferAsync(id, dto);
            if (error != null) return StatusCode(statusCode, new { message = error });
            return Ok(new { message = "Offer updated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteOffer(int id)
        {
            var error = await _offerService.DeleteOfferAsync(id);
            if (error != null) return NotFound(new { message = error });
            return Ok(new { message = "Offer deactivated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/assign/{userId}")]
        public async Task<ActionResult> AssignOfferToUser(int id, int userId)
        {
            var (error, code) = await _offerService.AssignOfferToUserAsync(id, userId);
            if (error == "Offer not found." || error == "User not found.") return NotFound(new { message = error });
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = "Coupon assigned to user.", code });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/assign-bulk")]
        public async Task<ActionResult> AssignOfferToMultipleUsers(int id, [FromBody] BulkAssignDto dto)
        {
            var (error, assigned, skipped) = await _offerService.AssignOfferBulkAsync(id, dto);
            if (error == "Offer not found.") return NotFound(new { message = error });
            if (error != null) return BadRequest(new { message = error });
            return Ok(new { message = $"{assigned} coupon(s) assigned, {skipped} skipped (already have one).", assigned, skipped });
        }
    }
}
