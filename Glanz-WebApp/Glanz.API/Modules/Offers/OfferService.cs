using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using Glanz.API.Services;
using Microsoft.AspNetCore.Http;

namespace Glanz.API.Modules.Offers
{
    public class OfferService : IOfferService
    {
        private const string GoogleReviewUrl = "https://www.google.com/search?q=Glanz+Qatar+Google+review";

        private readonly AppDbContext _context;
        private readonly IAdminNotificationService _notificationService;
        private readonly IAuditService _audit;
        private readonly IObjectStorageService _objectStorage;

        public OfferService(
            AppDbContext context,
            IAdminNotificationService notificationService,
            IAuditService audit,
            IObjectStorageService objectStorage)
        {
            _context             = context;
            _notificationService = notificationService;
            _audit               = audit;
            _objectStorage       = objectStorage;
        }

        public async Task<IEnumerable<OfferDto>> GetOffersAsync() =>
            (await _context.Offers.OrderByDescending(o => o.CreatedAt).ToListAsync())
            .Select(MapOfferStatic);

        public async Task<IEnumerable<UserOfferDto>> GetMyCouponsAsync(int userId)
        {
            var loyaltyActivationAt = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.LoyaltyGoogleReviewActivatedAt)
                .FirstOrDefaultAsync();

            var coupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .Where(uo => uo.UserId == userId
                    && !uo.IsRedeemed
                    && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow)
                    && (!uo.Offer.IsLoyaltyProgram
                        || (loyaltyActivationAt.HasValue && uo.AssignedAt >= loyaltyActivationAt.Value)))
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();

