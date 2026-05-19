using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;

namespace Flowly.API.Services
{
    // ── DTOs ─────────────────────────────────────────────────────────────────────

    public record PackagePricingItem(int PackageId, decimal BasePrice, int Quantity);

    public record PricingResult(
        decimal BaseAmount,
        decimal VehicleMultiplier,
        decimal SubtotalBeforeDiscounts,
        decimal SubscriptionDiscountPercent,
        decimal SubscriptionDiscountAmount,
        decimal SubtotalAfterSubscription,
        decimal OfferDiscountAmount,
        decimal TotalDiscountAmount,
        decimal FinalAmount,
        string? AppliedOfferCode
    );

    // ── Interface ─────────────────────────────────────────────────────────────────

    public interface IPricingService
    {
        /// <summary>
        /// Returns vehicle type → multiplier map.
        /// Reads from SystemSettings key "pricing.vehicleMultipliers" (JSON object).
        /// Falls back to the same hardcoded defaults if the key is absent.
        /// </summary>
        Task<IReadOnlyDictionary<VehicleType, decimal>> GetVehicleMultipliersAsync();

        /// <summary>
        /// Single source of truth for booking price calculation.
        /// All pricing decisions (multiplier, subscription discount, offer discount) happen here.
        /// Frontend totals are NEVER used.
        /// </summary>
        Task<PricingResult> CalculateAsync(
            IReadOnlyList<PackagePricingItem> items,
            VehicleType vehicleType,
            decimal subscriptionDiscountPercent,
            Offer? applicableOffer,
            string? applicableOfferCode);
    }

    // ── Implementation ────────────────────────────────────────────────────────────

    public sealed class PricingService : IPricingService
    {
        private const string MultipliersSettingKey = "pricing.vehicleMultipliers";

        // Industry defaults — only used when admin has not configured overrides.
        private static readonly IReadOnlyDictionary<VehicleType, decimal> _defaultMultipliers =
            new Dictionary<VehicleType, decimal>
            {
                [VehicleType.Motorcycle] = 0.8m,
                [VehicleType.Sedan]      = 1.0m,
                [VehicleType.SUV]        = 1.25m,
                [VehicleType.Pickup]     = 1.5m,
            };

        private static readonly JsonSerializerOptions _jsonOpts = AppJsonOptions.CaseInsensitive;

        private readonly AppDbContext _context;

        public PricingService(AppDbContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<IReadOnlyDictionary<VehicleType, decimal>> GetVehicleMultipliersAsync()
        {
            var setting = await _context.SystemSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == MultipliersSettingKey);

            if (setting == null || string.IsNullOrWhiteSpace(setting.Value))
                return _defaultMultipliers;

            try
            {
                // Value stored as: {"Motorcycle":0.8,"Sedan":1.0,"SUV":1.25,"Pickup":1.5}
                var raw = JsonSerializer.Deserialize<Dictionary<string, decimal>>(setting.Value, _jsonOpts);
                if (raw == null || raw.Count == 0) return _defaultMultipliers;

                var result = new Dictionary<VehicleType, decimal>();
                foreach (var (key, value) in raw)
                {
                    if (Enum.TryParse<VehicleType>(key, ignoreCase: true, out var vt))
                        result[vt] = value;
                }

                // Require at least the four known types before using the DB value.
                var hasAll = result.ContainsKey(VehicleType.Motorcycle)
                          && result.ContainsKey(VehicleType.Sedan)
                          && result.ContainsKey(VehicleType.SUV)
                          && result.ContainsKey(VehicleType.Pickup);

                return hasAll ? result : _defaultMultipliers;
            }
            catch
            {
                return _defaultMultipliers;
            }
        }

        /// <inheritdoc/>
        public async Task<PricingResult> CalculateAsync(
            IReadOnlyList<PackagePricingItem> items,
            VehicleType vehicleType,
            decimal subscriptionDiscountPercent,
            Offer? applicableOffer,
            string? applicableOfferCode)
        {
            var multipliers    = await GetVehicleMultipliersAsync();
            var vehicleMultiplier = multipliers.TryGetValue(vehicleType, out var m) ? m : 1.0m;

            // 1. Base subtotal — sum of (price × multiplier × qty)
            decimal baseAmount = 0;
            foreach (var item in items)
                baseAmount += Math.Round(item.BasePrice * vehicleMultiplier, 2) * item.Quantity;

            var subtotalBeforeDiscounts = baseAmount;

            // 2. Subscription discount — applied first, on the full subtotal
            var subDiscountAmt = subscriptionDiscountPercent > 0
                ? Math.Round(baseAmount * (subscriptionDiscountPercent / 100m), 2)
                : 0m;
            var subtotalAfterSubscription = Math.Max(0, baseAmount - subDiscountAmt);

            // 3. Offer discount — applied on the post-subscription subtotal
            var offerDiscountAmt = applicableOffer != null
                ? CalculateOfferDiscount(applicableOffer, subtotalAfterSubscription)
                : 0m;

            var totalDiscountAmt = subDiscountAmt + offerDiscountAmt;
            var finalAmount      = Math.Max(0, subtotalAfterSubscription - offerDiscountAmt);

            return new PricingResult(
                BaseAmount:                  baseAmount,
                VehicleMultiplier:           vehicleMultiplier,
                SubtotalBeforeDiscounts:     subtotalBeforeDiscounts,
                SubscriptionDiscountPercent: subscriptionDiscountPercent,
                SubscriptionDiscountAmount:  subDiscountAmt,
                SubtotalAfterSubscription:   subtotalAfterSubscription,
                OfferDiscountAmount:         offerDiscountAmt,
                TotalDiscountAmount:         totalDiscountAmt,
                FinalAmount:                 finalAmount,
                AppliedOfferCode:            applicableOffer != null ? applicableOfferCode : null
            );
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static decimal CalculateOfferDiscount(Offer offer, decimal subtotal)
        {
            if (subtotal <= 0) return 0;
            return offer.DiscountType switch
            {
                DiscountType.Percentage  => Math.Round(subtotal * (offer.DiscountValue / 100m), 2),
                DiscountType.FixedAmount => Math.Round(Math.Min(offer.DiscountValue, subtotal), 2),
                DiscountType.FreeBooking => Math.Round(subtotal, 2),
                _                        => 0
            };
        }
    }
}
