/**
 * realtimeService — singleton SignalR WebSocket client (Web edition).
 *
 * Architecture:
 *   ONE connection per browser session → /hubs/glanz
 *   All real-time features (notifications, job status, location) share this connection.
 *
 * Usage:
 *   // In AuthContext after login:
 *   await realtimeService.connect(token);
 *
 *   // Subscribe to notifications:
 *   const unsub = realtimeService.onNotification((notif) => setNotifications(prev => [notif, ...prev]));
 *   return unsub;
 *
 *   // Subscribe to job status for a booking detail screen:
 *   await realtimeService.subscribeToJobStatus(bookingId);
 *   const unsub = realtimeService.onJobStatus((update) => { ... });
 *
 *   // Admin live map:
 *   await realtimeService.subscribeToAdminLocation(workerId);
 *   const unsub = realtimeService.onLocationUpdate((loc) => { ... });
 *
 *   // On logout:
 *   await realtimeService.disconnect();
 */

import * as signalR from '@microsoft/signalr';
const _apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';
const HUB_URL  = `${_apiBase.replace('/api', '')}/hubs/glanz`;

// ── Internal state ────────────────────────────────────────────────────────────
let _connection = null;
let _token      = null;
let _connecting = false;

// Fan-out listener registry — key → Set<Function>
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

// ── Build / rebuild connection ────────────────────────────────────────────────
function _buildConnection() {
  return new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      // JWT passed as query-string because WebSocket upgrades can't set headers
      accessTokenFactory: () => _token ?? '',
      transport: signalR.HttpTransportType.WebSockets |
                 signalR.HttpTransportType.LongPolling, // graceful fallback
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(
      import.meta.env.DEV ? signalR.LogLevel.Information : signalR.LogLevel.Warning
    )
    .build();
}

// ── Wire server → client event handlers ──────────────────────────────────────
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

/**
 * Connect to the hub. Call on login. Idempotent — safe to call multiple times.
 * @param {string} jwt  The user's JWT access token.
 */
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
    console.warn('[realtimeService] connection failed:', err);
  } finally {
    _connecting = false;
  }
}

/**
 * Disconnect from the hub. Call on logout.
 */
export async function disconnect() {
  _token = null;
  if (_connection) {
    try { await _connection.stop(); } catch { /* silent */ }
    _connection = null;
  }
  _setState('disconnected');
}

/** True when the WebSocket connection is established. */
export function isConnected() {
  return _connection?.state === signalR.HubConnectionState.Connected;
}

// ── Listener registration (returns unsub function) ────────────────────────────

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

// ── Group subscriptions (client calls hub methods to join groups) ─────────────

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

// ── Worker → hub: location updates (used by mobile only, but exported for completeness) ──

export async function updateAdminLocation(latitude, longitude) {
  if (!isConnected()) return;
  try { await _connection.invoke('UpdateAdminLocation', latitude, longitude); } catch { /* silent */ }
}

export async function startCustomerStream(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('StartCustomerStream', bookingId); } catch { /* silent */ }
}

export async function updateCustomerLocation(bookingId, latitude, longitude) {
  if (!isConnected()) return;
  try { await _connection.invoke('UpdateCustomerLocation', bookingId, latitude, longitude); } catch { /* silent */ }
}

export async function stopCustomerStream(bookingId) {
  if (!isConnected()) return;
  try { await _connection.invoke('StopCustomerStream', bookingId); } catch { /* silent */ }
}

// ── Required API surface (spec-compliant naming) ──────────────────────────────

/**
 * startAdminTracking — signals that admin location stream should be active.
 * Hub derives workerId from JWT claims. Admin stream is ALWAYS-ON.
 * Actual position updates flow via updateAdminLocation() called by the GPS module.
 * NEVER stop admin tracking from worker job actions.
 */
export async function startAdminTracking(_workerId) {
  // Admin stream activates implicitly when updateAdminLocation() is called.
  // Exists to fulfil the required API contract.
}

/**
 * stopAdminTracking — no-op by design.
 * Admin stream only stops on hub disconnect (logout).
 * Worker job actions (On My Way, Start Job, Job End) MUST NOT call this.
 */
export async function stopAdminTracking() {
  // No-op: admin tracking is session-scoped, not job-scoped.
}

/** startCustomerTracking(bookingId) — worker presses "On My Way". Starts customer stream. */
export const startCustomerTracking = startCustomerStream;

/** stopCustomerTracking(bookingId) — worker presses "Start Job". Stops customer stream. */
export const stopCustomerTracking = stopCustomerStream;

// Single default export for convenience
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
