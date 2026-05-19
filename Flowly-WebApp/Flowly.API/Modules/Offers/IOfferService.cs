using Flowly.API.DTOs;
using Flowly.API.Models;
using Microsoft.AspNetCore.Http;

namespace Flowly.API.Modules.Offers
{
    public interface IOfferService
    {
        Task<IEnumerable<OfferDto>> GetOffersAsync();
        Task<IEnumerable<UserOfferDto>> GetMyCouponsAsync(int userId);
        Task<IEnumerable<UserOfferDto>> GetAllUserCouponsAsync();
        Task<(CustomerLoyaltyDto? Result, string? Error)> GetMyLoyaltyAsync(int userId);
        Task<(string? Error, object? Data)> ActivateGoogleReviewLoyaltyAsync(int userId, IFormFile? screenshot);
        Task<IEnumerable<PendingReviewDto>> GetPendingReviewsAsync();
        Task<string?> ApproveGoogleReviewAsync(int userId, int? adminId);
        Task<string?> RejectGoogleReviewAsync(int userId, int? adminId);
        Task<(UserOfferDto? Result, string? Error)> ActivateGoogleReviewRewardAsync(int couponId, int userId);
        Task<IEnumerable<LoyaltyProgressDto>> GetLoyaltyProgressAsync();
        Task<(OfferDto? Result, string? Error, int StatusCode)> CreateOfferAsync(CreateOfferDto dto);
        Task<(string? Error, int StatusCode)> UpdateOfferAsync(int id, UpdateOfferDto dto);
        Task<string?> DeleteOfferAsync(int id);
        Task<(string? Error, string? Code)> AssignOfferToUserAsync(int offerId, int userId);
        Task<(string? Error, int Assigned, int Skipped)> AssignOfferBulkAsync(int offerId, BulkAssignDto dto);

    }
}
