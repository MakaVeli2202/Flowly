import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useHeaderHeight } from '@react-navigation/elements';
import { locationAPI } from '../api/location';
import { bookingsAPI } from '../api/bookings';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');
const LOCATION_POLL_INTERVAL = 8000;

const statusColors = {
  OnTheWay: '#7C3AED',
  InProgress: '#C084FC',
  Completed: '#84CC16',
  Cancelled: '#F87171',
};

export default function LiveWorkerMapScreen({ route, navigation }) {
  const headerHeight = useHeaderHeight();
  const bookingId = route?.params?.bookingId;
  const [workerLocation, setWorkerLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [mapError, setMapError] = useState(false);
  const pollIntervalRef = useRef(null);

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
      setWorkerLocation(location);
      setLastUpdate(new Date());
      if (location.status === 'Completed' || location.status === 'Cancelled') {
        setIsTrackingActive(false);
      }
    } catch (err) {
      if (err?.response?.status !== 404) {
        console.warn('Failed to load worker location:', err);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadBooking();
      await loadWorkerLocation();
      setLoading(false);
    };
    init();
  }, [loadBooking, loadWorkerLocation]);

  useEffect(() => {
    if (booking?.status === 'OnTheWay' || booking?.status === 'InProgress') {
      setIsTrackingActive(true);
      pollIntervalRef.current = setInterval(loadWorkerLocation, LOCATION_POLL_INTERVAL);
    } else {
      setIsTrackingActive(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [booking?.status, loadWorkerLocation]);

  useEffect(() => {
    if (!isTrackingActive) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isTrackingActive]);

  const getStatusLabel = (status) => {
    const statusMap = {
      'Pending': 'Pending',
      'Confirmed': 'Confirmed',
      'OnTheWay': 'On The Way',
      'InProgress': 'In Progress',
      'Completed': 'Completed',
      'Cancelled': 'Cancelled',
      'Paused': 'Paused',
    };
    return statusMap[status] || status;
  };

  const getDistanceText = () => {
    if (!workerLocation || !customerLocation) return null;
    const dx = workerLocation.latitude - customerLocation.latitude;
    const dy = workerLocation.longitude - customerLocation.longitude;
    const distanceKm = Math.sqrt(dx * dx + dy * dy);
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`;
    }
    return `${distanceKm.toFixed(1)}km away`;
  };

  const getEtaText = () => {
    const distance = getDistanceText();
    if (!distance) return null;
    if (distance.includes('m')) {
      return 'Arriving soon';
    }
    const km = parseFloat(distance);
    const minutes = Math.round(km * 3);
    return `${minutes} min away`;
  };

  const renderMapPlaceholder = () => (
    <View style={l.mapContainer}>
      <LinearGradient
        colors={['rgba(15,23,42,0.9)', 'rgba(30,41,59,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      {workerLocation && customerLocation ? (
        <View style={l.mapOverlay}>
          <View style={l.routeContainer}>
            <View style={l.workerMarker}>
              <Ionicons name="car" size={28} color="#7C3AED" />
            </View>
            <View style={l.routeLine} />
            <View style={l.customerMarker}>
              <Ionicons name="location" size={28} color="#22C55E" />
            </View>
          </View>
          <View style={l.mapInfo}>
            <Text style={l.mapInfoText}>
              Worker Location: {workerLocation.latitude.toFixed(5)}, {workerLocation.longitude.toFixed(5)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={l.noLocationContainer}>
          <Ionicons name="location-outline" size={48} color={theme.colors.textMuted} />
          <Text style={l.noLocationText}>
            {booking?.status === 'OnTheWay' 
              ? 'Waiting for location data...'
              : booking?.status === 'InProgress'
              ? 'Worker is at your location'
              : 'No active tracking'}
          </Text>
        </View>
      )}
      <View style={l.mapAttribution}>
        <Ionicons name="map" size={14} color={theme.colors.textMuted} />
        <Text style={l.mapAttributionText}>Map View</Text>
      </View>
    </View>
  );

  const renderTrackingCard = () => (
    <View style={l.trackingCard}>
      <View style={l.trackingHeader}>
        <View style={l.workerInfoRow}>
          <View style={[l.workerAvatar, { backgroundColor: statusColors[booking?.status] || theme.colors.primary }]}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={l.workerName}>Your Detailer</Text>
            <Text style={l.workerStatus}>{getStatusLabel(booking?.status)}</Text>
          </View>
          {isTrackingActive && (
            <View style={l.liveIndicator}>
              <View style={l.liveDot} />
              <Text style={l.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>
      
      {workerLocation && (
        <View style={l.locationInfoCard}>
          <View style={l.locationInfoRow}>
            <Ionicons name="navigate-outline" size={16} color="#7C3AED" />
            <Text style={l.locationInfoText}>Worker is on the way</Text>
          </View>
          {getDistanceText() && (
            <View style={l.etaContainer}>
              <Text style={l.etaText}>{getEtaText()}</Text>
              <Text style={l.distanceText}>{getDistanceText()}</Text>
            </View>
          )}
        </View>
      )}

      {booking?.status === 'Completed' && (
        <View style={l.completedCard}>
          <Ionicons name="checkmark-circle" size={24} color="#84CC16" />
          <Text style={l.completedText}>Job Completed</Text>
          <Text style={l.completedSubtext}>Worker has finished the service</Text>
        </View>
      )}

      {booking?.status === 'Cancelled' && (
        <View style={[l.completedCard, { backgroundColor: 'rgba(248,113,113,0.1)' }]}>
          <Ionicons name="close-circle" size={24} color="#F87171" />
          <Text style={[l.completedText, { color: '#F87171' }]}>Job Cancelled</Text>
          <Text style={l.completedSubtext}>This service has been cancelled</Text>
        </View>
      )}
    </View>
  );

  const renderBookingInfo = () => (
    <View style={l.bookingInfoCard}>
      <Text style={l.sectionTitle}>Booking Details</Text>
      <View style={l.bookingDetailRow}>
        <Text style={l.bookingDetailLabel}>Booking</Text>
        <Text style={l.bookingDetailValue}>{booking?.bookingNumber}</Text>
      </View>
      <View style={l.bookingDetailRow}>
        <Text style={l.bookingDetailLabel}>Service</Text>
        <Text style={l.bookingDetailValue}>
          {(booking?.items || []).map(i => i.packageName).join(', ') || 'Detailing Service'}
        </Text>
      </View>
      <View style={l.bookingDetailRow}>
        <Text style={l.bookingDetailLabel}>Address</Text>
        <Text style={l.bookingDetailValue} numberOfLines={2}>
          {booking?.customerAddress || 'Location TBD'}
        </Text>
      </View>
      {lastUpdate && (
        <View style={l.lastUpdateRow}>
          <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
          <Text style={l.lastUpdateText}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[l.container, { paddingTop: headerHeight }]}>
        <View style={l.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={l.loadingText}>Loading tracking data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={l.container}>
      <View style={l.header}>
        <TouchableOpacity style={l.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={l.headerTitleContainer}>
          <Text style={l.headerTitle}>Live Tracking</Text>
          <Text style={l.headerSubtitle}>
            {getStatusLabel(booking?.status)}
          </Text>
        </View>
        <View style={l.headerRight}>
          <View style={[l.statusDot, { backgroundColor: statusColors[booking?.status] || theme.colors.textMuted }]} />
        </View>
      </View>

      <View style={l.mapPlaceholderWrapper}>
        {renderMapPlaceholder()}
      </View>

      <View style={l.bottomSheet}>
        {renderTrackingCard()}
        {booking && renderBookingInfo()}
      </View>
    </View>
  );
}

const l = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mapPlaceholderWrapper: {
    flex: 1,
    minHeight: 200,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  routeContainer: {
    alignItems: 'center',
    gap: 20,
  },
  workerMarker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 3,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLine: {
    width: 3,
    height: 80,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
  },
  customerMarker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 3,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapInfo: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapInfoText: {
    color: '#fff',
    fontSize: 12,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  noLocationText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  mapAttribution: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mapAttributionText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  bottomSheet: {
    backgroundColor: theme.colors.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    marginTop: -20,
  },
  trackingCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  trackingHeader: {
    marginBottom: 12,
  },
  workerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  workerStatus: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },
  liveText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '800',
  },
  locationInfoCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationInfoText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  etaText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  distanceText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  completedCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  completedText: {
    color: '#84CC16',
    fontSize: 18,
    fontWeight: '800',
  },
  completedSubtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  bookingInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookingDetailLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  bookingDetailValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  lastUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  lastUpdateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
});