using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Glanz.API.Data;
using Glanz.API.DTOs;
using Glanz.API.Models;
using System.Security.Claims;

namespace Glanz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReferralController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReferralController(AppDbContext context)
        {
            _context = context;
        }

        private async Task<decimal> GetReferralRewardAmountAsync()
        {
            // Try to get the reward amount from system settings
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "referral.rewardAmount");
            
            if (setting != null && int.TryParse(setting.Value, out int rewardAmount) && rewardAmount >= 0)
            {
                return rewardAmount;
            }
            
            // Default fallback if not set
            return 50m;
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

        [HttpGet("my-referrals")]
        public async Task<ActionResult<MyReferralsDto>> GetMyReferrals()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // Generate code if doesn't exist
            if (string.IsNullOrEmpty(user.ReferralCode))
            {
                user.ReferralCode = GenerateReferralCode(user.FirstName);
                await _context.SaveChangesAsync();
            }

            var referrals = await _context.Referrals
                .Where(r => r.ReferrerId == userId)
                .Include(r => r.ReferredUser)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(new MyReferralsDto
            {
                ReferralCode = user.ReferralCode,
                ReferralPoints = user.ReferralPoints,
                TotalReferrals = referrals.Count,
                PendingReferrals = referrals.Count(r => r.Status == ReferralStatus.Pending),
                RewardedReferrals = referrals.Count(r => r.Status == ReferralStatus.Rewarded),
                // Unlocked if they have FirstWashCompletedAt OR they've ever completed a booking (TotalBookingsCount > 0)
                ReferralCodeUnlocked = user.FirstWashCompletedAt.HasValue || user.TotalBookingsCount > 0,
                Referrals = referrals.Select(r => new ReferralDto
                {
                    Id = r.Id,
                    ReferrerId = r.ReferrerId,
                    ReferredUserId = r.ReferredUserId,
                    ReferredUserName = r.ReferredUser.FirstName + " " + r.ReferredUser.LastName,
                    ReferredUserPhone = r.ReferredUser.Phone,
                    Status = r.Status.ToString(),
                    CreatedAt = r.CreatedAt,
                    FirstBookingAt = r.FirstBookingAt,
                    RewardAmount = r.RewardAmount,
                    RewardedAt = r.RewardedAt
                }).ToList()
            });
        }

        [HttpGet("code")]
        public async Task<ActionResult<GenerateCodeResultDto>> GetMyCode()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(user.ReferralCode))
            {
                user.ReferralCode = GenerateReferralCode(user.FirstName);
                await _context.SaveChangesAsync();
            }

            return Ok(new GenerateCodeResultDto { ReferralCode = user.ReferralCode });
        }

        [HttpPost("apply")]
        public async Task<ActionResult> ApplyReferralCode([FromBody] ApplyReferralDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // Can't use own code
            if (user.ReferralCode?.ToUpper() == dto.ReferralCode.ToUpper())
                return BadRequest(new { message = "You cannot use your own referral code" });

            // Already referred?
            if (user.ReferredByUserId != null)
                return BadRequest(new { message = "You already used a referral code" });

            // Find referrer
            var referrer = await _context.Users
                .FirstOrDefaultAsync(u => u.ReferralCode != null && u.ReferralCode.ToUpper() == dto.ReferralCode.ToUpper());

            if (referrer == null)
                return BadRequest(new { message = "Invalid referral code" });

            // Create referral record
            var referral = new Referral
            {
                ReferrerId = referrer.Id,
                ReferredUserId = userId.Value,
                Status = ReferralStatus.Pending
            };

            user.ReferredByUserId = referrer.Id;
            _context.Referrals.Add(referral);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Referral code applied! You'll get a discount on your first booking." });
        }

        [HttpGet("validate/{code}")]
        public async Task<ActionResult> ValidateReferralCode(string code)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var currentUser = await _context.Users.FindAsync(userId);
            if (currentUser == null) return NotFound();

            // Can't use own code
            if (currentUser.ReferralCode?.ToUpper() == code.ToUpper())
                return Ok(new { valid = false, message = "You cannot use your own code" });

            var referrer = await _context.Users
                .FirstOrDefaultAsync(u => u.ReferralCode != null && u.ReferralCode.ToUpper() == code.ToUpper());

            if (referrer == null)
                return Ok(new { valid = false, message = "Invalid code" });

            return Ok(new { 
                valid = true, 
                referrerName = referrer.FirstName + " " + referrer.LastName,
                message = $"Referred by {referrer.FirstName}" 
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<ReferralDto>>> GetAllReferrals([FromQuery] string? status)
        {
            var query = _context.Referrals
                .Include(r => r.Referrer)
                .Include(r => r.ReferredUser)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status) && Enum.TryParse<ReferralStatus>(status, true, out var s))
            {
                query = query.Where(r => r.Status == s);
            }

            var referrals = await query
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ReferralDto
                {
                    Id = r.Id,
                    ReferrerId = r.ReferrerId,
                    ReferrerName = r.Referrer.FirstName + " " + r.Referrer.LastName,
                    ReferrerPhone = r.Referrer.Phone,
                    ReferredUserId = r.ReferredUserId,
                    ReferredUserName = r.ReferredUser.FirstName + " " + r.ReferredUser.LastName,
                    ReferredUserPhone = r.ReferredUser.Phone,
                    Status = r.Status.ToString(),
                    CreatedAt = r.CreatedAt,
                    FirstBookingAt = r.FirstBookingAt,
                    RewardAmount = r.RewardAmount,
                    RewardedAt = r.RewardedAt
                })
                .ToListAsync();

            return Ok(referrals);
        }

        // Called when a booking is completed - check and reward referrals
        public async Task CheckAndRewardReferral(int bookingId, int userId)
        {
            var referral = await _context.Referrals
                .FirstOrDefaultAsync(r => r.ReferredUserId == userId && r.Status == ReferralStatus.Pending);

            if (referral == null) return;

            // Mark first booking
            referral.FirstBookingAt = DateTime.UtcNow;
            referral.Status = ReferralStatus.Active;
            referral.RewardedBookingId = bookingId;

            // Give referrer their reward (using configurable amount)
            var referralRewardAmount = await GetReferralRewardAmountAsync();
            var referrer = await _context.Users.FindAsync(referral.ReferrerId);
            if (referrer != null)
            {
                referrer.ReferralPoints += referralRewardAmount;
                referral.RewardAmount = referralRewardAmount;
                referral.Status = ReferralStatus.Rewarded;
                referral.RewardedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        private string GenerateReferralCode(string firstName)
        {
            var cleanName = new string(firstName.Where(char.IsLetter).ToArray()).ToUpper();
            var random = Guid.NewGuid().ToString("N").Substring(0, 4).ToUpper();
            return cleanName + random;
        }
    }
}