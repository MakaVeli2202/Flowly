// ─── notificationBus.js (Mobile) ─────────────────────────────────────────────
// Bridges realtimeService (SignalR WebSocket) → app components.
// API is identical to the old polling-based bus so consumers don't change.
//
// Lifecycle managed by AuthContext:
//   startNotificationConnection()  — call after login / session restore
//   stopNotificationConnection()   — call on logout
//
// Components subscribe via:
//   const unsub = subscribeToNotifications(fn);
//   return unsub; // in useEffect cleanup

import { onNotification } from './realtimeService';

const _listeners    = new Set();
const _dispatchedIds = new Set();
let _seeded  = false;
let _unsubWs = null;

function _dispatch(notif) {
  const id = notif?.id;
  if (id != null && _dispatchedIds.has(id)) return;
  if (id != null) _dispatchedIds.add(id);
  if (!_seeded) return; // seed phase: register IDs without firing callbacks
  _listeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

export function subscribeToNotifications(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function startNotificationConnection() {
  if (_unsubWs) return;
  _seeded  = false;

  _unsubWs = onNotification((notif) => {
    _dispatch(notif);
    if (!_seeded) _seeded = true;
  });

  // Seed phase ends after 2 s even if no push arrives
  setTimeout(() => { _seeded = true; }, 2000);
}

export function stopNotificationConnection() {
  if (_unsubWs) {
    _unsubWs();
    _unsubWs = null;
  }
  _seeded = false;
  _dispatchedIds.clear();
}

/** Legacy: direct dispatch for push notification tap handlers. */
export function dispatchNotification(notif) {
  _listeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}
