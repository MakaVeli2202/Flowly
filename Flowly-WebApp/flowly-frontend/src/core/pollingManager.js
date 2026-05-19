/**
 * Singleton polling manager — web (browser) edition.
 *
 * PRIORITY system:
 *   PRIORITY.HIGH   — critical (unread counts, live job status)
 *   PRIORITY.MEDIUM — important but not critical (booking lists, workers)
 *   PRIORITY.LOW    — analytics/reports — 2× interval after long tab-hidden period
 *
 * The fan-out model: one fetcher per key → many subscriber callbacks.
 * If a key is already registered, subscribe() attaches to the existing
 * interval — no second network call is started.
 *
 * Usage:
 *   import { pollingManager, PRIORITY } from '../core/pollingManager';
 *
 *   const unsub = pollingManager.subscribe(
 *     'unread-count',
 *     () => notificationsAPI.getUnreadCount(),
 *     30_000,
 *     (count) => setUnreadCount(count),
 *     { priority: PRIORITY.HIGH },
 *   );
 *   return unsub;
 *
 *   pollingManager.refresh('unread-count');
 *   pollingManager.getStats(); // → Map of all active jobs
 */

export const PRIORITY = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });

/* ── Internal registry ───────────────────────────────────────────────────── */
const _jobs = new Map();
// key → { intervalId, run, intervalMs, priority, paused, subscribers: Set<fn> }

let _globalPaused = false;
let _hiddenStart  = null; // timestamp when tab was hidden

/* ── Core helpers ────────────────────────────────────────────────────────── */
function _pauseAll() {
  _hiddenStart  = Date.now();
  _globalPaused = true;
  _jobs.forEach((job) => {
    clearInterval(job.intervalId);
    job.intervalId = null;
    job.paused = true;
  });
}

function _resumeAll() {
  const hiddenMs     = _hiddenStart != null ? Date.now() - _hiddenStart : 0;
  _hiddenStart       = null;
  _globalPaused      = false;
  const longHidden   = hiddenMs > 120_000; // > 2 minutes hidden

  _jobs.forEach((job) => {
    if (!job.paused) return;
    job.paused = false;
    job.run(); // immediate refresh on resume
    // LOW priority jobs slow down temporarily after long hidden period
    const effective = (longHidden && job.priority === PRIORITY.LOW)
      ? job.intervalMs * 2
      : job.intervalMs;
    job.intervalId = window.setInterval(job.run, effective);
  });
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Subscribe a callback to a shared polling job.
 *
 * @param {string}            key        Unique job identifier
 * @param {() => Promise<*>}  fetcher    Async function that returns data
 * @param {number}            intervalMs Polling interval in milliseconds
 * @param {(data: *) => void} onData     Callback invoked with fetcher result
 * @param {object}            [options]
 * @param {string}            [options.priority=PRIORITY.MEDIUM]
 * @returns {() => void}                 Unsubscribe function — call on unmount
 */
function subscribe(key, fetcher, intervalMs, onData, { priority = PRIORITY.MEDIUM } = {}) {
  let job = _jobs.get(key);

  if (!job) {
    const run = async () => {
      const j = _jobs.get(key);
      if (!j) return;
      try {
        const result = await fetcher();
        j.subscribers.forEach((cb) => {
          try { cb(result); } catch { /* silent — bad subscriber won't kill the job */ }
        });
      } catch { /* silent — network errors are fine, we'll retry next tick */ }
    };

    const intervalId = _globalPaused ? null : window.setInterval(run, intervalMs);
    job = { intervalId, run, intervalMs, priority, paused: _globalPaused, subscribers: new Set() };
    _jobs.set(key, job);

    if (!_globalPaused) run(); // immediate first call
  }

  job.subscribers.add(onData);

  return function unsubscribe() {
    const j = _jobs.get(key);
    if (!j) return;
    j.subscribers.delete(onData);
    if (j.subscribers.size === 0) {
      clearInterval(j.intervalId);
      _jobs.delete(key);
    }
  };
}

/**
 * Force an immediate re-poll for a specific job (e.g. after a mutation).
 * @param {string} key
 */
function refresh(key) {
  const job = _jobs.get(key);
  if (job && !job.paused) job.run();
}

/**
 * Check whether a job is currently registered.
 * @param {string} key
 */
function has(key) {
  return _jobs.has(key);
}

/**
 * Return a snapshot of all registered jobs (debugging / monitoring).
 * @returns {Map<string, {intervalMs, priority, subscriberCount, paused}>}
 */
function getStats() {
  const out = new Map();
  _jobs.forEach((job, key) => {
    out.set(key, {
      intervalMs:      job.intervalMs,
      priority:        job.priority,
      paused:          job.paused,
      subscriberCount: job.subscribers.size,
    });
  });
  return out;
}

/* ── Global browser event listeners ─────────────────────────────────────── */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _pauseAll();
    else _resumeAll();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if (!_globalPaused) {
      _jobs.forEach((job) => { if (!job.paused) job.run(); });
    }
  });
}

export const pollingManager = { subscribe, refresh, has, getStats };
