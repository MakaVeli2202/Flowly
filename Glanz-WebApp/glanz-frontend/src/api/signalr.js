const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';

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
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const notifs = await res.json();
        notifs.forEach(_dispatchNotification);
      }
    } catch { /* silent */ } finally {
      if (!_seeded) _seeded = true; // after first poll completes, future dispatches fire listeners
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
