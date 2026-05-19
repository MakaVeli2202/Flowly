/**
 * Lightweight in-memory cache with TTL support and inflight-request
 * deduplication.  Identical to the web version — zero platform-specific code.
 *
 * Usage:
 *   const bookings = await cacheManager.fetch(
 *     'bookings:all',
 *     () => bookingsAPI.getAll(),
 *     30_000,
 *   );
 *
 *   cacheManager.invalidate('bookings'); // after create/update/delete
 *   cacheManager.clear();               // on logout
 */

const DEFAULT_TTL_MS = 30_000;

const _cache    = new Map();
const _inflight = new Map();

function get(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}

function set(key, data, ttlMs = DEFAULT_TTL_MS) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function fetch(key, fetcher, ttlMs = DEFAULT_TTL_MS) {
  const cached = get(key);
  if (cached !== null) return cached;

  if (_inflight.has(key)) return _inflight.get(key);

  const promise = fetcher()
    .then((data) => { set(key, data, ttlMs); _inflight.delete(key); return data; })
    .catch((err) => { _inflight.delete(key); throw err; });

  _inflight.set(key, promise);
  return promise;
}

function invalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
  for (const key of _inflight.keys()) {
    if (key.startsWith(prefix)) _inflight.delete(key);
  }
}

function remove(key) {
  _cache.delete(key);
  _inflight.delete(key);
}

function clear() {
  _cache.clear();
  _inflight.clear();
}

function size() {
  return { cache: _cache.size, inflight: _inflight.size };
}

export const cacheManager = { get, set, fetch, invalidate, remove, clear, size };