            return coupons.Select(MapUserOfferStatic);
        }

        public async Task<IEnumerable<UserOfferDto>> GetAllUserCouponsAsync()
        {
            var coupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();
            return coupons.Select(MapUserOfferStatic);
        }

        public async Task<(CustomerLoyaltyDto? Result, string? Error)> GetMyLoyaltyAsync(int userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return (null, "User not found.");

            var completedBookings = await _context.Bookings
                .CountAsync(b => b.UserId == userId && b.Status == BookingStatus.Completed && b.TotalAmount > 0);

            var eligibleCompletedBookings = user.LoyaltyGoogleReviewActivatedAt.HasValue
                ? await _context.Bookings.CountAsync(b =>
                    b.UserId == userId
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
                var trigger     = o.TriggerCompletedBookings!.Value;
                var completed   = 0;
                var bookingsToNext  = trigger;
                var progressPercent = 0m;

                if (user.LoyaltyGoogleReviewActivatedAt.HasValue)
                {
                    completed = eligibleCompletedBookings % trigger;
                    if (completed == 0 && eligibleCompletedBookings > 0)
                    {
                        completed = trigger; bookingsToNext = 0; progressPercent = 100;
                    }
                    else
                    {
                        bookingsToNext  = trigger - completed;
                        progressPercent = Math.Round((decimal)completed / trigger * 100, 0);
                    }
                }

                return new CustomerLoyaltyProgramProgressDto
                {
                    OfferId           = o.Id,
                    ProgramName       = o.Name,
                    Description       = o.Description,
                    TriggerBookings   = trigger,
                    CompletedBookings = completed,
                    BookingsToNext    = bookingsToNext,
                    ProgressPercent   = progressPercent
                };
            }).ToList();

            var availableCoupons = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .Where(uo => uo.UserId == userId && !uo.IsRedeemed
                    && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow))
                .OrderByDescending(uo => uo.AssignedAt)
                .ToListAsync();

            var unlockedCoupons = availableCoupons
                .Where(uo => !uo.Offer.IsLoyaltyProgram
                    || (user.LoyaltyGoogleReviewActivatedAt.HasValue && uo.AssignedAt >= user.LoyaltyGoogleReviewActivatedAt.Value))
                .ToList();

            return (new CustomerLoyaltyDto
            {
                TotalCompletedBookings    = completedBookings,
                EligibleCompletedBookings = eligibleCompletedBookings,
                IsGoogleReviewPending     = user.LoyaltyReviewPendingAt.HasValue && !user.LoyaltyGoogleReviewActivatedAt.HasValue,
                IsGoogleReviewActivated   = user.LoyaltyGoogleReviewActivatedAt.HasValue,
                GoogleReviewActivatedAt   = user.LoyaltyGoogleReviewActivatedAt,
                Programs                  = programProgress,
                AvailableCoupons          = unlockedCoupons.Select(MapUserOfferStatic).ToList(),
                PendingActivationCoupons  = new List<UserOfferDto>(),
                GoogleReviewUrl           = GoogleReviewUrl
            }, null);
        }

        public async Task<(string? Error, object? Data)> ActivateGoogleReviewLoyaltyAsync(int userId, IFormFile? screenshot)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return ("User not found.", null);

            if (user.LoyaltyGoogleReviewActivatedAt.HasValue)
                return (null, new { message = "Loyalty counter already activated.", isPending = false, googleReviewUrl = GoogleReviewUrl });

            var isNew = !user.LoyaltyReviewPendingAt.HasValue;
            user.LoyaltyReviewPendingAt ??= DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            if (screenshot != null && screenshot.Length > 0)
            {
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var extension = Path.GetExtension(screenshot.FileName)?.ToLowerInvariant() ?? "";
                if (!allowedExtensions.Contains(extension)) extension = ".jpg";

                await _objectStorage.DeleteAsync(user.LoyaltyReviewScreenshotUrl);
                var fileName = $"review-{user.Id}-{Guid.NewGuid():N}{extension}";
                var storedScreenshot = await _objectStorage.UploadAsync(screenshot, "loyalty-reviews", fileName);
                user.LoyaltyReviewScreenshotUrl = storedScreenshot.PublicUrl;
            }

            await _context.SaveChangesAsync();

            if (isNew)
            {
                await _audit.LogAsync(action: "LoyaltyReviewRequested", userId: user.Id, userEmail: user.Email, entityType: "User", entityId: user.Id.ToString());
                await _notificationService.NotifyLoyaltyReviewRequestedAsync(user);
            }

            return (null, new { message = "Review submission received. An admin will verify and activate your loyalty counter shortly.", isPending = true, googleReviewUrl = GoogleReviewUrl });
        }

        public async Task<IEnumerable<PendingReviewDto>> GetPendingReviewsAsync()
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

            return pending.Select(u => new PendingReviewDto
            {
                UserId            = u.Id,
                UserName          = $"{u.FirstName} {u.LastName}".Trim(),
                UserEmail         = u.Email,
                PendingAt         = u.LoyaltyReviewPendingAt!.Value,
                CompletedBookings = bookingCounts.TryGetValue(u.Id, out var c) ? c : 0,
                ScreenshotUrl     = u.LoyaltyReviewScreenshotUrl,
            });
        }

        public async Task<string?> ApproveGoogleReviewAsync(int userId, int? adminId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return "User not found.";
            if (!user.LoyaltyReviewPendingAt.HasValue) return "No pending review request for this user.";

            user.LoyaltyGoogleReviewActivatedAt ??= DateTime.UtcNow;
            user.LoyaltyReviewPendingAt = null;
            await _objectStorage.DeleteAsync(user.LoyaltyReviewScreenshotUrl);
            user.LoyaltyReviewScreenshotUrl = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _audit.LogAsync(action: "LoyaltyReviewApproved", userId: adminId, entityType: "User", entityId: userId.ToString(),
                metadata: new { approvedUserId = userId, userEmail = user.Email });
            return null;
        }

        public async Task<string?> RejectGoogleReviewAsync(int userId, int? adminId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return "User not found.";

            await _objectStorage.DeleteAsync(user.LoyaltyReviewScreenshotUrl);
            user.LoyaltyReviewPendingAt = null;
            user.LoyaltyReviewScreenshotUrl = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _audit.LogAsync(action: "LoyaltyReviewRejected", userId: adminId, entityType: "User", entityId: userId.ToString(),
                metadata: new { rejectedUserId = userId, userEmail = user.Email });
            return null;
        }

        public async Task<(UserOfferDto? Result, string? Error)> ActivateGoogleReviewRewardAsync(int couponId, int userId)
        {
            var coupon = await _context.UserOffers
                .Include(uo => uo.Offer)
                .Include(uo => uo.User)
                .FirstOrDefaultAsync(uo => uo.Id == couponId && uo.UserId == userId);

            if (coupon == null) return (null, "Reward not found.");
            if (coupon.IsRedeemed) return (null, "This reward has already been redeemed.");
            if (coupon.ExpiresAt.HasValue && coupon.ExpiresAt.Value < DateTime.UtcNow) return (null, "This reward has expired.");
            if (!coupon.Offer.IsLoyaltyProgram) return (null, "Only loyalty rewards require Google review activation.");

            coupon.GoogleReviewActivatedAt ??= DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (MapUserOfferStatic(coupon), null);
        }

        public async Task<IEnumerable<LoyaltyProgressDto>> GetLoyaltyProgressAsync()
        {
            var users = await _context.Users
                .Where(u => u.Role == "Customer" && u.IsActive)
                .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
                .ToListAsync();

            var userIds = users.Select(u => u.Id).ToList();

            var allBookings = await _context.Bookings
                .Where(b => b.UserId.HasValue && userIds.Contains(b.UserId.Value)
                    && b.Status == BookingStatus.Completed && b.TotalAmount > 0)
                .Select(b => new { UserId = b.UserId!.Value, b.WorkCompletedAt, b.UpdatedAt })
                .ToListAsync();

            var completedBookingsByUser = allBookings.GroupBy(b => b.UserId).ToDictionary(g => g.Key, g => g.Count());
            var activationByUser        = users.ToDictionary(u => u.Id, u => u.LoyaltyGoogleReviewActivatedAt);

            var eligibleBookingsByUser  = allBookings.GroupBy(b => b.UserId).ToDictionary(
                g => g.Key,
                g =>
                {
                    var activatedAt = activationByUser.TryGetValue(g.Key, out var a) ? a : null;
                    if (!activatedAt.HasValue) return 0;
                    return g.Count(b => (b.WorkCompletedAt ?? b.UpdatedAt) >= activatedAt.Value);
                });

            var availableCouponsByUser = await _context.UserOffers
                .Where(uo => userIds.Contains(uo.UserId) && !uo.IsRedeemed && (!uo.ExpiresAt.HasValue || uo.ExpiresAt >= DateTime.UtcNow))
                .GroupBy(uo => uo.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count);

            return users.Select(u => new LoyaltyProgressDto
            {
                UserId                 = u.Id,
                UserName               = $"{u.FirstName} {u.LastName}".Trim(),
                UserEmail              = u.Email,
                CompletedBookingsCount = completedBookingsByUser.TryGetValue(u.Id, out var c) ? c : 0,
                EligibleBookingsCount  = eligibleBookingsByUser.TryGetValue(u.Id, out var e) ? e : 0,
                AvailableCouponsCount  = availableCouponsByUser.TryGetValue(u.Id, out var cp) ? cp : 0,
                MemberSince            = u.CreatedAt,
                IsActivated            = u.LoyaltyGoogleReviewActivatedAt.HasValue,
                ActivatedAt            = u.LoyaltyGoogleReviewActivatedAt
            });
        }

        public async Task<(OfferDto? Result, string? Error, int StatusCode)> CreateOfferAsync(CreateOfferDto dto)
        {
            if (!dto.IsLoyaltyProgram && string.IsNullOrWhiteSpace(dto.Code))
                return (null, "Code is required for regular offers.", 400);
            if (dto.DiscountType == DiscountType.Percentage && dto.DiscountValue > 100)
                return (null, "Percentage discount cannot exceed 100%.", 400);
            if (dto.IsLoyaltyProgram && (!dto.TriggerCompletedBookings.HasValue || dto.TriggerCompletedBookings <= 0))
                return (null, "Trigger completed bookings must be greater than zero for loyalty offers.", 400);

            var normalizedCode = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim().ToUpperInvariant();
            if (!string.IsNullOrWhiteSpace(normalizedCode) &&
                await _context.Offers.AnyAsync(o => o.Code != null && o.Code.ToUpper() == normalizedCode))
                return (null, "An offer with this code already exists.", 409);

            var offer = new Offer
            {
                Name                     = dto.Name.Trim(),
                Code                     = normalizedCode,
                Description              = dto.Description?.Trim(),
                DiscountType             = dto.DiscountType,
                DiscountValue            = dto.DiscountValue,
                MinBookingAmount         = dto.MinBookingAmount,
                IsLoyaltyProgram         = dto.IsLoyaltyProgram,
                TriggerCompletedBookings = dto.IsLoyaltyProgram ? dto.TriggerCompletedBookings : null,
                CouponValidityDays       = dto.CouponValidityDays,
                MaxUsesPerUser           = dto.MaxUsesPerUser,
                StartsAt                 = dto.StartsAt,
                EndsAt                   = dto.EndsAt,
                IsActive                 = dto.IsActive,
                CreatedAt                = DateTime.UtcNow,
                UpdatedAt                = DateTime.UtcNow
            };

            _context.Offers.Add(offer);
            try { await _context.SaveChangesAsync(); }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException)
            {
                var codeConflict = normalizedCode != null &&
                    await _context.Offers.AnyAsync(o => o.Code != null && o.Code.ToUpper() == normalizedCode);
                return (null, codeConflict
                    ? "An offer with this code already exists."
                    : "Failed to save the offer due to a database conflict. Please try again.", 409);
            }

            return (MapOfferStatic(offer), null, 201);
        }

        public async Task<(string? Error, int StatusCode)> UpdateOfferAsync(int id, UpdateOfferDto dto)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null) return ("Offer not found.", 404);

            if (dto.Name != null)                     offer.Name = dto.Name.Trim();
            if (dto.Description != null)              offer.Description = dto.Description.Trim();
            if (dto.DiscountType.HasValue)            offer.DiscountType = dto.DiscountType.Value;
            if (dto.DiscountValue.HasValue)           offer.DiscountValue = dto.DiscountValue.Value;
            if (dto.MinBookingAmount.HasValue)        offer.MinBookingAmount = dto.MinBookingAmount.Value;
            if (dto.IsLoyaltyProgram.HasValue)        offer.IsLoyaltyProgram = dto.IsLoyaltyProgram.Value;
            if (dto.TriggerCompletedBookings.HasValue) offer.TriggerCompletedBookings = dto.TriggerCompletedBookings.Value;
            if (dto.CouponValidityDays.HasValue)      offer.CouponValidityDays = dto.CouponValidityDays.Value;
            if (dto.MaxUsesPerUser.HasValue)          offer.MaxUsesPerUser = dto.MaxUsesPerUser.Value;
            if (dto.StartsAt.HasValue || dto.StartsAt == null) offer.StartsAt = dto.StartsAt;
            if (dto.EndsAt.HasValue || dto.EndsAt == null)     offer.EndsAt = dto.EndsAt;
            if (dto.IsActive.HasValue)                offer.IsActive = dto.IsActive.Value;

            if (dto.Code != null)
            {
                var normalizedCode = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim().ToUpperInvariant();
                if (!string.IsNullOrWhiteSpace(normalizedCode) &&
                    await _context.Offers.AnyAsync(o => o.Id != id && o.Code != null && o.Code.ToUpper() == normalizedCode))
                    return ("An offer with this code already exists.", 409);
                offer.Code = normalizedCode;
            }

            if (!offer.IsLoyaltyProgram && string.IsNullOrWhiteSpace(offer.Code))
                return ("Code is required for regular offers.", 400);
            if ((dto.DiscountType ?? offer.DiscountType) == DiscountType.Percentage && (dto.DiscountValue ?? offer.DiscountValue) > 100)
                return ("Percentage discount cannot exceed 100%.", 400);
            if (offer.IsLoyaltyProgram && (!offer.TriggerCompletedBookings.HasValue || offer.TriggerCompletedBookings <= 0))
                return ("Trigger completed bookings must be greater than zero for loyalty offers.", 400);

            offer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (null, 200);
        }

        public async Task<string?> DeleteOfferAsync(int id)
        {
            var offer = await _context.Offers.FindAsync(id);
            if (offer == null) return "Offer not found.";
            offer.IsActive  = false;
            offer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        public async Task<(string? Error, string? Code)> AssignOfferToUserAsync(int offerId, int userId)
        {
            var offer = await _context.Offers.FindAsync(offerId);
            if (offer == null) return ("Offer not found.", null);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return ("User not found.", null);

            var personalCode = BuildPersonalCode(offer.Code, userId);
            if (await _context.UserOffers.AnyAsync(uo => uo.PersonalCode == personalCode && !uo.IsRedeemed))
                return ("An active coupon with this code already exists for the user.", null);

            _context.UserOffers.Add(new UserOffer
            {
                UserId       = userId,
                OfferId      = offer.Id,
                PersonalCode = personalCode,
                AssignedAt   = DateTime.UtcNow,
                ExpiresAt    = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)),
                IsRedeemed   = false
            });
            await _context.SaveChangesAsync();
            await _notificationService.NotifyOfferAssignedAsync(userId, offer, personalCode);
            return (null, personalCode);
        }

        public async Task<(string? Error, int Assigned, int Skipped)> AssignOfferBulkAsync(int offerId, BulkAssignDto dto)
        {
            var offer = await _context.Offers.FindAsync(offerId);
            if (offer == null) return ("Offer not found.", 0, 0);
            if (dto.UserIds == null || dto.UserIds.Count == 0) return ("No users specified.", 0, 0);

            var userIds = dto.UserIds.Distinct().ToList();
            var existingUserIds = await _context.Users.Where(u => userIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();

            var assigned = new List<(int userId, string code)>();
            var skipped  = new List<int>();

            foreach (var userId in existingUserIds)
            {
                var personalCode = BuildPersonalCode(offer.Code, userId);
                if (await _context.UserOffers.AnyAsync(uo => uo.PersonalCode == personalCode && !uo.IsRedeemed))
                { skipped.Add(userId); continue; }

                _context.UserOffers.Add(new UserOffer
                {
                    UserId = userId, OfferId = offer.Id, PersonalCode = personalCode,
                    AssignedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(Math.Max(1, offer.CouponValidityDays)), IsRedeemed = false
                });
                assigned.Add((userId, personalCode));
            }
            await _context.SaveChangesAsync();

            foreach (var (uid, code) in assigned)
            {
                try { await _notificationService.NotifyOfferAssignedAsync(uid, offer, code); }
                catch { /* notification failure must not abort bulk */ }
            }
            return (null, assigned.Count, skipped.Count);
        }

        // ── Static mappers (also used externally via the interface default) ────────

        public static OfferDto MapOfferStatic(Offer o) => new OfferDto
        {
            Id                       = o.Id,
            Name                     = o.Name,
            Code                     = o.Code,
            Description              = o.Description,
            DiscountType             = o.DiscountType,
            DiscountValue            = o.DiscountValue,
            MinBookingAmount         = o.MinBookingAmount,
            IsLoyaltyProgram         = o.IsLoyaltyProgram,
            TriggerCompletedBookings = o.TriggerCompletedBookings,
            CouponValidityDays       = o.CouponValidityDays,
            MaxUsesPerUser           = o.MaxUsesPerUser,
            StartsAt                 = o.StartsAt,
            EndsAt                   = o.EndsAt,
            IsActive                 = o.IsActive,
            CreatedAt                = o.CreatedAt
        };

        public static UserOfferDto MapUserOfferStatic(UserOffer uo) => new UserOfferDto
        {
            Id                              = uo.Id,
            UserId                          = uo.UserId,
            UserName                        = $"{uo.User.FirstName} {uo.User.LastName}".Trim(),
            UserEmail                       = uo.User.Email,
            OfferId                         = uo.OfferId,
            OfferName                       = uo.Offer.Name,
            PersonalCode                    = uo.PersonalCode,
            IsRedeemed                      = uo.IsRedeemed,
            AssignedAt                      = uo.AssignedAt,
            ExpiresAt                       = uo.ExpiresAt,
            RedeemedAt                      = uo.RedeemedAt,
            EarnedAtCompletedBookingsCount  = uo.EarnedAtCompletedBookingsCount,
            RequiresGoogleReviewActivation  = uo.Offer.IsLoyaltyProgram,
            IsActivationLocked              = uo.Offer.IsLoyaltyProgram && !uo.User.LoyaltyGoogleReviewActivatedAt.HasValue,
            GoogleReviewActivatedAt         = uo.User.LoyaltyGoogleReviewActivatedAt
        };

        private static string BuildPersonalCode(string? baseCode, int userId)
        {
            var prefix = string.IsNullOrWhiteSpace(baseCode) ? "LOYAL" : baseCode.Trim().ToUpperInvariant();
            return $"{prefix}-U{userId}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        }
    }
}
