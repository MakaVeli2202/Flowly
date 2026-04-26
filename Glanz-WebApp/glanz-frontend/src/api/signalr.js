const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';

const _notifListeners = new Set();
let pollInterval = null;
const _dispatchedIds = new Set();

function _dispatchNotification(notif) {
  if (_dispatchedIds.has(notif.id)) return;
  _dispatchedIds.add(notif.id);
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
    } catch { /* silent */ }
  };

  pollInterval = setInterval(poll, 15000);
  poll();
}

export async function stopNotificationConnection() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function clearDispatchedNotifications() {
  _dispatchedIds.clear();
}
