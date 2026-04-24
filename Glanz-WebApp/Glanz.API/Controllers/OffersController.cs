using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OffersController : ControllerBase
    {
        private const string GoogleReviewUrl = "https://www.google.com/search?q=Glanz+Qatar+Google+review";

        private readonly AppDbContext _context;
        private readonly IAdminNotificationService _notificationService;

        public OffersController(AppDbContext context, IAdminNotificationService notificationService)
        {
            _context = context;
            _notificationService = notificationService;
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
            {
                return userId;
            }

            return null;
        }

        [Authorize(Roles = "Admin,Worker")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OfferDto>>> GetOffers()
        {
            var offers = await _context.Offers
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(offers.Select(MapOffer));
        }

        [Authorize]
        [HttpGet("my-coupons")]
        public async Task<ActionResult<IEnumerable<UserOfferDto>>> GetMyCoupons()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var loyaltyActivationAt = await _context.Users
                .Where(u => u.Id == userId.Value)
                .Select(u => u.LoyaltyGoogleReviewActivatedAt)
                .FirstOrDefaultAsync();

            var coupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .Where(uo => uo.UserId == userId.Value
                    && !uo.IsRedeemed
                    && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow)
                    && (!uo.Offer.IsLoyaltyProgram
                        || (loyaltyActivationAt.HasValue && uo.AssignedAt >= loyaltyActivationAt.Value)))
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();

            return Ok(coupons.Select(MapUserOffer));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("user-coupons")]
        public async Task<ActionResult<IEnumerable<UserOfferDto>>> GetAllUserCoupons()
        {
            var coupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();

            return Ok(coupons.Select(MapUserOffer));
        }

        [Authorize]
        [HttpGet("my-loyalty")]
        public async Task<ActionResult<CustomerLoyaltyDto>> GetMyLoyalty()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user == null)
            {
                return Unauthorized();
            }

            var completedBookings = await _context.Bookings
                .CountAsync(b => b.UserId == userId.Value && b.Status == BookingStatus.Completed);

            var eligibleCompletedBookings = user.LoyaltyGoogleReviewActivatedAt.HasValue
                ? await _context.Bookings.CountAsync(b =>
                    b.UserId == userId.Value
                    && b.Status == BookingStatus.Completed
                    && ((b.WorkCompletedAt ?? b.UpdatedAt) >= user.LoyaltyGoogleReviewActivatedAt.Value))
                : 0;

            var loyaltyPrograms = await _context.Offers
                .Where(o => o.IsLoyaltyProgram && o.IsActive && o.TriggerCompletedBookings.HasValue
                    && (!o.StartsAt.HasValue || o.StartsAt <= DateTime.UtcNow)
                    && (!o.EndsAt.HasValue || o.EndsAt >= DateTime.UtcNow))
                .ToListAsync();

            var programProgress = loyaltyPrograms.Select(o =>
            {
                var trigger = o.TriggerCompletedBookings!.Value;
                var completed = 0;
                var bookingsToNext = trigger;
                var progressPercent = 0m;

                if (user.LoyaltyGoogleReviewActivatedAt.HasValue)
                {
                    completed = eligibleCompletedBookings % trigger;

                    if (completed == 0 && eligibleCompletedBookings > 0)
                    {
                        completed = trigger;
                        bookingsToNext = 0;
                        progressPercent = 100;
                    }
                    else
                    {
                        bookingsToNext = trigger - completed;
                        progressPercent = Math.Round((decimal)completed / trigger * 100, 0);
                    }
                }

                return new CustomerLoyaltyProgramProgressDto
                {
                    OfferId = o.Id,
                    ProgramName = o.Name,
                    Description = o.Description,
                    TriggerBookings = trigger,
                    CompletedBookings = completed,
                    BookingsToNext = bookingsToNext,
                    ProgressPercent = progressPercent
                };
            }).ToList();

            var availableCoupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .Where(uo => uo.UserId == userId.Value && !uo.IsRedeemed
                    && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow))
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();

            var unlockedCoupons = availableCoupons
                .Where(uo => !uo.Offer.IsLoyaltyProgram
                    || (user.LoyaltyGoogleReviewActivatedAt.HasValue && uo.AssignedAt >= user.LoyaltyGoogleReviewActivatedAt.Value))
                .ToList();

            var pendingActivationCoupons = new List<UserOffer>();

            return Ok(new CustomerLoyaltyDto
            {
                TotalCompletedBookings = completedBookings,
                EligibleCompletedBookings = eligibleCompletedBookings,
                IsGoogleReviewActivated = user.LoyaltyGoogleReviewActivatedAt.HasValue,
                GoogleReviewActivatedAt = user.LoyaltyGoogleReviewActivatedAt,
                Programs = programProgress,
                AvailableCoupons = unlockedCoupons.Select(MapUserOffer).ToList(),
                PendingActivationCoupons = pendingActivationCoupons.Select(MapUserOffer).ToList(),
                GoogleReviewUrl = GoogleReviewUrl
            });
        }

        [Authorize]
        [HttpPost("loyalty/activate-google-review")]
        public async Task<ActionResult> ActivateGoogleReviewLoyalty()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
            {
                return Unauthorized();
            }

            user.LoyaltyGoogleReviewActivatedAt ??= DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Loyalty counter activated.",
                googleReviewActivatedAt = user.LoyaltyGoogleReviewActivatedAt,
                googleReviewUrl = GoogleReviewUrl
            });
        }

        [Authorize]
        [HttpPost("coupons/{id}/activate-google-review")]
        public async Task<ActionResult<UserOfferDto>> ActivateGoogleReviewReward(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized();
            }

            var coupon = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .FirstOrDefaultAsync(uo => uo.Id == id && uo.UserId == userId.Value);

            if (coupon == null)
            {
                return NotFound(new { message = "Reward not found." });
            }

            if (coupon.IsRedeemed)
            {
                return BadRequest(new { message = "This reward has already been redeemed." });
            }

            if (coupon.ExpiresAt.HasValue && coupon.ExpiresAt.Value < DateTime.UtcNow)
            {
                return BadRequest(new { message = "This reward has expired." });
            }

            if (!coupon.Offer.IsLoyaltyProgram)
            {
                return BadRequest(new { message = "Only loyalty rewards require Google review activation." });
            }

            coupon.GoogleReviewActivatedAt ??= DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(MapUserOffer(coupon));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("loyalty-progress")]
        public async Task<ActionResult<IEnumerable<LoyaltyProgressDto>>> GetLoyaltyProgress()
        {
            var users = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .ToListAsync();

            var userIds = users.Select(u => u.Id).ToList();

            var completedBookingsByUser = await _context.Bookings
                .Where(b => b.UserId.HasValue && userIds.Contains(b.UserId.Value) && b.Status == BookingStatus.Completed)
                .GroupBy(b => b.UserId!.Value)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            var availableCouponsByUser = await _context.UserOffers
                .Where(uo => userIds.Contains(uo.UserId)
                             && !uo.IsRedeemed
                             && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow))
                .GroupBy(uo => uo.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            var progress = users.Select(u => new LoyaltyProgressDto
            {
                UserId = u.Id,
                UserName = $"{u.FirstName} {u.LastName}".Trim(),
                UserEmail = u.Email,
                CompletedBookingsCount = completedBookingsByUser.TryGetValue(u.Id, out var completed) ? completed : 0,
                AvailableCouponsCount = availableCouponsByUser.TryGetValue(u.Id, out var coupons) ? coupons : 0
            });

            return Ok(progress);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<OfferDto>> CreateOffer([FromBody] CreateOfferDto dto)
        {
            if (!dto.IsLoyaltyProgram && string.IsNullOrWhiteSpace(dto.Code))
            {
                return BadRequest(new { message = "Code is required for regular offers." });
            }

            if (dto.IsLoyaltyProgram && (!dto.TriggerCompletedBookings.HasValue || dto.TriggerCompletedBookings <= 0))
            {
                return BadRequest(new { message = "Trigger completed bookings must be greater than zero for loyalty offers." });
            }

            var normalizedCode = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim().ToUpperInvariant();
            if (!string.IsNullOrWhiteSpace(normalizedCode) && await _context.Offers.AnyAsync(o => o.Code == normalizedCode))
            {
                return BadRequest(new { message = "Offer code already exists." });
            }

            var offer = new Offer
            {
                Name = dto.Name.Trim(),
                Code = normalizedCode,
                Description = dto.Description?.Trim(),
                DiscountType = dto.DiscountType,
                DiscountValue = dto.DiscountValue,
                MinBookingAmount = dto.MinBookingAmount,
                IsLoyaltyProgram = dto.IsLoyaltyProgram,
                TriggerCompletedBookings = dto.IsLoyaltyProgram ? dto.TriggerCompletedBookings : null,
                CouponValidityDays = dto.CouponValidityDays,
                MaxUsesPerUser = dto.MaxUsesPerUser,
                StartsAt = dto.StartsAt,
                EndsAt = dto.EndsAt,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Offers.Add(offer);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetOffers), new { id = offer.Id }, MapOffer(offer));
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateOffer(int id, [FromBody] UpdateOfferDto dto)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null)
            {
                return NotFound(new { message = "Offer not found." });
            }

            if (dto.Name != null) offer.Name = dto.Name.Trim();
            if (dto.Description != null) offer.Description = dto.Description.Trim();
            if (dto.DiscountType.HasValue) offer.DiscountType = dto.DiscountType.Value;
            if (dto.DiscountValue.HasValue) offer.DiscountValue = dto.DiscountValue.Value;
            if (dto.MinBookingAmount.HasValue) offer.MinBookingAmount = dto.MinBookingAmount.Value;
            if (dto.IsLoyaltyProgram.HasValue) offer.IsLoyaltyProgram = dto.IsLoyaltyProgram.Value;
            if (dto.TriggerCompletedBookings.HasValue) offer.TriggerCompletedBookings = dto.TriggerCompletedBookings.Value;
            if (dto.CouponValidityDays.HasValue) offer.CouponValidityDays = dto.CouponValidityDays.Value;
            if (dto.MaxUsesPerUser.HasValue) offer.MaxUsesPerUser = dto.MaxUsesPerUser.Value;
            if (dto.StartsAt.HasValue || dto.StartsAt == null) offer.StartsAt = dto.StartsAt;
            if (dto.EndsAt.HasValue || dto.EndsAt == null) offer.EndsAt = dto.EndsAt;
            if (dto.IsActive.HasValue) offer.IsActive = dto.IsActive.Value;

            if (dto.Code != null)
            {
                var normalizedCode = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim().ToUpperInvariant();
                if (!string.IsNullOrWhiteSpace(normalizedCode) && await _context.Offers.AnyAsync(o => o.Id != id && o.Code == normalizedCode))
                {
                    return BadRequest(new { message = "Offer code already exists." });
                }

                offer.Code = normalizedCode;
            }

            if (!offer.IsLoyaltyProgram && string.IsNullOrWhiteSpace(offer.Code))
            {
                return BadRequest(new { message = "Code is required for regular offers." });
            }

            if (offer.IsLoyaltyProgram && (!offer.TriggerCompletedBookings.HasValue || offer.TriggerCompletedBookings <= 0))
            {
                return BadRequest(new { message = "Trigger completed bookings must be greater than zero for loyalty offers." });
            }

            offer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Offer updated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteOffer(int id)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null)
            {
                return NotFound(new { message = "Offer not found." });
            }

            offer.IsActive = false;
            offer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Offer deactivated successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/assign/{userId}")]
        public async Task<ActionResult> AssignOfferToUser(int id, int userId)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null)
            {
                return NotFound(new { message = "Offer not found." });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            var personalCode = BuildPersonalCode(offer.Code, userId);
            var exists = await _context.UserOffers.AnyAsync(uo => uo.PersonalCode == personalCode && !uo.IsRedeemed);
            if (exists)
            {
                return BadRequest(new { message = "An active coupon with this code already exists for the user." });
            }

            _context.UserOffers.Add(new UserOffer
            {
                UserId = userId,
                OfferId = offer.Id,
                PersonalCode = personalCode,
                AssignedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)),
                IsRedeemed = false
            });

            await _context.SaveChangesAsync();
            await _notificationService.NotifyOfferAssignedAsync(userId, offer, personalCode);
            return Ok(new { message = "Coupon assigned to user.", code = personalCode });
        }

        private static string BuildPersonalCode(string? baseCode, int userId)
        {
            var prefix = string.IsNullOrWhiteSpace(baseCode) ? "LOYAL" : baseCode.Trim().ToUpperInvariant();
            return $"{prefix}-U{userId}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        }

        private static OfferDto MapOffer(Offer o)
        {
            return new OfferDto
            {
                Id = o.Id,
                Name = o.Name,
                Code = o.Code,
                Description = o.Description,
                DiscountType = o.DiscountType,
                DiscountValue = o.DiscountValue,
                MinBookingAmount = o.MinBookingAmount,
                IsLoyaltyProgram = o.IsLoyaltyProgram,
                TriggerCompletedBookings = o.TriggerCompletedBookings,
                CouponValidityDays = o.CouponValidityDays,
                MaxUsesPerUser = o.MaxUsesPerUser,
                StartsAt = o.StartsAt,
                EndsAt = o.EndsAt,
                IsActive = o.IsActive,
                CreatedAt = o.CreatedAt
            };
        }

        private static UserOfferDto MapUserOffer(UserOffer uo)
        {
            return new UserOfferDto
            {
                Id = uo.Id,
                UserId = uo.UserId,
                UserName = $"{uo.User.FirstName} {uo.User.LastName}".Trim(),
                UserEmail = uo.User.Email,
                OfferId = uo.OfferId,
                OfferName = uo.Offer.Name,
                PersonalCode = uo.PersonalCode,
                IsRedeemed = uo.IsRedeemed,
                AssignedAt = uo.AssignedAt,
                ExpiresAt = uo.ExpiresAt,
                RedeemedAt = uo.RedeemedAt,
                EarnedAtCompletedBookingsCount = uo.EarnedAtCompletedBookingsCount,
                RequiresGoogleReviewActivation = uo.Offer.IsLoyaltyProgram,
                IsActivationLocked = uo.Offer.IsLoyaltyProgram && !uo.User.LoyaltyGoogleReviewActivatedAt.HasValue,
                GoogleReviewActivatedAt = uo.User.LoyaltyGoogleReviewActivatedAt
            };
        }
    }
}
