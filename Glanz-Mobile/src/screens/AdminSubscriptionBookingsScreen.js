// AdminSubscriptionBookingsScreen.js — Mobile version of AdminSubscriptionBookings.jsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { subscriptionsAPI } from '../api/subscriptions';
import { theme } from '../theme/theme';

const PADDING = 20;
const STATUS_OPTIONS = ['Pending', 'Confirmed', 'InProgress', 'Completed', 'Cancelled'];

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const STATUS_COLORS = {
  Pending:   { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  Confirmed: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  InProgress:{ bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  Completed: { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  Cancelled: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
};

/* ── Visual primitives ──────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
    pointerEvents="none"
  />
);

const PrismLeftBar = ({ color }) => (
  <LinearGradient
    colors={color === 'green' ? [T(0.90), T(0.55), 'transparent'] : [G(0.90), G(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 }}
    pointerEvents="none"
  />
);

/* ── Atoms ──────────────────────────────────────────────── */
const Eyebrow = ({ children }) => (
  <View style={u.eyebrow}>
    <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
    <Text style={u.eyebrowText}>{children}</Text>
    <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
  </View>
);

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function AdminSubscriptionBookingsScreen() {
  const headerHeight = useHeaderHeight();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = async (st = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionsAPI.getAllBookings(st ? { status: st } : {});
      setBookings(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const handleStatusFilter = (v) => {
    setStatusFilter(v);
    load(v);
  };

  const toggleExpand = (id) => {
    setExpandedId(exp => exp === id ? null : id);
    setEditForm({});
  };

  const handleUpdate = async (id) => {
    setUpdatingId(id);
    try {
      const updated = await subscriptionsAPI.updateBooking(id, editForm);
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
      setExpandedId(null);
      setEditForm({});
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update booking.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Eyebrow>ADMIN PANEL</Eyebrow>
          <View style={s.titleRow}>
            <LinearGradient colors={[G(0.14), T(0.09)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titleIconBox}>
              <Ionicons name="repeat-outline" size={18} color={theme.colors.primary} />
            </LinearGradient>
            <Text style={s.heading}>Subscription Bookings</Text>
          </View>
          <Text style={s.sub}>Manage recurring booking appointments</Text>
          <SpectrumLine style={{ marginTop: 14 }} />
        </View>

        {/* ── Error banner ───────────────────────────────── */}
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Status filter ──────────────────────────────── */}
        <View style={s.filterRow}>
          <TouchableOpacity style={[s.filterBtn, statusFilter === '' && s.filterBtnActive]} onPress={() => handleStatusFilter('')}>
            <Text style={[s.filterText, statusFilter === '' && s.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {STATUS_OPTIONS.map(st => (
            <TouchableOpacity key={st} style={[s.filterBtn, statusFilter === st && s.filterBtnActive]} onPress={() => handleStatusFilter(st)}>
              <Text style={[s.filterText, statusFilter === st && s.filterTextActive]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Empty state ──────────────────────────────── */}
        {bookings.length === 0 ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={[G(0.44), T(0.30)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIconRingOuter}>
              <View style={s.emptyIconRingInner}>
                <Ionicons name="calendar-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            <Text style={s.emptyTitle}>No bookings found</Text>
            <Text style={s.emptyBody}>Subscription bookings will appear here</Text>
          </View>
        ) : (
          /* ── Bookings list ──────────────────────────────── */
          bookings.map((booking) => {
            const st = booking.status || 'Pending';
            const colors = STATUS_COLORS[st] || STATUS_COLORS.Pending;
            const expanded = expandedId === booking.id;

            return (
              <View key={booking.id} style={s.bookingCard}>
                <PrismTopLine />
                <PrismLeftBar />
                <LinearGradient
                  colors={[G(0.05), 'transparent', T(0.03)]}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />

                <TouchableOpacity onPress={() => toggleExpand(booking.id)}>
                  <View style={s.bookingHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.bookingId}>#{booking.bookingNumber}</Text>
                      <Text style={s.bookingCustomer}>{booking.customerName}</Text>
                      <View style={s.bookingMeta}>
                        <Ionicons name="calendar-outline" size={11} color={theme.colors.textMuted} />
                        <Text style={s.bookingMetaText}>{booking.scheduledDate}</Text>
                        <Text style={s.bookingMetaDot}>·</Text>
                        <Text style={s.bookingMetaText}>{booking.timeSlot}</Text>
                      </View>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[s.statusBadgeText, { color: colors.color }]}>{st}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* ── Expanded details ──────────────────── */}
                {expanded && (
                  <View style={s.bookingDetails}>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Email</Text>
                      <Text style={s.detailValue}>{booking.customerEmail}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Phone</Text>
                      <Text style={s.detailValue}>{booking.customerPhone}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Address</Text>
                      <Text style={s.detailValue}>{booking.customerAddress}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Amount</Text>
                      <Text style={s.detailValue}>QAR {booking.totalAmount?.toLocaleString()}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Subscription</Text>
                      <Text style={s.detailValue}>{booking.subscriptionName || 'N/A'}</Text>
                    </View>
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Vehicle</Text>
                      <Text style={s.detailValue}>{booking.vehicleType}</Text>
                    </View>

                    {/* ── Status update ────────────────────── */}
                    <Text style={s.editLabel}>Update Status</Text>
                    <View style={s.statusRow}>
                      {STATUS_OPTIONS.map(stOpt => (
                        <TouchableOpacity
                          key={stOpt}
                          style={[s.statusBtn, editForm.status === stOpt && s.statusBtnActive, { backgroundColor: STATUS_COLORS[stOpt]?.bg }]}
                          onPress={() => setEditForm(p => ({ ...p, status: stOpt }))}
                        >
                          <Text style={[s.statusBtnText, editForm.status === stOpt && { color: STATUS_COLORS[stOpt]?.color }]}>{stOpt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={s.detailActions}>
                      <TouchableOpacity style={s.cancelBtn} onPress={() => toggleExpand(booking.id)} activeOpacity={0.75}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <View style={[s.updateBtnWrap, updatingId === booking.id && s.updateBtnDisabled]}>
                        <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                        <TouchableOpacity style={s.updateBtnTouch} onPress={() => handleUpdate(booking.id)} disabled={updatingId === booking.id} activeOpacity={0.85}>
                          {updatingId === booking.id ? (
                            <ActivityIndicator size="small" color={theme.colors.ink} />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done" size={14} color={theme.colors.ink} />
                              <Text style={s.updateBtnText}>Update</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

/* ── Shared atoms ─────────────────────────────────────────── */
const u = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  eyebrowLine: { height: 1, width: 24 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  pageHeader: { marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  titleIconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G(0.30) },
  heading: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 14 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, backgroundColor: 'rgba(127,29,29,0.24)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', borderRadius: 12, padding: 12 },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 12 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  filterBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: theme.colors.ink },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 20, backgroundColor: 'rgba(19,27,37,0.8)', gap: 12 },
  emptyIconRingOuter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  bookingCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 12, overflow: 'hidden' },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bookingId: { color: theme.colors.primary, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  bookingCustomer: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  bookingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookingMetaText: { color: theme.colors.textMuted, fontSize: 11 },
  bookingMetaDot: { color: theme.colors.textMuted, fontSize: 11 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  bookingDetails: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 12, paddingTop: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { color: theme.colors.textMuted, fontSize: 12 },
  detailValue: { color: theme.colors.text, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
  editLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  statusBtnActive: { borderColor: theme.colors.border },
  statusBtnText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  updateBtnWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  updateBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  updateBtnDisabled: { opacity: 0.55 },
  updateBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 13 },
});