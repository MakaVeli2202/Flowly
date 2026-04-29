/**
 * realtimeService — singleton SignalR WebSocket client (React Native / Expo edition).
 *
 * Mirrors the web version exactly. ONE connection per app session.
 * All real-time features share this connection — no duplicate sockets.
 *
 * AppState integration:
 *   The connection is kept alive in the background (required for admin location streaming).
 *   On foreground return the hub auto-reconnects if the OS dropped it.
 *
 * Usage:
 *   // In AuthContext after login:
 *   await realtimeService.connect(token);
 *
 *   // Subscribe to notifications:
 *   const unsub = realtimeService.onNotification((notif) => { ... });
 *   return unsub;  // call on unmount
 *
 *   // Worker sends GPS location:
 *   realtimeService.updateAdminLocation(lat, lng);
 *
 *   // On logout:
 *   await realtimeService.disconnect();
 */

import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../config/api';

const HUB_URL = `${API_BASE_URL.replace('/api', '')}/hubs/glanz`;

// ── Internal state ────────────────────────────────────────────────────────────
let _connection = null;
let _token      = null;
let _connecting = false;

// Fan-out listener registry
const _listeners = {
  Notification:    new Set(),
  JobStatusUpdate: new Set(),
  LocationUpdate:  new Set(),
  ForceStop:       new Set(),
  RevokeTracking:  new Set(),
  StateChange:     new Set(),
};

// Connection state: 'connected' | 'reconnecting' | 'disconnected'
let _connectionState = 'disconnected';

function _setState(state) {
  _connectionState = state;
  _listeners.StateChange.forEach((fn) => { try { fn(state); } catch { /* silent */ } });
}

// ── Build connection ──────────────────────────────────────────────────────────
function _buildConnection() {
  return new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => _token ?? '',
      // React Native does not support Server-Sent Events; use WS + LP fallback
      transport: signalR.HttpTransportType.WebSockets |
                 signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(__DEV__ ? signalR.LogLevel.Information : signalR.LogLevel.Warning)
    .build();
}

function _wireEvents(conn) {
  conn.on('Notification', (payload) => {
    _listeners.Notification.forEach((fn) => { try { fn(payload); } catch { /* silent */ } });
  });
  conn.on('JobStatusUpdate', (payload) => {
    _listeners.JobStatusUpdate.forEach((fn) => { try { fn(payload); } catch { /* silent */ } });
  });
  conn.on('LocationUpdate', (payload) => {
    _listeners.LocationUpdate.forEach((fn) => { try { fn(payload); } catch { /* silent */ } });
  });
  conn.on('ForceStop', (payload) => {
    _listeners.ForceStop.forEach((fn) => { try { fn(payload); } catch { /* silent */ } });
  });
  conn.on('RevokeTracking', (payload) => {
    _listeners.RevokeTracking.forEach((fn) => { try { fn(payload); } catch { /* silent */ } });
  });
  conn.onreconnecting(() => _setState('reconnecting'));
  conn.onreconnected(() => _setState('connected'));
  conn.onclose(() => _setState('disconnected'));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function connect(jwt) {
  if (_connection?.state === signalR.HubConnectionState.Connected) return;
  if (_connecting) return;

  _token      = jwt;
  _connecting = true;

  try {
    _connection = _buildConnection();
    _wireEvents(_connection);
    await _connection.start();
    _setState('connected');
  } catch (err) {
    _setState('disconnected');
    if (__DEV__) console.warn('[realtimeService] connection failed:', err?.message);
  } finally {
    _connecting = false;
  }
}

export async function disconnect() {
  _token = null;
  if (_connection) {
    try { await _connection.stop(); } catch { /* silent */ }
    _connection = null;
  }
  _setState('disconnected');
}

export function isConnected() {
  return _connection?.state === signalR.HubConnectionState.Connected;
}

// ── Listener helpers ──────────────────────────────────────────────────────────

export function onNotification(fn) {
  _listeners.Notification.add(fn);
  return () => _listeners.Notification.delete(fn);
}

export function onJobStatus(fn) {
  _listeners.JobStatusUpdate.add(fn);
  return () => _listeners.JobStatusUpdate.delete(fn);
}

export function onLocationUpdate(fn) {
  _listeners.LocationUpdate.add(fn);
  return () => _listeners.LocationUpdate.delete(fn);
}

export function onForceStop(fn) {
  _listeners.ForceStop.add(fn);
  return () => _listeners.ForceStop.delete(fn);
}

export function onRevokeTracking(fn) {
  _listeners.RevokeTracking.add(fn);
  return () => _listeners.RevokeTracking.delete(fn);
}

export function getConnectionState() {
  return _connectionState;
}

export function onConnectionStateChange(fn) {
  _listeners.StateChange.add(fn);
  return () => _listeners.StateChange.delete(fn);
}

export async function forceStopWorker(workerId) {
  if (!isConnected()) return;
  try { await _connection.invoke('ForceStopWorker', workerId); } catch { /* silent */ }
}

export async function revokeTrackingSession(workerId) {
  if (!isConnected()) return;
  try { await _connection.invoke('RevokeTrackingSession', workerId); } catch { /* silent */ }
}

// ── Group subscriptions ───────────────────────────────────────────────────────

export async function subscribeToJobStatus(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('SubscribeToJobStatus', bookingId); } catch { /* silent */ }
}

