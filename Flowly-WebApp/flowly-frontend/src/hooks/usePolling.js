import { useEffect, useRef } from 'react';

/**
 * usePolling — runs `callback` on a fixed interval and stops cleanly on unmount.
 *
 * Also re-triggers on window focus and document visibility changes so the user
 * always sees fresh data when they switch back to the tab.
 *
 * @param {() => void}  callback     - Function to call. Wrap in useCallback to keep stable.
 * @param {number}      intervalMs   - Polling interval in milliseconds (e.g. 30000).
 * @param {object}      [opts]
 * @param {boolean}     [opts.onFocus=true]       - Re-run on window focus.
 * @param {boolean}     [opts.onVisibility=true]  - Re-run when tab becomes visible.
 * @param {boolean}     [opts.enabled=true]       - Pass false to pause polling.
 *
 * Usage:
 *   const refresh = useCallback(() => fetchBookings({ showLoader: false }), []);
 *   usePolling(refresh, 30_000);
 */
export function usePolling(callback, intervalMs, opts = {}) {
  const { onFocus = true, onVisibility = true, enabled = true } = opts;

  // Keep callback ref stable so changing the function doesn't restart the interval.
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    const run = () => cbRef.current();

    const id = window.setInterval(run, intervalMs);

    const focusHandler      = onFocus      ? () => run()                                            : null;
    const visibilityHandler = onVisibility ? () => { if (document.visibilityState === 'visible') run(); } : null;

    if (focusHandler)      window.addEventListener('focus', focusHandler);
    if (visibilityHandler) document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      clearInterval(id);
      if (focusHandler)      window.removeEventListener('focus', focusHandler);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [intervalMs, onFocus, onVisibility, enabled]);
}
