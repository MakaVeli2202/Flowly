/**
 * Lightweight in-memory cache with TTL support and inflight-request
 * deduplication.
 *
 * Goals:
 *  - Prevent the same endpoint being fetched multiple times during a single
 *    render cycle or within the TTL window (default 30 s).
 *  - Invalidate cached data automatically on mutations so components always
 *    see fresh data after a booking create / update / delete.
 *  - Zero dependencies — works identically in web and React Native.
 *
 * Usage:
 *
 *   // Read-through (cache + dedup):
 *   const bookings = await cacheManager.fetch(
 *     'bookings:all',
 *     () => bookingsAPI.getAll(),
 *     30_000,           // optional TTL override (ms)
 *   );
 *
 *   // Manual write (e.g. after optimistic update):
 *   cacheManager.set('bookings:all', updatedList);
 *
 *   // Invalidate after a mutation:
 *   cacheManager.invalidate('bookings'); // clears all keys starting with 'bookings'
 *
 *   // Full reset on logout:
 *   cacheManager.clear();
 */

const DEFAULT_TTL_MS = 30_000;

const _cache    = new Map(); // key → { data, expiresAt }
const _inflight = new Map(); // key → Promise<data>

/* ── Read ────────────────────────────────────────────────────────────────── */

/**
 * Return cached data for `key`, or null if missing / expired.
 * @param {string} key
 * @returns {* | null}
 */
function get(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

/* ── Write ───────────────────────────────────────────────────────────────── */

/**
 * Store `data` under `key` with an optional TTL.
 * @param {string} key
 * @param {*}      data
 * @param {number} [ttlMs]
 */
function set(key, data, ttlMs = DEFAULT_TTL_MS) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/* ── Fetch (cache + inflight deduplication) ──────────────────────────────── */

/**
 * Return cached data if fresh, otherwise call `fetcher()`.
 *
 * If a request for `key` is already in flight the same Promise is returned
 * — preventing duplicate network calls even if two components mount at the
 * same time.
 *
 * @param {string}            key
 * @param {() => Promise<*>}  fetcher
 * @param {number}            [ttlMs]
 * @returns {Promise<*>}
 */
async function fetch(key, fetcher, ttlMs = DEFAULT_TTL_MS) {
  const cached = get(key);
  if (cached !== null) return cached;

  if (_inflight.has(key)) return _inflight.get(key);

  const promise = fetcher()
    .then((data) => {
      set(key, data, ttlMs);
      _inflight.delete(key);
      return data;
    })
    .catch((err) => {
      _inflight.delete(key);
      throw err;
    });

  _inflight.set(key, promise);
  return promise;
}

/* ── Invalidation ────────────────────────────────────────────────────────── */

/**
 * Invalidate all cache + inflight entries whose keys start with `prefix`.
 *
 * Call this after any mutation (create / update / delete) so subsequent
 * reads hit the server for fresh data.
 *
 * @param {string} prefix  e.g. 'bookings' to wipe 'bookings:all', 'bookings:summary', etc.
 */
function invalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
  for (const key of _inflight.keys()) {
    if (key.startsWith(prefix)) _inflight.delete(key);
  }
}

/**
 * Delete a single exact cache entry.
 * @param {string} key
 */
function remove(key) {
  _cache.delete(key);
  _inflight.delete(key);
}

/**
 * Clear everything — call on logout.
 */
function clear() {
  _cache.clear();
  _inflight.clear();
}

/* ── Debug helper (dev only) ─────────────────────────────────────────────── */
function size() {
  return { cache: _cache.size, inflight: _inflight.size };
}

export const cacheManager = { get, set, fetch, invalidate, remove, clear, size };
