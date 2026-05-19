using System.Collections.Concurrent;

namespace Flowly.API.Services
{
    /// <summary>
    /// In-memory per-user coupon failure limiter.
    /// Blocks further attempts after MaxFailures within the sliding window.
    /// Resets on a successful redemption.
    /// </summary>
    public sealed class CouponRateLimiter
    {
        private const int MaxFailures = 5;
        private static readonly TimeSpan Window = TimeSpan.FromHours(1);

        private readonly ConcurrentDictionary<int, (int Count, DateTime WindowStart)> _map = new();

        public bool IsBlocked(int userId)
        {
            if (!_map.TryGetValue(userId, out var entry)) return false;

            if (DateTime.UtcNow - entry.WindowStart > Window)
            {
                _map.TryRemove(userId, out _);
                return false;
            }

            return entry.Count >= MaxFailures;
        }

        public void RecordFailure(int userId)
        {
            _map.AddOrUpdate(
                userId,
                _ => (1, DateTime.UtcNow),
                (_, prev) =>
                {
                    if (DateTime.UtcNow - prev.WindowStart > Window)
                        return (1, DateTime.UtcNow);
                    return (prev.Count + 1, prev.WindowStart);
                });
        }

        public void RecordSuccess(int userId) => _map.TryRemove(userId, out _);
    }
}
