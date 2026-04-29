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
        private readonly IAuditService _audit;

        public OffersController(AppDbContext context, IAdminNotificationService notificationService, IAuditService audit)
        {
            _context = context;
            _notificationService = notificationService;
            _audit = audit;
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

        [Authorize(Roles = "Admin,Employee")]
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
                .CountAsync(b => b.UserId == userId.Value && b.Status == BookingStatus.Completed && b.TotalAmount > 0);

            var eligibleCompletedBookings = user.LoyaltyGoogleReviewActivatedAt.HasValue
                ? await _context.Bookings.CountAsync(b =>
                    b.UserId == userId.Value
                    && b.Status == BookingStatus.Completed
                    && b.TotalAmount > 0
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
                TotalCompletedBookings    = completedBookings,
                EligibleCompletedBookings = eligibleCompletedBookings,
                IsGoogleReviewPending     = user.LoyaltyReviewPendingAt.HasValue && !user.LoyaltyGoogleReviewActivatedAt.HasValue,
                IsGoogleReviewActivated   = user.LoyaltyGoogleReviewActivatedAt.HasValue,
                GoogleReviewActivatedAt   = user.LoyaltyGoogleReviewActivatedAt,
                Programs                  = programProgress,
                AvailableCoupons          = unlockedCoupons.Select(MapUserOffer).ToList(),
                PendingActivationCoupons  = pendingActivationCoupons.Select(MapUserOffer).ToList(),
                GoogleReviewUrl           = GoogleReviewUrl
            });
        }

        [Authorize]
        [HttpPost("loyalty/activate-google-review")]
        public async Task<ActionResult> ActivateGoogleReviewLoyalty(IFormFile? screenshot)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null) return Unauthorized();

            // Already fully approved — nothing to do.
            if (user.LoyaltyGoogleReviewActivatedAt.HasValue)
                return Ok(new
                {
                    message           = "Loyalty counter already activated.",
                    isPending         = false,
                    googleReviewUrl   = GoogleReviewUrl,
                });

            // Mark as pending admin approval (idempotent).
            var isNew = !user.LoyaltyReviewPendingAt.HasValue;
            user.LoyaltyReviewPendingAt ??= DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            // Save screenshot if provided
            if (screenshot != null && screenshot.Length > 0)
            {
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var extension = Path.GetExtension(screenshot.FileName)?.ToLowerInvariant() ?? "";
                if (!allowedExtensions.Contains(extension))
                    extension = ".jpg";

                var uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "loyalty-reviews");
                Directory.CreateDirectory(uploadsRoot);

                // Delete old screenshot if exists
                if (!string.IsNullOrWhiteSpace(user.LoyaltyReviewScreenshotUrl)
                    && user.LoyaltyReviewScreenshotUrl.StartsWith("/uploads/loyalty-reviews/", StringComparison.OrdinalIgnoreCase))
                {
                    var oldFileName = Path.GetFileName(user.LoyaltyReviewScreenshotUrl);
                    var oldPath = Path.Combine(uploadsRoot, oldFileName);
                    if (System.IO.File.Exists(oldPath))
                        System.IO.File.Delete(oldPath);
                }

                var fileName = $"review-{user.Id}-{Guid.NewGuid():N}{extension}";
                var filePath = Path.Combine(uploadsRoot, fileName);

                await using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await screenshot.CopyToAsync(stream);
                }

                user.LoyaltyReviewScreenshotUrl = $"/uploads/loyalty-reviews/{fileName}";
            }

            await _context.SaveChangesAsync();

            if (isNew)
            {
                await _audit.LogAsync(
                    action:     "LoyaltyReviewRequested",
                    userId:     user.Id,
                    userEmail:  user.Email,
                    entityType: "User",
                    entityId:   user.Id.ToString());
                await _notificationService.NotifyLoyaltyReviewRequestedAsync(user);
            }

            return Ok(new
            {
                message         = "Review submission received. An admin will verify and activate your loyalty counter shortly.",
                isPending       = true,
                googleReviewUrl = GoogleReviewUrl,
            });
        }

        // ── Admin: list pending review requests ──────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpGet("loyalty/pending-reviews")]
        public async Task<ActionResult<IEnumerable<PendingReviewDto>>> GetPendingReviews()
        {
            var pending = await _context.Users
                .Where(u => u.LoyaltyReviewPendingAt.HasValue && !u.LoyaltyGoogleReviewActivatedAt.HasValue && u.IsActive)
                .OrderBy(u => u.LoyaltyReviewPendingAt)
                .ToListAsync();

            var userIds = pending.Select(u => u.Id).ToList();

            var bookingCounts = await _context.Bookings
                .Where(b => b.UserId.HasValue && userIds.Contains(b.UserId.Value) && b.Status == BookingStatus.Completed)
                .GroupBy(b => b.UserId!.Value)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            var result = pending.Select(u => new PendingReviewDto
            {
                UserId           = u.Id,
                UserName         = $"{u.FirstName} {u.LastName}".Trim(),
                UserEmail        = u.Email,
                PendingAt        = u.LoyaltyReviewPendingAt!.Value,
                CompletedBookings = bookingCounts.TryGetValue(u.Id, out var c) ? c : 0,
                ScreenshotUrl    = u.LoyaltyReviewScreenshotUrl,
            });

            return Ok(result);
        }

        // ── Admin: approve a pending review ──────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPost("loyalty/{userId:int}/approve-review")]
        public async Task<IActionResult> ApproveGoogleReview(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            if (!user.LoyaltyReviewPendingAt.HasValue)
                return BadRequest(new { message = "No pending review request for this user." });

            user.LoyaltyGoogleReviewActivatedAt ??= DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var adminId = GetUserId();
            await _audit.LogAsync(
                action:     "LoyaltyReviewApproved",
                userId:     adminId,
                entityType: "User",
                entityId:   userId.ToString(),
                metadata:   new { approvedUserId = userId, userEmail = user.Email });

            return Ok(new { message = $"Loyalty counter activated for {user.Email}." });
        }

        // ── Admin: reject a pending review ───────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPost("loyalty/{userId:int}/reject-review")]
        public async Task<IActionResult> RejectGoogleReview(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            user.LoyaltyReviewPendingAt = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var adminId = GetUserId();
            await _audit.LogAsync(
                action:     "LoyaltyReviewRejected",
                userId:     adminId,
                entityType: "User",
                entityId:   userId.ToString(),
                metadata:   new { rejectedUserId = userId, userEmail = user.Email });

            return Ok(new { message = $"Review request rejected for {user.Email}." });
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

            var allBookings = await _context.Bookings
                .Where(b => b.UserId.HasValue && userIds.Contains(b.UserId.Value)
                            && b.Status == BookingStatus.Completed
                            && b.TotalAmount > 0)   // exclude free/loyalty-redeemed bookings
                .Select(b => new { UserId = b.UserId!.Value, b.WorkCompletedAt, b.UpdatedAt })
                .ToListAsync();

            // All-time count by user
            var completedBookingsByUser = allBookings
                .GroupBy(b => b.UserId)
                .ToDictionary(g => g.Key, g => g.Count());

            // Post-activation count by user (uses each user's LoyaltyGoogleReviewActivatedAt)
            var activationByUser = users.ToDictionary(
                u => u.Id,
                u => u.LoyaltyGoogleReviewActivatedAt);

            var eligibleBookingsByUser = allBookings
                .GroupBy(b => b.UserId)
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var activatedAt = activationByUser.TryGetValue(g.Key, out var a) ? a : null;
                        if (!activatedAt.HasValue) return 0;
                        return g.Count(b => (b.WorkCompletedAt ?? b.UpdatedAt) >= activatedAt.Value);
                    });

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
                EligibleBookingsCount = eligibleBookingsByUser.TryGetValue(u.Id, out var eligible) ? eligible : 0,
                AvailableCouponsCount = availableCouponsByUser.TryGetValue(u.Id, out var coupons) ? coupons : 0,
                MemberSince = u.CreatedAt,
                IsActivated = u.LoyaltyGoogleReviewActivatedAt.HasValue,
                ActivatedAt = u.LoyaltyGoogleReviewActivatedAt
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

            if (dto.DiscountType == DiscountType.Percentage && dto.DiscountValue > 100)
            {
                return BadRequest(new { message = "Percentage discount cannot exceed 100%." });
            }

            if (dto.IsLoyaltyProgram && (!dto.TriggerCompletedBookings.HasValue || dto.TriggerCompletedBookings <= 0))
            {
                return BadRequest(new { message = "Trigger completed bookings must be greater than zero for loyalty offers." });
            }

            var normalizedCode = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim().ToUpperInvariant();
            // Case-insensitive duplicate check (PostgreSQL text comparison is case-sensitive by default)
            if (!string.IsNullOrWhiteSpace(normalizedCode) &&
                await _context.Offers.AnyAsync(o => o.Code != null && o.Code.ToUpper() == normalizedCode))
            {
                return Conflict(new { message = "An offer with this code already exists." });
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
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException)
            {
                // Race condition: another request inserted the same code between our check and save.
                var codeConflict = normalizedCode != null &&
                    await _context.Offers.AnyAsync(o => o.Code != null && o.Code.ToUpper() == normalizedCode);
                return Conflict(new { message = codeConflict
                    ? "An offer with this code already exists."
                    : "Failed to save the offer due to a database conflict. Please try again." });
            }

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
                // Case-insensitive check excluding the offer being updated
                if (!string.IsNullOrWhiteSpace(normalizedCode) &&
                    await _context.Offers.AnyAsync(o => o.Id != id && o.Code != null && o.Code.ToUpper() == normalizedCode))
                {
                    return Conflict(new { message = "An offer with this code already exists." });
                }

                offer.Code = normalizedCode;
            }

            if (!offer.IsLoyaltyProgram && string.IsNullOrWhiteSpace(offer.Code))
            {
                return BadRequest(new { message = "Code is required for regular offers." });
            }

            if ((dto.DiscountType ?? offer.DiscountType) == DiscountType.Percentage
                && (dto.DiscountValue ?? offer.DiscountValue) > 100)
            {
                return BadRequest(new { message = "Percentage discount cannot exceed 100%." });
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

        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/assign-bulk")]
        public async Task<ActionResult> AssignOfferToMultipleUsers(int id, [FromBody] BulkAssignDto dto)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null)
                return NotFound(new { message = "Offer not found." });

            if (dto.UserIds == null || dto.UserIds.Count == 0)
                return BadRequest(new { message = "No users specified." });

            var userIds = dto.UserIds.Distinct().ToList();
            var existingUserIds = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            var assigned = new List<(int userId, string code)>();
            var skipped  = new List<int>();

            foreach (var userId in existingUserIds)
            {
                var personalCode = BuildPersonalCode(offer.Code, userId);
                var already = await _context.UserOffers.AnyAsync(uo => uo.PersonalCode == personalCode && !uo.IsRedeemed);
                if (already) { skipped.Add(userId); continue; }

                _context.UserOffers.Add(new UserOffer
                {
                    UserId = userId,
                    OfferId = offer.Id,
                    PersonalCode = personalCode,
                    AssignedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)),
                    IsRedeemed = false
                });
                assigned.Add((userId, personalCode));
            }
            await _context.SaveChangesAsync();

            foreach (var (userId, code) in assigned)
            {
                try { await _notificationService.NotifyOfferAssignedAsync(userId, offer, code); }
                catch { /* notification failure must not abort the bulk operation */ }
            }

            return Ok(new
            {
                message  = $"{assigned.Count} coupon(s) assigned, {skipped.Count} skipped (already have one).",
                assigned = assigned.Count,
                skipped  = skipped.Count
            });
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

