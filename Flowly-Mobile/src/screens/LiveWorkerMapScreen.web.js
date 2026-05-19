import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { locationAPI } from '../api/location';
import { bookingsAPI } from '../api/bookings';
import { theme } from '../theme/theme';

function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export default function LiveWorkerMapScreenWeb({ route, navigation }) {
  const bookingId = route?.params?.bookingId;

  const [workerLocation, setWorkerLocation] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!bookingId) {
      setError('Missing booking ID.');
      setLoading(false);
      return;
    }

    try {
      setError('');
      const [bookingData, locationData] = await Promise.all([
        bookingsAPI.getByBookingNumber(bookingId).catch(() => null),
        locationAPI.getLocation(bookingId).catch(() => null),
      ]);

      setBooking(bookingData);
      if (locationData?.latitude && locationData?.longitude) {
        setWorkerLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
      }
    } catch {
      setError('Failed to load tracking data.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openInMaps = useCallback(async () => {
    if (!workerLocation) return;
    const url = buildMapsUrl(workerLocation.latitude, workerLocation.longitude);
    try {
      await Linking.openURL(url);
    } catch {
      setError('Unable to open maps.');
    }
  }, [workerLocation]);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={s.muted}>Loading tracking data...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Live Tracking</Text>
      </View>

      <View style={s.card}>
        <View style={s.row}>
          <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
          <Text style={s.infoText}>Map rendering is available in iOS/Android app. Web shows location details.</Text>
        </View>

        {booking?.bookingNumber ? (
          <Text style={s.item}>Booking: {booking.bookingNumber}</Text>
        ) : null}

        {workerLocation ? (
          <>
            <Text style={s.item}>Latitude: {workerLocation.latitude}</Text>
            <Text style={s.item}>Longitude: {workerLocation.longitude}</Text>
            <TouchableOpacity style={s.primaryButton} onPress={openInMaps}>
              <Text style={s.primaryButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={s.muted}>Worker location is not available yet.</Text>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 13,
  },
  item: {
    color: theme.colors.text,
    fontSize: 14,
  },
  muted: {
    color: theme.colors.textMuted,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    marginTop: 6,
    color: '#F87171',
    fontSize: 13,
  },
});
