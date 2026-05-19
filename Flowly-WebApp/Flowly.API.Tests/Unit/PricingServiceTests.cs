using Microsoft.EntityFrameworkCore;
using Flowly.API.Data;
using Flowly.API.Models;
using Flowly.API.Services;
using Xunit;

namespace Flowly.API.Tests.Unit
{
    public class PricingServiceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly PricingService _service;

        public PricingServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new PricingService(_context);
        }

        public void Dispose() => _context.Dispose();

        private static PackagePricingItem Item(decimal basePrice, int qty = 1) =>
            new(PackageId: 1, BasePrice: basePrice, Quantity: qty);

        // 1. Base price — Sedan (1.0×) with no discounts
        [Fact]
        public async Task Sedan_NoDiscount_ReturnsFlatBaseAmount()
        {
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.Sedan, 0, null, null);

            Assert.Equal(100m, result.BaseAmount);
            Assert.Equal(1.0m, result.VehicleMultiplier);
            Assert.Equal(100m, result.FinalAmount);
            Assert.Equal(0m,   result.TotalDiscountAmount);
        }

        // 2. SUV multiplier (1.25×)
        [Fact]
        public async Task Suv_Multiplier_AppliesCorrectly()
        {
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.SUV, 0, null, null);

            Assert.Equal(1.25m, result.VehicleMultiplier);
            Assert.Equal(125m,  result.BaseAmount);
            Assert.Equal(125m,  result.FinalAmount);
        }

        // 3. Motorcycle multiplier (0.8×)
        [Fact]
        public async Task Motorcycle_Multiplier_AppliesCorrectly()
        {
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.Motorcycle, 0, null, null);

            Assert.Equal(0.8m, result.VehicleMultiplier);
            Assert.Equal(80m,  result.FinalAmount);
        }

        // 4. Subscription 20% discount applied before offer
        [Fact]
        public async Task Subscription_20Percent_Reduces_Subtotal()
        {
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.Sedan, 20m, null, null);

            Assert.Equal(100m,  result.BaseAmount);
            Assert.Equal(20m,   result.SubscriptionDiscountAmount);
            Assert.Equal(80m,   result.SubtotalAfterSubscription);
            Assert.Equal(80m,   result.FinalAmount);
        }

        // 5. Percentage offer (10%) applied on post-subscription subtotal
        [Fact]
        public async Task PercentageOffer_AppliedAfterSubscriptionDiscount()
        {
            var offer = new Offer { DiscountType = DiscountType.Percentage, DiscountValue = 10m };
            // Subscription reduces 100 → 80; offer takes 10% of 80 = 8
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.Sedan, 20m, offer, "PROMO10");

            Assert.Equal(80m,      result.SubtotalAfterSubscription);
            Assert.Equal(8m,       result.OfferDiscountAmount);
            Assert.Equal(72m,      result.FinalAmount);
            Assert.Equal("PROMO10", result.AppliedOfferCode);
        }

        // 6. Fixed amount offer (QAR 50)
        [Fact]
        public async Task FixedAmountOffer_DeductsCorrectly()
        {
            var offer = new Offer { DiscountType = DiscountType.FixedAmount, DiscountValue = 50m };
            var result = await _service.CalculateAsync(
                [Item(200m)], VehicleType.Sedan, 0, offer, "FLAT50");

            Assert.Equal(200m, result.BaseAmount);
            Assert.Equal(50m,  result.OfferDiscountAmount);
            Assert.Equal(150m, result.FinalAmount);
        }

        // 7. Fixed offer capped at subtotal (does not produce negative total)
        [Fact]
        public async Task FixedAmountOffer_CappedAtSubtotal()
        {
            var offer = new Offer { DiscountType = DiscountType.FixedAmount, DiscountValue = 999m };
            var result = await _service.CalculateAsync(
                [Item(50m)], VehicleType.Sedan, 0, offer, null);

            Assert.Equal(50m, result.OfferDiscountAmount);
            Assert.Equal(0m,  result.FinalAmount);
        }

        // 8. FreeBooking offer (100% off)
        [Fact]
        public async Task FreeBookingOffer_ZerosFinalAmount()
        {
            var offer = new Offer { DiscountType = DiscountType.FreeBooking, DiscountValue = 0m };
            var result = await _service.CalculateAsync(
                [Item(200m)], VehicleType.Sedan, 0, offer, "FREEWASH");

            Assert.Equal(200m, result.OfferDiscountAmount);
            Assert.Equal(0m,   result.FinalAmount);
        }

        // 9. Stacked: 20% subscription + 10% percentage offer on SUV
        [Fact]
        public async Task Stacked_SubscriptionAndOffer_AppliedSequentially()
        {
            var offer = new Offer { DiscountType = DiscountType.Percentage, DiscountValue = 10m };
            // Base: 100 × 1.25 = 125
            // Subscription 20%: 125 - 25 = 100
            // Offer 10%: 100 - 10 = 90
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.SUV, 20m, offer, "VIP");

            Assert.Equal(125m, result.BaseAmount);
            Assert.Equal(25m,  result.SubscriptionDiscountAmount);
            Assert.Equal(100m, result.SubtotalAfterSubscription);
            Assert.Equal(10m,  result.OfferDiscountAmount);
            Assert.Equal(90m,  result.FinalAmount);
        }

        // 10. Multiple items with quantities
        [Fact]
        public async Task MultipleItems_SummedCorrectly()
        {
            var items = new List<PackagePricingItem>
            {
                new(1, 50m, 2),   // 50 × 1.0 × 2 = 100
                new(2, 30m, 3),   // 30 × 1.0 × 3 = 90
            };
            var result = await _service.CalculateAsync(
                items, VehicleType.Sedan, 0, null, null);

            Assert.Equal(190m, result.BaseAmount);
            Assert.Equal(190m, result.FinalAmount);
        }

        // 11. Custom DB multiplier overrides default
        [Fact]
        public async Task CustomDbMultiplier_OverridesDefault()
        {
            _context.SystemSettings.Add(new SystemSetting
            {
                Key   = "pricing.vehicleMultipliers",
                Value = """{"Motorcycle":0.7,"Sedan":1.0,"SUV":1.5,"Pickup":2.0}""",
                UpdatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();

            var multipliers = await _service.GetVehicleMultipliersAsync();

            Assert.Equal(0.7m, multipliers[VehicleType.Motorcycle]);
            Assert.Equal(1.5m, multipliers[VehicleType.SUV]);
            Assert.Equal(2.0m, multipliers[VehicleType.Pickup]);
        }

        // 12. Missing/incomplete DB multipliers fall back to defaults
        [Fact]
        public async Task InvalidDbMultipliers_FallBackToDefaults()
        {
            _context.SystemSettings.Add(new SystemSetting
            {
                Key   = "pricing.vehicleMultipliers",
                Value = """{"Motorcycle":0.8}""",  // missing Sedan, SUV, Pickup
                UpdatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();

            var multipliers = await _service.GetVehicleMultipliersAsync();

            Assert.Equal(1.25m, multipliers[VehicleType.SUV]);   // default used
        }

        // 13. Final amount never goes below zero (subscription overshoots)
        [Fact]
        public async Task FinalAmount_NeverBelowZero()
        {
            // 100% subscription discount then percentage offer
            var offer = new Offer { DiscountType = DiscountType.Percentage, DiscountValue = 50m };
            var result = await _service.CalculateAsync(
                [Item(100m)], VehicleType.Sedan, 100m, offer, null);

            Assert.Equal(0m, result.SubtotalAfterSubscription);
            Assert.Equal(0m, result.OfferDiscountAmount);  // nothing left to discount
            Assert.Equal(0m, result.FinalAmount);
        }
    }
}
