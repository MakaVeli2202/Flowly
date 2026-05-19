// MySubscriptionScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { subscriptionsAPI } from '../api/subscriptions';
import { theme } from '../theme/theme';

const PADDING = 20;
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: PADDING, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: { marginBottom: 20 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowLine: { flex: 1, height: 1 },
  eyebrowText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary, letterSpacing: 2, marginHorizontal: 8 },
  heading: { fontSize: 26, fontWeight: '800', color: theme.colors.heading, marginBottom: 4 },
  sub: { fontSize: 14, color: theme.colors.muted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionDivider: { flex: 1, height: 1, marginLeft: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 12, fontWeight: '500' },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.heading, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: theme.colors.muted },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  btnPrimary: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnSecondaryText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  dangerBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  dangerBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  planIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statBox: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginHorizontal: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: theme.colors.heading },
  statLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
});

const TIER_COLORS = {
  Basic: '#94a3b8',
  Smart: '#c8a96b',
  Premium: '#0ea5a0',
  Starter: '#6b7280',
  Pro: '#c8a96b',
  Elite: '#0ea5a0',
};

export default function MySubscriptionScreen() {
  const navigation = useNavigation();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await subscriptionsAPI.getMy();
      setSub(data ?? null);
    } catch (err) {
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.message || 'Failed to load subscription.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You will lose your discount benefits on future bookings.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await subscriptionsAPI.cancelPlan();
              setSub(null);
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to cancel. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const tierName = sub?.planName || 'Plan';
  const tierColor = TIER_COLORS[tierName] || theme.colors.primary;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (error) {
    return (
      <View style={[s.center, { padding: 20 }]}>
        <View style={s.card}>
          <Ionicons name="alert-circle" size={40} color="#ef4444" style={{ textAlign: 'center', marginBottom: 12 }} />
          <Text style={[s.cardTitle, { textAlign: 'center' }]}>Error</Text>
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity style={s.btnPrimary} onPress={loadData}>
            <Text style={s.btnPrimaryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!sub) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <View style={s.pageHeader}>
          <View style={s.eyebrow}>
            <LinearGradient colors={['transparent', G(0.5)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
            <Text style={s.eyebrowText}>ACCOUNT</Text>
            <LinearGradient colors={[G(0.5), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          </View>
          <Text style={s.heading}>My Subscription</Text>
        </View>

        <View style={[s.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <View style={[s.planIcon, { backgroundColor: `${tierColor}20`, borderWidth: 1, borderColor: `${tierColor}40` }]}>
            <Ionicons name="repeat" size={24} color={tierColor} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.heading, marginBottom: 8 }}>No Active Subscription</Text>
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            Subscribe to get exclusive discounts on every booking.
          </Text>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('SubscriptionPlans')}>
            <Text style={s.btnPrimaryText}>View Plans →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const discountPct = sub.discountPercent || 0;
  const statusColor = sub.isActive ? '#10b981' : '#ef4444';
  const statusBg = sub.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.pageHeader}>
        <View style={s.eyebrow}>
          <LinearGradient colors={['transparent', G(0.5)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          <Text style={s.eyebrowText}>ACCOUNT</Text>
          <LinearGradient colors={[G(0.5), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
        </View>
        <Text style={s.heading}>My Subscription</Text>
      </View>

      {/* Plan Card */}
      <View style={s.card}>
        <View style={[s.badge, { backgroundColor: statusBg, alignSelf: 'flex-start' }]}>
          <Text style={[s.badgeText, { color: statusColor }]}>{sub.isActive ? 'Active' : 'Inactive'}</Text>
        </View>

        <View style={[s.planIcon, { backgroundColor: `${tierColor}20`, borderWidth: 1, borderColor: `${tierColor}40` }]}>
          <Ionicons name="repeat" size={24} color={tierColor} />
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.heading, marginBottom: 4 }}>{tierName}</Text>
        <Text style={{ fontSize: 15, color: theme.colors.muted, marginBottom: 16 }}>{discountPct}% off every booking</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{discountPct}%</Text>
            <Text style={s.statLabel}>Discount</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{sub.bookingCount || 0}</Text>
            <Text style={s.statLabel}>Bookings</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{sub.maxBookings || '∞'}</Text>
            <Text style={s.statLabel}>Max/Month</Text>
          </View>
        </View>

        <LinearGradient colors={[G(0.08), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 2, borderRadius: 1 }} />
      </View>

      {/* Benefits */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Your Benefits</Text>
        <View style={{ marginTop: 12 }}>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={s.rowLabel}>Exclusive Discount</Text>
            </View>
            <Text style={{ fontWeight: '700', color: '#10b981' }}>{discountPct}% OFF</Text>
          </View>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={s.rowLabel}>Priority Booking</Text>
            </View>
            <Text style={s.rowValue}>Available</Text>
          </View>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={s.rowLabel}>Flexible Scheduling</Text>
            </View>
            <Text style={s.rowValue}>Included</Text>
          </View>
        </View>
      </View>

      {/* Plan Details */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Plan Details</Text>
        <View style={{ marginTop: 12 }}>
          <View style={s.row}><Text style={s.rowLabel}>Plan Name</Text><Text style={s.rowValue}>{sub.planName}</Text></View>
          <View style={s.row}><Text style={s.rowLabel}>Status</Text><Text style={{ ...s.rowValue, color: statusColor }}>{sub.isActive ? 'Active' : 'Inactive'}</Text></View>
          <View style={s.row}><Text style={s.rowLabel}>Discount</Text><Text style={{ ...s.rowValue, color: '#10b981' }}>{discountPct}%</Text></View>
          {sub.startDate && <View style={s.row}><Text style={s.rowLabel}>Started</Text><Text style={s.rowValue}>{new Date(sub.startDate).toLocaleDateString()}</Text></View>}
          {sub.nextBillingDate && <View style={s.row}><Text style={s.rowLabel}>Next Billing</Text><Text style={s.rowValue}>{new Date(sub.nextBillingDate).toLocaleDateString()}</Text></View>}
          {sub.monthlyPrice && <View style={s.row}><Text style={s.rowLabel}>Monthly Price</Text><Text style={s.rowValue}>{sub.monthlyPrice} QAR</Text></View>}
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.navigate('SubscriptionPlans')}>
        <Text style={s.btnSecondaryText}>Upgrade Plan →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('SubscriptionBooking')}>
        <Text style={s.btnPrimaryText}>Book Now →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.dangerBtn} disabled={cancelling} onPress={handleCancel}>
        {cancelling ? <ActivityIndicator size="small" color="#ef4444" /> : <Text style={s.dangerBtnText}>Cancel Subscription</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}