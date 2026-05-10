using Glanz.API.Data;
using Glanz.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Glanz.API.Services
{
    public interface IReferralService
    {
        Task CheckAndRewardReferralAsync(int bookingId, int userId);
        Task<(decimal? DiscountPercent, string? Error)> GetReferralDiscountForUserAsync(int userId);
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

            // Check how many completed bookings the referred user has - only then does referrer get reward
            var completedBookingsCount = await _context.Bookings
                .CountAsync(b => b.UserId == userId 
                    && b.Status == BookingStatus.Completed 
                    && b.TotalAmount > 0 
                    && b.WorkCompletedAt.HasValue);

            // Get required bookings threshold from system settings (default: 1)
            var requiredBookings = await GetRequiredBookingsForRewardAsync();
            if (completedBookingsCount >= requiredBookings)
            {
                var referralRewardAmount = await GetReferralRewardAmountAsync();
                var referrer = await _context.Users.FindAsync(referral.ReferrerId);
                if (referrer != null)
                {
                    referrer.ReferralPoints += referralRewardAmount;
                    referral.RewardAmount = referralRewardAmount;
                    referral.Status = ReferralStatus.Rewarded;
                    referral.RewardedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
        }

        public async Task<(decimal? DiscountPercent, string? Error)> GetReferralDiscountForUserAsync(int userId)
        {
            // Only give discount on first booking (when status is Pending - hasn't made any booking yet)
            var referral = await _context.Referrals
                .FirstOrDefaultAsync(r => r.ReferredUserId == userId 
                    && r.Status == ReferralStatus.Pending);

            if (referral == null)
            {
                return (null, null); // Not a referred user or already used discount
            }

            // Get discount percentage from system settings
            var discountPercent = await GetReferralDiscountPercentAsync();

            if (discountPercent <= 0)
            {
                return (null, null); // No discount configured
            }

            return (discountPercent, null);
        }

        private async Task<decimal> GetReferralRewardAmountAsync()
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "referral.rewardAmount");

            if (setting != null && int.TryParse(setting.Value, out int rewardAmount) && rewardAmount >= 0)
            {
                return rewardAmount;
            }

            return 50m;
        }

        private async Task<decimal> GetReferralDiscountPercentAsync()
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "referral.discountPercent");

            if (setting != null && decimal.TryParse(setting.Value, out decimal discountPercent) && discountPercent >= 0)
            {
                return discountPercent;
            }

            return 0m;
        }

        private async Task<int> GetRequiredBookingsForRewardAsync()
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "referral.requiredBookingsForReward");

            if (setting != null && int.TryParse(setting.Value, out int required) && required > 0)
            {
                return required;
            }

            return 1; // Default: referrer gets reward after referred user's first completed booking
        }
    }
}