import apiClient from './axios';

const _notifListeners = new Set();
let pollInterval = null;
const _dispatchedIds = new Set();
// First poll after session start seeds IDs without firing listeners (no sound for old notifs).
let _seeded = false;

function _dispatchNotification(notif) {
  if (_dispatchedIds.has(notif.id)) return;
  _dispatchedIds.add(notif.id);
  if (!_seeded) return; // seed-only: register IDs but don't fire sound/callbacks
  _notifListeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

export function subscribeToNotifications(fn) {
  _notifListeners.add(fn);
  return () => _notifListeners.delete(fn);
}

export function onConnectionStateChange(fn) {
  return () => {};
}

export function getNotificationConnection() {
  return null;
}

export async function startNotificationConnection() {
  if (pollInterval) return;
  _seeded = false; // reset seed flag on each new session

  const poll = async () => {
    try {
      const res = await apiClient.get('/notifications');
      const notifs = Array.isArray(res.data) ? res.data : [];
      notifs.forEach(_dispatchNotification);
    } catch { /* silent */ } finally {
      if (!_seeded) _seeded = true;
    }
  };

  pollInterval = setInterval(poll, 15000);
  poll();
}

export async function stopNotificationConnection() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  _seeded = false;
}

export function clearDispatchedNotifications() {
  _dispatchedIds.clear();
}
