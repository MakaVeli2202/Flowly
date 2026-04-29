/**
 * notificationBus — Web edition.
 *
 * Real-time delivery comes from the SignalR hub via realtimeService.
 * The bus bridges the hub → application components with a simple pub/sub API
 * identical to the old polling-based interface so existing consumers don't change.
 *
 * Lifecycle:
 *   startNotificationConnection()  — called from AuthContext after login
 *   stopNotificationConnection()   — called from AuthContext on logout
 *   subscribeToNotifications(fn)   — returns unsub function
 *
 * The dispatched-IDs guard prevents re-firing notifications that the user
 * already saw in a previous session (seeding phase on first connect).
 */

import { onNotification } from './realtimeService';

const _notifListeners = new Set();
const _dispatchedIds  = new Set();
let _seeded  = false;
let _unsubWs = null; // unsub from realtimeService.onNotification

function _dispatchNotification(notif) {
  const id = notif?.id;
  if (id != null && _dispatchedIds.has(id)) return;
  if (id != null) _dispatchedIds.add(id);
  if (!_seeded) return; // first batch seeds IDs without firing listeners
  _notifListeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

export function subscribeToNotifications(fn) {
  _notifListeners.add(fn);
  return () => _notifListeners.delete(fn);
}

export function startNotificationConnection() {
  if (_unsubWs) return; // already running
  _seeded = false;

  _unsubWs = onNotification((notif) => {
    _dispatchNotification(notif);
    // After the first real push from the server we consider ourselves seeded.
    if (!_seeded) _seeded = true;
  });

  // Mark as seeded after a short delay even if no push arrives
  // (handles case where user has zero unread notifications at login).
  setTimeout(() => { _seeded = true; }, 2000);
}

export function stopNotificationConnection() {
  if (_unsubWs) {
    _unsubWs();
    _unsubWs = null;
  }
  _seeded = false;
}

export function clearDispatchedNotifications() {
  _dispatchedIds.clear();
}
