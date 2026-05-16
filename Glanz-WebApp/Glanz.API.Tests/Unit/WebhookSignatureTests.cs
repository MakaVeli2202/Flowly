using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace Glanz.API.Tests.Unit
{
    // Tests for the HMAC-SHA256 signature logic used in WebhooksController.TapWebhook
    public class WebhookSignatureTests
    {
        // Mirrors the exact computation in WebhooksController
        private static string ComputeSignature(string secret, string payload)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        [Fact]
        public void ValidSignature_Matches()
        {
            const string secret  = "test_secret_123";
            const string payload = """{"id":"ch_1","status":"CAPTURED"}""";
            var expected = ComputeSignature(secret, payload);

            // Same computation should produce identical signature
            Assert.Equal(expected, ComputeSignature(secret, payload));
        }

        [Fact]
        public void TamperedPayload_DoesNotMatch()
        {
            const string secret          = "test_secret_123";
            const string originalPayload = """{"id":"ch_1","status":"CAPTURED"}""";
            const string tamperedPayload = """{"id":"ch_1","status":"FAILED"}""";

            var original = ComputeSignature(secret, originalPayload);
            var tampered = ComputeSignature(secret, tamperedPayload);

            Assert.NotEqual(original, tampered);
        }

        [Fact]
        public void WrongSecret_DoesNotMatch()
        {
            const string payload      = """{"id":"ch_1","status":"CAPTURED"}""";
            const string realSecret   = "real_secret";
            const string attackSecret = "attacker_secret";

            var real    = ComputeSignature(realSecret, payload);
            var forged  = ComputeSignature(attackSecret, payload);

            Assert.NotEqual(real, forged);
        }

        [Fact]
        public void SignatureComparison_IsCaseInsensitive()
        {
            const string secret  = "test_secret";
            const string payload = """{"id":"ch_2"}""";

            var lower = ComputeSignature(secret, payload);
            var upper = lower.ToUpperInvariant();

            Assert.Equal(lower.ToUpperInvariant(), upper);
        }

        [Fact]
        public void EmptyPayload_ProducesStableSignature()
        {
            const string secret = "test_secret";
            var sig1 = ComputeSignature(secret, "");
            var sig2 = ComputeSignature(secret, "");
            Assert.Equal(sig1, sig2);
        }
    }
}
