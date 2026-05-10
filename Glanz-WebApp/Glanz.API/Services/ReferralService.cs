using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Glanz.API.Services
{
    public interface IReferralService
    {
        Task CheckAndRewardReferralAsync(int bookingId, int userId);
    }

    public class ReferralService : IReferralService
    {
        private readonly AppDbContext _context;

        public ReferralService(AppDbContext context)
        {
            _context = context;
        }

        public async Task CheckAndRewardReferralAsync(int bookingId, int userId)
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
    }
}