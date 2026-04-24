import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { API_BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HUB_URL = API_BASE_URL.replace('/api', '/hubs/notifications');

let connection = null;

// ─── Connection-state bus ─────────────────────────────────────────────────────
// Components subscribe to know when SignalR drops/reconnects without importing
// the connection object directly. Keeps state in one place.
//
// Usage:
//   import { onConnectionStatus, offConnectionStatus } from '../api/signalr';
//   useEffect(() => {
//     const handler = (status) => setSignalRStatus(status); // 'connected' | 'reconnecting' | 'disconnected'
//     onConnectionStatus(handler);
//     return () => offConnectionStatus(handler);
//   }, []);
const _statusListeners = new Set();

export function onConnectionStatus(fn)  { _statusListeners.add(fn); }
export function offConnectionStatus(fn) { _statusListeners.delete(fn); }

function _emitStatus(status) {
  _statusListeners.forEach((fn) => { try { fn(status); } catch { /* silent */ } });
}

// ─── Notification event bus ───────────────────────────────────────────────────
// The ONLY place that calls connection.on('ReceiveNotification') is inside
// getNotificationConnection() below — registered exactly once on the singleton.
// All screens must use subscribeToNotifications() — never connection.on() directly.
const _notifListeners = new Set();

function _dispatchNotification(notif) {
  _notifListeners.forEach((fn) => { try { fn(notif); } catch { /* silent */ } });
}

/**
 * Subscribe to incoming SignalR notifications via the event bus.
 * Returns an unsubscribe function — always call it in useEffect / useFocusEffect cleanup.
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
        accessTokenFactory: async () => {
          const token = await AsyncStorage.getItem('token');
          return token || '';
        },
      })
      // Extended retry array — last value (60 s) repeated indefinitely by SignalR
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000, 60000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Register lifecycle handlers once on the singleton (not inside components)
    connection.onreconnecting(() => {
      _emitStatus('reconnecting');
    });

    connection.onreconnected(() => {
      _emitStatus('connected');
    });

    connection.onclose(() => {
      // All retry attempts exhausted — hub gave up
      _emitStatus('disconnected');
    });

    // Single ReceiveNotification handler — dispatches to the event bus.
    // Never call connection.on('ReceiveNotification', ...) elsewhere.
    connection.on('ReceiveNotification', _dispatchNotification);
  }
  return connection;
}

export async function startNotificationConnection() {
  const token = await AsyncStorage.getItem('token');
  if (!token) return null;

  const conn = getNotificationConnection();
  if (conn.state === HubConnectionState.Disconnected) {
    await conn.start();
    _emitStatus('connected');
  }
  return conn;
}

export async function stopNotificationConnection() {
  if (connection && connection.state !== HubConnectionState.Disconnected) {
    await connection.stop();
  }
  connection = null;
  _emitStatus('disconnected');
}

