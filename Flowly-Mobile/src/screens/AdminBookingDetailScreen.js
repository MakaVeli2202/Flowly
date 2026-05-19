import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { bookingsAPI } from '../api/bookings';

export default function AdminBookingDetailScreen({ route }) {
  const { t } = useTranslation();
  const { handleScroll, headerStyle, headerOpacity } = useScrollHeader();
  const { bookingId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (bookingId) loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      const data = await bookingsAPI.getById(bookingId);
      setBooking(data);
    } catch {
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
        <Text style={styles.emptyText}>{t('admin.bookings.notFound', 'Booking not found')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.title, { opacity: headerOpacity }]}>{t('admin.bookingDetail.title', 'Booking Details')}</Text>
      </View>

      <ScrollView style={styles.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.bookingDetail.info', 'Booking Info')}</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.number', 'Booking #')}</Text><Text style={styles.value}>{booking.bookingNumber}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.status', 'Status')}</Text><Text style={[styles.value, { color: theme.colors.primary }]}>{booking.status}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.date', 'Date')}</Text><Text style={styles.value}>{new Date(booking.scheduledDate).toLocaleDateString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.time', 'Time')}</Text><Text style={styles.value}>{booking.timeSlot}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.vehicle', 'Vehicle')}</Text><Text style={styles.value}>{booking.vehicleType}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.total', 'Total')}</Text><Text style={styles.value}>${booking.totalAmount?.toFixed(2)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.bookingDetail.customer', 'Customer')}</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.name', 'Name')}</Text><Text style={styles.value}>{booking.customerName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.email', 'Email')}</Text><Text style={styles.value}>{booking.customerEmail}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.bookingDetail.phone', 'Phone')}</Text><Text style={styles.value}>{booking.customerPhone}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.bookingDetail.address', 'Address')}</Text>
          <View style={styles.card}>
            <Text style={styles.addressText}>{booking.address}</Text>
          </View>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 15, marginTop: 12 },
  section: { paddingHorizontal: 20, paddingTop: 120, marginBottom: 16 },
  sectionTitle: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  label: { color: theme.colors.textMuted, fontSize: 14 },
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  addressText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  footer: { height: 100 },
});
