import { useState, useCallback, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, AppState } from 'react-native';
import { locationAPI } from '../api/location';
import realtimeService from '../api/realtimeService';
import { onForceStop, onRevokeTracking } from '../api/realtimeService';

// How often to poll the device GPS (read side — unchanged)
const LOCATION_UPDATE_INTERVAL = 8_000; // ms

// Throttle: only SEND an update if moved ≥ MIN_DISTANCE_METERS OR
// ≥ MIN_TIME_BETWEEN_SENDS ms has elapsed since the last successful send.
const MIN_DISTANCE_METERS    = 20;
const MIN_TIME_BETWEEN_SENDS = 10_000; // ms

/** Haversine distance in metres between two {latitude, longitude} points. */
function _distanceMetres(a, b) {
  if (!a || !b) return Infinity;
  const R  = 6_371_000;
  const φ1 = (a.latitude  * Math.PI) / 180;
  const φ2 = (b.latitude  * Math.PI) / 180;
  const Δφ = ((b.latitude  - a.latitude)  * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Sends a location update via WebSocket (preferred) with HTTP fallback.
 * For the admin stream the bookingId is null — the server uses workerId from auth.
 */
async function _sendAdminLocation(lat, lng) {
  const sent = await realtimeService.updateAdminLocation(lat, lng);
  // HTTP fallback is not needed for admin stream (no bookingId available here);
  // the hub is the source of truth for the live map.
  return sent;
}

async function _sendCustomerLocation(bookingId, lat, lng) {
  const sent = await realtimeService.updateCustomerLocation(bookingId, lat, lng);
  if (!sent) {
    // WebSocket not connected — fall back to HTTP so the DB record stays current
    await locationAPI.updateLocation(bookingId, lat, lng).catch(() => {});
  }
}

export function useLocationTracking() {
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [currentLocation,   setCurrentLocation]   = useState(null);
  const [locationError,     setLocationError]      = useState(null);
  const [hasPermission,     setHasPermission]      = useState(null);

  const trackingRef         = useRef(null);  // interval ID
  const currentBookingIdRef = useRef(null);
  const customerStreamRef   = useRef(false); // true when customer stream is active
  const lastSentLocRef      = useRef(null);  // { latitude, longitude } last sent
  const lastSentAtRef       = useRef(0);     // timestamp ms of last send
  const isTrackingRef       = useRef(false); // strict guard — prevents double-start
  const forceStoppedRef     = useRef(false); // set by admin ForceStop — blocks restart until remount

  // ── Permission ────────────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location services to track your position for customers.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch {
      setLocationError('Failed to request location permission');
      return false;
    }
  }, []);

  // ── Get current device position ───────────────────────────────────────────
  const getCurrentLocation = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
      };
      setCurrentLocation(coords);
      return loc;
    } catch {
      setLocationError('Failed to get current location');
      return null;
    }
  }, []);

  // ── Admin ForceStop / RevokeTracking listener ────────────────────────────
  useEffect(() => {
    const stopImmediate = () => {
      forceStoppedRef.current = true;
      isTrackingRef.current   = false;
      customerStreamRef.current = false;
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
      setIsLocationSharing(false);
    };
    const unsubForce  = onForceStop(stopImmediate);
    const unsubRevoke = onRevokeTracking(stopImmediate);
    return () => { unsubForce(); unsubRevoke(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start admin tracking (always-on, starts at login) ────────────────────
  const startTracking = useCallback(async (bookingId = null) => {
    if (isTrackingRef.current) return true;
    if (forceStoppedRef.current) return false; // blocked until fresh login

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    try {
      const loc = await getCurrentLocation();
      if (!loc) return false;

      if (bookingId) currentBookingIdRef.current = bookingId;
      isTrackingRef.current       = true;
      lastSentLocRef.current      = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      lastSentAtRef.current       = Date.now();

      setIsLocationSharing(true);
      setLocationError(null);

      // Initial admin location send
      await _sendAdminLocation(loc.coords.latitude, loc.coords.longitude);

      trackingRef.current = setInterval(async () => {
        if (!isTrackingRef.current) return;
        try {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = {
            latitude:  currentLoc.coords.latitude,
            longitude: currentLoc.coords.longitude,
          };
          setCurrentLocation({ ...coords, timestamp: currentLoc.timestamp });

          // Throttle: only send if moved enough OR time exceeded
          const moved   = _distanceMetres(lastSentLocRef.current, coords);
          const elapsed = Date.now() - lastSentAtRef.current;
          if (moved < MIN_DISTANCE_METERS && elapsed < MIN_TIME_BETWEEN_SENDS) return;

          lastSentLocRef.current = coords;
          lastSentAtRef.current  = Date.now();

          // Always send to admin stream
          await _sendAdminLocation(coords.latitude, coords.longitude);

          // Also send to customer stream when it is active (En Route phase)
          if (customerStreamRef.current && currentBookingIdRef.current) {
            await _sendCustomerLocation(currentBookingIdRef.current, coords.latitude, coords.longitude);
          }
        } catch { /* silent */ }
      }, LOCATION_UPDATE_INTERVAL);

      return true;
    } catch {
      setLocationError('Failed to start location tracking');
      setIsLocationSharing(false);
      isTrackingRef.current = false;
      return false;
    }
  }, [hasPermission, requestPermission, getCurrentLocation]);

  // ── Customer stream lifecycle (En Route → Start Job) ─────────────────────

  /** Call when worker presses "On My Way". Starts customer-visible tracking. */
  const startCustomerTracking = useCallback(async (bookingId) => {
    customerStreamRef.current   = true;
    currentBookingIdRef.current = bookingId;
    // Notify hub and customer group that En Route has started
    await realtimeService.startCustomerStream(bookingId);
  }, []);

  /** Call when worker presses "Start Job". Stops customer-visible tracking. */
  const stopCustomerTracking = useCallback(async (bookingId) => {
    customerStreamRef.current = false;
    // Notify hub and customer group that job is now In Progress
    await realtimeService.stopCustomerStream(bookingId);
  }, []);

  // ── Stop admin tracking (on logout / unmount) ─────────────────────────────
  const stopTracking = useCallback(async () => {
    if (!isTrackingRef.current && !trackingRef.current) return;

    isTrackingRef.current     = false;
    customerStreamRef.current = false;

    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }

    const bookingId = currentBookingIdRef.current;
    currentBookingIdRef.current = null;
    lastSentLocRef.current      = null;
    lastSentAtRef.current       = 0;

    setIsLocationSharing(false);

    if (bookingId) {
      await locationAPI.stopLocation(bookingId).catch(() => {});
    }
  }, []);

  const toggleLocationSharing = useCallback(async (bookingId) => {
    if (isLocationSharing) await stopTracking();
    else                   await startTracking(bookingId);
  }, [isLocationSharing, startTracking, stopTracking]);

  // ── App foreground return: refresh display position ───────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isTrackingRef.current) {
        getCurrentLocation();
      }
      // Intentionally keep interval alive in background — workers may background
      // the app mid-job, and fleet tracking must remain continuous.
    });

    return () => {
      sub.remove();
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
        isTrackingRef.current = false;
      }
    };
  }, [getCurrentLocation]);

  return {
    isLocationSharing,
    currentLocation,
    locationError,
    hasPermission,
    startTracking,
    stopTracking,
    startCustomerTracking,
    stopCustomerTracking,
    toggleLocationSharing,
    requestPermission,
    getCurrentLocation,
  };
}

export default useLocationTracking;