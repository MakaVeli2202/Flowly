import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';

const HUB_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api')
  .replace('/api', '/hubs/notifications');

let connection = null;

// ─── Connection-state bus ─────────────────────────────────────────────────────
const stateListeners = new Set();
function notifyStateListeners(state) {
  stateListeners.forEach((fn) => fn(state));
}

/** Subscribe to connection state changes. Returns an unsubscribe function. */
export function onConnectionStateChange(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

// ─── Notification event bus ───────────────────────────────────────────────────
// The ONLY place that calls connection.on('ReceiveNotification') is inside
// getNotificationConnection() below — registered exactly once on the singleton.
// All components must use subscribeToNotifications() — never connection.on() directly.
const _notifListeners = new Set();

function _dispatchNotification(notif) {
  _notifListeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

/**
 * Subscribe to incoming SignalR notifications via the event bus.
 * Returns an unsubscribe function — always call it in useEffect cleanup.
 *
 * Usage:
 *   import { subscribeToNotifications } from '../api/signalr';
 *   useEffect(() => {
 *     return subscribeToNotifications((notif) => { ... });
 *   }, []);
 */
export function subscribeToNotifications(fn) {
  _notifListeners.add(fn);
  return () => _notifListeners.delete(fn);
}

// ─── Connection singleton ─────────────────────────────────────────────────────
export function getNotificationConnection() {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        // JWT passed via query string — WebSocket can't send Authorization headers.
        accessTokenFactory: () => localStorage.getItem('token') || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.onreconnecting(() => notifyStateListeners('reconnecting'));
    connection.onreconnected(() => notifyStateListeners('connected'));
    connection.onclose(() => notifyStateListeners('disconnected'));

    // Single ReceiveNotification handler — dispatches to the event bus.
    // Never call connection.on('ReceiveNotification', ...) elsewhere.
    connection.on('ReceiveNotification', _dispatchNotification);
  }
  return connection;
}

export async function startNotificationConnection() {
  const conn = getNotificationConnection();
  if (conn.state === HubConnectionState.Disconnected) {
    await conn.start();
    notifyStateListeners('connected');
  }
  return conn;
}

export async function stopNotificationConnection() {
  if (connection && connection.state !== HubConnectionState.Disconnected) {
    await connection.stop();
    notifyStateListeners('disconnected');
  }
}
