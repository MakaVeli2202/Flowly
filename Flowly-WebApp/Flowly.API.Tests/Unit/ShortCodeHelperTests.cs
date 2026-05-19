using Flowly.API.Helpers;
using Xunit;

namespace Flowly.API.Tests.Unit
{
    public class ShortCodeHelperTests
    {
        // 1. Basic generation — no collisions, should return attempt 1
        [Fact]
        public void Generate_NoCaollision_ReturnsAttempt1()
        {
            var result = ShortCodeHelper.GenerateShortCode("Mohamed", "Mahadi", new HashSet<string>());
            Assert.Equal("MOMA", result);
        }

        // 2. First collision — attempt 1 taken, returns attempt 2
        [Fact]
        public void Generate_Attempt1Taken_ReturnsAttempt2()
        {
            var taken = new HashSet<string> { "MOMA" };
            var result = ShortCodeHelper.GenerateShortCode("Mohamed", "Mahadi", taken);
            Assert.Equal("MOHM", result);
        }

        // 3. Multiple collisions — attempts 1-6 all taken, returns numeric suffix
        [Fact]
        public void Generate_Attempts1Through6Taken_ReturnsNumericSuffix()
        {
            var taken = new HashSet<string> { "MOMA", "MOHM", "MMAH", "MOAH", "MOHA", "MAHA" };
            var result = ShortCodeHelper.GenerateShortCode("Mohamed", "Mahadi", taken);
            Assert.Equal("MOM2", result);
        }

        // 4. Numeric suffix fallback — 2 already taken, returns 3
        [Fact]
        public void Generate_NumericSuffix2Taken_Returns3()
        {
            var taken = new HashSet<string> { "MOMA", "MOHM", "MMAH", "MOAH", "MOHA", "MAHA", "MOM2" };
            var result = ShortCodeHelper.GenerateShortCode("Mohamed", "Mahadi", taken);
            Assert.Equal("MOM3", result);
        }

        // 5. Codes are always UPPERCASE
        [Fact]
        public void Generate_AlwaysUppercase()
        {
            var result = ShortCodeHelper.GenerateShortCode("john", "doe", new HashSet<string>());
            Assert.Equal(result, result.ToUpperInvariant());
        }

        // 6. Handles short names gracefully (skips attempts requiring more chars than available)
        [Fact]
        public void Generate_ShortNames_SkipsInapplicableAttempts()
        {
            // "Al" (2 chars first name), "Bo" (2 chars last name)
            // Attempt 1 (fn[0:2]+ln[0:2] = "ALBO") should work
            var result = ShortCodeHelper.GenerateShortCode("Al", "Bo", new HashSet<string>());
            Assert.Equal("ALBO", result);
        }

        // 7. Candidates produces exactly 4-char codes
        [Fact]
        public void Candidates_AllExactly4Chars()
        {
            var candidates = ShortCodeHelper.Candidates("Mohamed", "Mahadi").Take(20).ToList();
            Assert.All(candidates, c => Assert.Equal(4, c.Length));
        }
    }
}
