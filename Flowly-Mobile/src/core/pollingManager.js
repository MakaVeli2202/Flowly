/**
 * Singleton polling manager — React Native (Expo) edition.
 *
 * PRIORITY system:
 *   PRIORITY.HIGH   — resumes immediately after background, full speed
 *   PRIORITY.MEDIUM — resumes immediately, normal speed (default)
 *   PRIORITY.LOW    — resumes at 2× interval if background > 2 min
 *
 * Usage:
 *   import { pollingManager, PRIORITY } from '../core/pollingManager';
 *
 *   useEffect(() => {
 *     const unsub = pollingManager.subscribe(
 *       'unread-count',
 *       () => notificationsAPI.getUnreadCount(),
 *       30_000,
 *       (count) => setUnreadCount(Number(count || 0)),
 *       { priority: PRIORITY.HIGH },
 *     );
 *     return unsub;
 *   }, []);
 *
 *   pollingManager.refresh('unread-count');
 *   pollingManager.getStats(); // → Map of key → { intervalMs, priority, subscriberCount }
 */

import { AppState } from 'react-native';

export const PRIORITY = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });

/* ── Internal registry ───────────────────────────────────────────────────── */
const _jobs = new Map();
// key → { intervalId, run, intervalMs, priority, paused, subscribers: Set<fn> }

let _appActive = true;  // assume foreground on load
let _bgStart   = null;  // timestamp when app went to background

/* ── Core helpers ────────────────────────────────────────────────────────── */
function _pauseAll() {
  _bgStart = Date.now();
  _jobs.forEach((job) => {
    if (job.intervalId != null) {
      clearInterval(job.intervalId);
      job.intervalId = null;
    }
    job.paused = true;
  });
}

function _resumeAll() {
  const bgMs = _bgStart != null ? Date.now() - _bgStart : 0;
  _bgStart = null;
  const longBackground = bgMs > 120_000; // > 2 minutes

  _jobs.forEach((job) => {
    if (!job.paused) return;
    job.paused = false;
    job.run(); // immediate refresh
    // LOW priority jobs slow down temporarily after a long background session
    const effective = (longBackground && job.priority === PRIORITY.LOW)
      ? job.intervalMs * 2
      : job.intervalMs;
    job.intervalId = setInterval(job.run, effective);
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
 * @returns {() => void}                 Unsubscribe — call on unmount
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
          try { cb(result); } catch { /* silent */ }
        });
      } catch { /* silent */ }
    };

    const intervalId = _appActive ? setInterval(run, intervalMs) : null;
    job = { intervalId, run, intervalMs, priority, paused: !_appActive, subscribers: new Set() };
    _jobs.set(key, job);

    if (_appActive) run(); // immediate first call
  }

  job.subscribers.add(onData);

  return function unsubscribe() {
    const j = _jobs.get(key);
    if (!j) return;
    j.subscribers.delete(onData);
    if (j.subscribers.size === 0) {
      if (j.intervalId != null) clearInterval(j.intervalId);
      _jobs.delete(key);
    }
  };
}

/**
 * Force an immediate re-poll for a specific job key.
 * @param {string} key
 */
function refresh(key) {
  const job = _jobs.get(key);
  if (job && !job.paused && _appActive) job.run();
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
 * @returns {Map<string, {intervalMs, priority, subscriberCount}>}
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

/* ── AppState listener ───────────────────────────────────────────────────── */
AppState.addEventListener('change', (nextState) => {
  const active = nextState === 'active';
  if (active === _appActive) return; // no change
  _appActive = active;
  if (active) _resumeAll();
  else _pauseAll();
});

export const pollingManager = { subscribe, refresh, has, getStats };
