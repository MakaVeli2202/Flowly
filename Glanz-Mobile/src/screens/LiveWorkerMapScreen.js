import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { locationAPI } from '../api/location';
import { bookingsAPI } from '../api/bookings';
import { theme } from '../theme/theme';
import realtimeService from '../api/realtimeService';

const STATUS_COLORS = {
  OnTheWay:   '#7C3AED',
  InProgress: '#C084FC',
  Completed:  '#84CC16',
  Cancelled:  '#F87171',
};

// Default map region — will be overridden once we have real coords
const DEFAULT_REGION = {
  latitude:       24.7136,
  longitude:      46.6753,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};

export default function LiveWorkerMapScreen({ route, navigation }) {
  const bookingId = route?.params?.bookingId;

  const [workerLocation,   setWorkerLocation]   = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [booking,          setBooking]          = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [lastUpdate,       setLastUpdate]       = useState(null);
  const [pathCoords,       setPathCoords]       = useState([]);  // trail of GPS points

  const mapRef    = useRef(null);
  const unsubRef  = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for live indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const loadBooking = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data = await bookingsAPI.getByBookingNumber(bookingId);
      setBooking(data);
      if (data.status === 'Completed' || data.status === 'Cancelled') {
        setIsTrackingActive(false);
      }
    } catch (err) {
      console.warn('Failed to load booking:', err);
    }
  }, [bookingId]);

  const loadWorkerLocation = useCallback(async () => {
    if (!bookingId) return;
    try {
      const location = await locationAPI.getLocation(bookingId);
      if (location?.latitude && location?.longitude) {
        const coords = { latitude: location.latitude, longitude: location.longitude };
        setWorkerLocation(coords);
        setPathCoords([coords]);
        setLastUpdate(new Date());

        // Centre map on worker
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta:  0.02,
          longitudeDelta: 0.02,
        }, 500);
      }
      if (location?.status === 'Completed' || location?.status === 'Cancelled') {
        setIsTrackingActive(false);
      }
    } catch (err) {
      if (err?.response?.status !== 404) console.warn('Failed to load worker location:', err);
    }
  }, [bookingId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadBooking();
      await loadWorkerLocation();
      setLoading(false);
    };
    init();
  }, [loadBooking, loadWorkerLocation]);

  // WebSocket: subscribe to live customer location stream
  useEffect(() => {
    if (!bookingId) return;

    if (booking?.status === 'OnTheWay') {
      setIsTrackingActive(true);
      realtimeService.subscribeToCustomerLocation(bookingId);

      unsubRef.current = realtimeService.onLocationUpdate((data) => {
        if (!data?.bookingId || String(data.bookingId) !== String(bookingId)) return;

        const lat = data.latitude ?? data.lat;
        const lng = data.longitude ?? data.lng;
        if (!lat || !lng) return;

        const coords = { latitude: lat, longitude: lng };
        setWorkerLocation(coords);
        setLastUpdate(new Date());
        setPathCoords((prev) => [...prev.slice(-49), coords]); // keep last 50 trail points

        // Smoothly pan map to new worker position
        mapRef.current?.animateCamera({ center: coords }, { duration: 400 });
      });
    } else {
      setIsTrackingActive(false);
    }

    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, [booking?.status, bookingId]);

  const getStatusLabel = (status) => {
    const map = {
      Pending: 'Pending', Confirmed: 'Confirmed', OnTheWay: 'On The Way',
      InProgress: 'In Progress', Completed: 'Completed', Cancelled: 'Cancelled',
    };
    return map[status] || status;
  };

  const statusColor = STATUS_COLORS[booking?.status] || theme.colors.primary;

  if (loading) {
    return (
      <View style={[l.container, l.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={l.loadingText}>Loading tracking data...</Text>
      </View>
    );
  }

  return (
    <View style={l.container}>
      {/* Header */}
      <View style={l.header}>
        <TouchableOpacity style={l.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={l.headerCenter}>
          <Text style={l.headerTitle}>Live Tracking</Text>
          <Text style={l.headerSubtitle}>{getStatusLabel(booking?.status)}</Text>
        </View>
        {isTrackingActive && (
          <Animated.View style={[l.livePulse, { transform: [{ scale: pulseAnim }] }]}>
            <View style={l.liveDot} />
          </Animated.View>
        )}
      </View>

      {/* Real Map */}
      <MapView
        ref={mapRef}
        style={l.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* Worker marker */}
        {workerLocation && (
          <Marker
            coordinate={workerLocation}
            title="Worker"
            description={`${getStatusLabel(booking?.status)} · Last update ${lastUpdate?.toLocaleTimeString() ?? ''}`}
          >
            <View style={[l.workerMarkerOuter, { borderColor: statusColor }]}>
              <View style={[l.workerMarkerInner, { backgroundColor: statusColor }]}>
                <Ionicons name="car" size={16} color="#fff" />
              </View>
            </View>
          </Marker>
        )}

        {/* Customer location marker */}
        {customerLocation && (
          <Marker
            coordinate={customerLocation}
            title="Your Location"
          >
            <View style={l.customerMarkerOuter}>
              <View style={l.customerMarkerInner}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </View>
          </Marker>
        )}

        {/* GPS trail polyline */}
        {pathCoords.length > 1 && (
          <Polyline
            coordinates={pathCoords}
            strokeColor={statusColor}
            strokeWidth={3}
            lineDashPattern={[4, 4]}
          />
        )}
      </MapView>

      {/* Bottom card */}
      <View style={l.bottomCard}>
        <View style={l.workerRow}>
          <View style={[l.workerAvatar, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
            <Ionicons name="person" size={18} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={l.workerName}>Your Detailer</Text>
            <Text style={[l.workerStatus, { color: statusColor }]}>{getStatusLabel(booking?.status)}</Text>
          </View>
          {lastUpdate && (
            <View style={l.lastUpdateBadge}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
              <Text style={l.lastUpdateText}>{lastUpdate.toLocaleTimeString()}</Text>
            </View>
          )}
        </View>

        {booking && (
          <View style={l.bookingRow}>
            <Text style={l.bookingLabel}>Booking</Text>
            <Text style={l.bookingValue}>{booking.bookingNumber}</Text>
          </View>
        )}

        {booking?.customerAddress && (
          <View style={l.bookingRow}>
            <Text style={l.bookingLabel}>Address</Text>
            <Text style={l.bookingValue} numberOfLines={2}>{booking.customerAddress}</Text>
          </View>
        )}

        {booking?.status === 'Completed' && (
          <View style={l.completedBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#84CC16" />
            <Text style={l.completedText}>Job Completed</Text>
          </View>
        )}

        {booking?.status === 'Cancelled' && (
          <View style={[l.completedBanner, { backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.2)' }]}>
            <Ionicons name="close-circle" size={20} color="#F87171" />
            <Text style={[l.completedText, { color: '#F87171' }]}>Job Cancelled</Text>
          </View>
        )}

        {!workerLocation && booking?.status === 'OnTheWay' && (
          <View style={l.waitingBanner}>
            <ActivityIndicator size="small" color={statusColor} />
            <Text style={l.waitingText}>Waiting for worker location...</Text>
          </View>
        )}

        {error ? <Text style={l.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const l = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center:    { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.textMuted, marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle:  { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },

  livePulse: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  liveDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C3AED',
  },

  map: { flex: 1 },

  // Worker map marker
  workerMarkerOuter: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 3, borderColor: '#7C3AED',
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C3AED', shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 8,
    elevation: 6,
  },
  workerMarkerInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  // Customer marker
  customerMarkerOuter: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5,
  },
  customerMarkerInner: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
  },

  // Bottom info card
  bottomCard: {
    backgroundColor: theme.colors.panel,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    gap: 10,
  },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workerAvatar: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  workerName:   { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  workerStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  lastUpdateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastUpdateText: { color: theme.colors.textMuted, fontSize: 11 },

  bookingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bookingLabel: { color: theme.colors.textMuted, fontSize: 13, flex: 1 },
  bookingValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },

  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 12, padding: 12,
  },
  completedText: { color: '#84CC16', fontSize: 15, fontWeight: '800' },

  waitingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waitingText:   { color: theme.colors.textMuted, fontSize: 13 },

  errorText: { color: '#F87171', fontSize: 12, textAlign: 'center' },
});