export async function unsubscribeFromJobStatus(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('UnsubscribeFromJobStatus', bookingId); } catch { /* silent */ }
}

export async function subscribeToAdminLocation(workerId) {
  if (!isConnected()) return;
  try { await _connection.invoke('SubscribeToAdminLocation', workerId); } catch { /* silent */ }
}

export async function subscribeToCustomerLocation(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('SubscribeToCustomerLocation', bookingId); } catch { /* silent */ }
}

export async function subscribeToAllAdminLocations() {
  if (!isConnected()) return;
  try { await _connection.invoke('SubscribeToAllAdminLocations'); } catch { /* silent */ }
}

// ── Worker → hub: GPS stream methods ─────────────────────────────────────────

/** Worker sends current GPS position to admin stream. */
export async function updateAdminLocation(latitude, longitude) {
  if (!isConnected()) return false;
  try {
    await _connection.invoke('UpdateAdminLocation', latitude, longitude);
    return true;
  } catch { return false; }
}

/** Worker presses "On My Way" — starts customer-visible stream. */
export async function startCustomerStream(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('StartCustomerStream', bookingId); } catch { /* silent */ }
}

/** Worker sends GPS position during customer-visible EN_ROUTE phase. */
export async function updateCustomerLocation(bookingId, latitude, longitude) {
  if (!isConnected()) return false;
  try {
    await _connection.invoke('UpdateCustomerLocation', bookingId, latitude, longitude);
    return true;
  } catch { return false; }
}

/** Worker presses "Start Job" — stops customer stream, admin stream continues. */
export async function stopCustomerStream(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('StopCustomerStream', bookingId); } catch { /* silent */ }
}

// ── Required API surface (spec-compliant naming) ──────────────────────────────

/**
 * startAdminTracking — signals that admin location stream should be active.
 * Hub derives workerId from JWT claims. Admin stream is ALWAYS-ON.
 * Actual position updates flow via updateAdminLocation() called by the GPS module.
 */
export async function startAdminTracking(_workerId) {
  // Admin stream activates implicitly when updateAdminLocation() is called.
  // Exists to fulfil the required API contract.
}

/**
 * stopAdminTracking — no-op by design.
 * Admin stream only stops on hub disconnect (logout).
 * Worker job actions MUST NOT call this.
 */
export async function stopAdminTracking() {
  // No-op: admin tracking is session-scoped, not job-scoped.
}

/** Alias: startCustomerTracking(bookingId) — worker presses "On My Way". */
export const startCustomerTracking = startCustomerStream;

/** Alias: stopCustomerTracking(bookingId) — worker presses "Start Job". */
export const stopCustomerTracking = stopCustomerStream;

const realtimeService = {
  connect,
  disconnect,
  isConnected,
  onNotification,
  onJobStatus,
  onLocationUpdate,
  onForceStop,
  onRevokeTracking,
  getConnectionState,
  onConnectionStateChange,
  forceStopWorker,
  revokeTrackingSession,
  subscribeToJobStatus,
  unsubscribeFromJobStatus,
  subscribeToAdminLocation,
  subscribeToCustomerLocation,
  subscribeToAllAdminLocations,
  updateAdminLocation,
  startAdminTracking,
  stopAdminTracking,
  startCustomerTracking,
  stopCustomerTracking,
  startCustomerStream,
  updateCustomerLocation,
  stopCustomerStream,
};
export default realtimeService;
