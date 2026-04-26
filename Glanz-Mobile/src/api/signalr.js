import { API_BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const _statusListeners = new Set();
const _notifListeners = new Set();
let pollInterval = null;
let _lastNotifId  = 0;
let _initialized  = false;

export function onConnectionStatus(fn)  { _statusListeners.add(fn); }
export function offConnectionStatus(fn) { _statusListeners.delete(fn); }

export function subscribeToNotifications(fn) {
  _notifListeners.add(fn);
  return () => _notifListeners.delete(fn);
}

function _dispatchNotification(notif) {
  _notifListeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

export function getNotificationConnection() {
  return null;
}

export async function startNotificationConnection() {
  if (pollInterval) return;

  const poll = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;

      const notifs = await res.json();
      if (!Array.isArray(notifs) || notifs.length === 0) return;

      if (!_initialized) {
        // Seed the cursor — don't dispatch historical notifications on first load
        _lastNotifId = Math.max(...notifs.map((n) => n.id ?? 0));
        _initialized = true;
        return;
      }

      const newNotifs = notifs.filter((n) => (n.id ?? 0) > _lastNotifId);
      if (newNotifs.length > 0) {
        _lastNotifId = Math.max(...newNotifs.map((n) => n.id ?? 0));
        newNotifs.forEach(_dispatchNotification);
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
  // Reset cursor so next login starts fresh
  _lastNotifId = 0;
  _initialized = false;
}
