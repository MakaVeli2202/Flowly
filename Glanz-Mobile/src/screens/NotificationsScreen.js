// ─── NotificationsScreen.js ───────────────────────────────────────────────────
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../api/notifications';
import { offersAPI } from '../api/offers';
import { subscribeToNotifications } from '../api/notificationBus';
import { theme } from '../theme/theme';
import { formatDateTime } from '../utils/dateUtils';

const PAGE_SIZE = 20;
const TYPE_CONFIG = {
  // Booking lifecycle
  NewBooking:            { label: 'New Booking',          icon: 'calendar',         color: theme.colors.primary },
  BookingConfirmed:      { label: 'Booking Confirmed',    icon: 'checkmark-circle', color: '#10B981' },
  BookingCancelled:      { label: 'Booking Cancelled',    icon: 'close-circle',     color: '#EF4444' },
  BookingStatusChanged:  { label: 'Booking Update',       icon: 'information-circle',color: '#60A5FA' },
  BookingReassigned:     { label: 'Worker Reassigned',    icon: 'swap-horizontal',  color: '#F59E0B' },
  BookingAssigned:       { label: 'Worker Assigned',      icon: 'person-add',       color: '#10B981' },
  BookingClaimed:        { label: 'Worker Assigned',      icon: 'person-add',       color: '#10B981' },
  BookingUnassigned:     { label: 'Worker Unassigned',    icon: 'person-remove',    color: '#F59E0B' },
  CancellationRequested: { label: 'Cancellation Request', icon: 'alert-circle',     color: '#EF4444' },
  RescheduleRequested:   { label: 'Reschedule Request',   icon: 'calendar-outline', color: '#F59E0B' },
  // Worker updates
  WorkerArrived:         { label: 'Detailer Arrived',     icon: 'car',              color: '#10B981' },
  WorkerRunningLate:     { label: 'Detailer Running Late',icon: 'time',             color: '#F59E0B' },
  // Job status
  JobStarted:            { label: 'Service Started',      icon: 'play-circle',      color: theme.colors.primary },
  JobPaused:             { label: 'Service Paused',       icon: 'pause-circle',     color: '#94A3B8' },
  JobResumed:            { label: 'Service Resumed',      icon: 'refresh-circle',   color: theme.colors.primary },
  JobCompleted:          { label: 'Service Completed',    icon: 'checkmark-circle', color: '#10B981' },
  ServiceAdded:          { label: 'Service Added',        icon: 'add-circle',       color: '#10B981' },
  // Offers & rewards
  SpecialOffer:          { label: 'Special Offer',        icon: 'pricetag',         color: '#F59E0B' },
  OfferAssigned:         { label: 'New Offer',            icon: 'gift',             color: '#F59E0B' },
  LoyaltyReward:         { label: 'Loyalty Reward',       icon: 'star',             color: theme.colors.primary },
  // Admin only
  LowStock:              { label: 'Low Stock Alert',      icon: 'warning',          color: '#EF4444' },
};
const FALLBACK_CONFIG = { label: 'Notification', icon: 'notifications', color: theme.colors.primary };
const shouldShowBookingReference = (type) => type !== 'JobPaused' && type !== 'JobResumed';

/* ── Palette ─────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Prism plain styles — safe to reference before s ──────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Primitives ─────────────────────────────────────────── */
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
    style={prismStyles.topLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={prismStyles.leftBar}
    pointerEvents="none"
  />
);

/* ── EmptyState — gradient ring icon ───────────────────────── */
const EmptyState = ({ icon, title, body }) => (
  <View style={s.emptyWrap}>
    <LinearGradient
      colors={[G(0.44), T(0.30)]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.emptyIconRingOuter}
    >
      <View style={s.emptyIconRingInner}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
    </LinearGradient>
    <Text style={s.emptyTitle}>{title}</Text>
    <Text style={s.emptyBody}>{body}</Text>
  </View>
);

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function NotificationsScreen() {
  const { isAdmin } = useAuth();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();

  const [notifications, setNotifications] = useState([]);
  const [coupons,       setCoupons]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [limit,         setLimit]         = useState(PAGE_SIZE);
  const [hasMore,       setHasMore]       = useState(false);
  const [error,         setError]         = useState('');
  const [markingId,     setMarkingId]     = useState(null);

  const loadData = useCallback(async (fetchLimit = limit) => {
    try {
      setError('');
      const [notificationData, couponData] = await Promise.all([
        notificationsAPI.getAll(fetchLimit),
        isAdmin ? Promise.resolve([]) : offersAPI.getMyCoupons(),
      ]);
      const items = notificationData || [];
      setNotifications(items);
      setCoupons(couponData || []);
      setHasMore(items.length >= fetchLimit);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load notifications.');
    }
  }, [isAdmin, limit]);

  // Stable ref so subscribeToNotifications always calls the latest loadData without resubscribing
  const _loadRef = useRef(loadData);
  _loadRef.current = loadData;

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const run = async () => {
        if (isMounted) setLoading(true);
        await loadData();
        if (isMounted) setLoading(false);
      };
      run();

      const unsubNotif = subscribeToNotifications(() => {
        Vibration.vibrate([0, 80, 60, 80]);
        _loadRef.current();
      });

      return () => {
        isMounted = false;
        unsubNotif();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLimit(PAGE_SIZE);
    await loadData(PAGE_SIZE);
    setRefreshing(false);
  }, [loadData]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextLimit = limit + PAGE_SIZE;
    setLoadingMore(true);
    setLimit(nextLimit);
    await loadData(nextLimit);
    setLoadingMore(false);
  }, [loadingMore, hasMore, limit, loadData]);

  const markAsRead = async (id) => {
    try {
      setMarkingId(id);
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to mark as read.');
    } finally { setMarkingId(null); }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingId('all');
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to mark all as read.');
    } finally { setMarkingId(null); }
  };

  const handleNotifPress = async (notification, nav) => {
    if (!notification.isRead) markAsRead(notification.id);
    if (notification.bookingId) {
      nav.navigate('My Bookings');
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* ── Page header ────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerText}>
          <View style={s.eyebrow}>
            <LinearGradient
              colors={['transparent', G(0.70)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
            <Ionicons name="notifications-outline" size={10} color={theme.colors.primary} />
            <Text style={s.eyebrowText}>INBOX</Text>
            <LinearGradient
              colors={[G(0.70), 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
          </View>
          <Text style={s.heading}>Notifications</Text>
          <Text style={s.sub}>
            {isAdmin
              ? 'System alerts and booking updates.'
              : 'Arrival alerts, running-late notices, offers and rewards.'}
          </Text>
          <SpectrumLine style={{ marginTop: 12 }} />
        </View>
        {/*
          Unread bubble: LinearGradient provides fill.
          backgroundColor removed from s.unreadBubble.
        */}
        {unreadCount > 0 && (
          <LinearGradient
            colors={[theme.colors.primary, G(0.78)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.unreadBubble}
          >
            <Text style={s.unreadBubbleText}>{unreadCount}</Text>
          </LinearGradient>
        )}
      </View>

      {/* ── Error ──────────────────────────────────────── */}
      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Stats strip ────────────────────────────────── */}
      {/*
        overflow:'hidden' clips PrismTopLine + PrismLeftBar.
        absoluteFillObject gradient renders behind flex children.
      */}
      <View style={s.statsStrip}>
        <PrismTopLine />
        <PrismLeftBar />
        <LinearGradient
          colors={[G(0.05), 'transparent', T(0.03)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={s.statItem}>
          <Text style={s.statNumber}>{notifications.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statNumber, unreadCount > 0 && { color: theme.colors.primary }]}>
            {unreadCount}
          </Text>
          <Text style={s.statLabel}>Unread</Text>
        </View>
        {!isAdmin && (
          <>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>{coupons.length}</Text>
              <Text style={s.statLabel}>Offers</Text>
            </View>
          </>
        )}
        <TouchableOpacity
          style={[s.markAllBtn, (markingId === 'all' || unreadCount === 0) && s.markAllBtnDisabled]}
          onPress={markAllAsRead}
          disabled={markingId === 'all' || unreadCount === 0}
        >
          <Ionicons name="checkmark-done" size={13} color={theme.colors.primary} />
          <Text style={s.markAllText}>
            {markingId === 'all' ? 'Updating…' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Offers — customers only ────────────────────── */}
      {!isAdmin && (
        <View style={s.card}>
          <PrismTopLine />
          <PrismLeftBar />
          <LinearGradient
            colors={[G(0.05), 'transparent', T(0.03)]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={s.cardHeader}>
            <Ionicons name="pricetag" size={18} color={theme.colors.primary} />
            <Text style={s.cardTitle}>Available Offers</Text>
          </View>
          {coupons.length === 0 ? (
            <EmptyState
              icon="pricetag-outline"
              title="No active offers"
              body="Special offers assigned to you will appear here."
            />
          ) : (
            coupons.map((coupon) => (
              /*
                offerCard overflow:'hidden' clips the gold top gradient
                fill to the card's borderRadius.
              */
              <View key={coupon.id} style={s.offerCard}>
                <LinearGradient
                  colors={[G(0.09), 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <View style={s.offerRow}>
                  <View style={s.offerIconBox}>
                    <Ionicons name="gift" size={16} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.offerName}>{coupon.offerName}</Text>
                    <View style={s.offerCodeRow}>
                      <Text style={s.offerCodeLabel}>Code</Text>
                      <Text style={s.offerCode}>{coupon.personalCode}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.offerMeta}>
                  <Text style={s.offerMetaText}>
                    Assigned {formatDateTime(coupon.assignedAt)}
                  </Text>
                  {coupon.expiresAt && (
                    <Text style={[s.offerMetaText, s.offerExpiry]}>
                      Expires {formatDateTime(coupon.expiresAt)}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── Notifications ──────────────────────────────── */}
      <View style={s.card}>
        <PrismTopLine />
        <PrismLeftBar />
        <LinearGradient
          colors={[G(0.05), 'transparent', T(0.03)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={s.cardHeader}>
          <Ionicons name="notifications" size={18} color={theme.colors.primary} />
          <Text style={s.cardTitle}>Recent Alerts</Text>
        </View>
        {notifications.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            body={
              isAdmin
                ? 'System and booking alerts will appear here.'
                : 'When your detailer sends updates or a reward is assigned, it will show here.'
            }
          />
        ) : (
          <>
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] || FALLBACK_CONFIG;
              return (
                <TouchableOpacity
                  key={n.id}
                  activeOpacity={0.7}
                  onPress={() => handleNotifPress(n, navigation)}
                >
                  <View style={[s.notifCard, !n.isRead && s.notifCardUnread]}>
                    {!n.isRead && <PrismTopLine />}
                    {!n.isRead && <View style={s.notifAccent} />}
                    <View style={s.notifBody}>
                      <View style={s.notifTopRow}>
                        <View style={[s.notifIconBox, { backgroundColor: `${cfg.color}18` }]}>
                          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                        </View>
                        <Text style={[s.notifType, { color: cfg.color }]}>{cfg.label}</Text>
                        {!n.isRead && <View style={s.unreadDot} />}
                        <Text style={s.notifTime}>{formatDateTime(n.createdAt)}</Text>
                      </View>
                      <Text style={s.notifMessage}>{n.message}</Text>
                      {n.bookingId && shouldShowBookingReference(n.type) && (
                        <View style={s.bookingRef}>
                          <Ionicons name="bookmark-outline" size={11} color={theme.colors.textMuted} />
                          <Text style={s.bookingRefText}>Booking #{n.bookingId}</Text>
                        </View>
                      )}
                      {!n.isRead && (
                        <TouchableOpacity
                          style={s.readBtn}
                          onPress={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          disabled={markingId === n.id}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="checkmark" size={12} color={theme.colors.primary} />
                          <Text style={s.readBtnText}>
                            {markingId === n.id ? 'Saving…' : 'Mark as read'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {hasMore && (
              <TouchableOpacity
                style={s.loadMoreBtn}
                onPress={loadMore}
                disabled={loadingMore}
                activeOpacity={0.75}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={theme.colors.primary} />
                  : (
                    <>
                      <Ionicons name="chevron-down-circle-outline" size={15} color={theme.colors.primary} />
                      <Text style={s.loadMoreText}>Load more</Text>
                    </>
                  )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const PADDING = 20;
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  /* Page header */
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  headerText:  { flex: 1 },
  eyebrow:     { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 12 },
  eyebrowLine: { height: 1, width: 22 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  heading:     { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sub:         { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },

  /* Unread bubble — backgroundColor removed; LinearGradient provides fill */
  unreadBubble:     { minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, marginTop: 4 },
  unreadBubbleText: { color: theme.colors.ink, fontWeight: '900', fontSize: 14 },

  /* Error banner */
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },

  /* Stats strip — overflow:'hidden' required */
  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)',
    paddingVertical: 14, paddingHorizontal: 18,
    marginBottom: 14, overflow: 'hidden',
  },
  statItem:    { alignItems: 'center', flex: 1 },
  statNumber:  { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  statLabel:   { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)',
    backgroundColor: 'rgba(200,169,107,0.07)',
  },
  markAllBtnDisabled: { opacity: 0.35 },
  markAllText:        { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },

  /* Section cards — overflow:'hidden' required */
  card: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 16, marginBottom: 14, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardTitle:  { color: theme.colors.text, fontSize: 16, fontWeight: '800', flex: 1 },

  /* Empty state */
  emptyWrap:         { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyIconRingOuter:{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(19,27,37,0.90)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:        { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  emptyBody:         { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 16 },

  /* Offer cards — overflow:'hidden' required */
  offerCard: {
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.2)',
    borderRadius: 14, backgroundColor: 'rgba(200,169,107,0.05)',
    padding: 14, marginBottom: 10, overflow: 'hidden',
  },
  offerRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  offerIconBox:  { width: 34, height: 34, borderRadius: 10, flexShrink: 0, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  offerName:     { color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 6 },
  offerCodeRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offerCodeLabel:{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  offerCode:     { color: theme.colors.primary, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  offerMeta:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerMetaText: { color: theme.colors.textMuted, fontSize: 11 },
  offerExpiry:   { color: '#FCA5A5' },

  /* Notification cards — overflow:'hidden' was already set */
  notifCard: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8, overflow: 'hidden',
  },
  notifCardUnread: { borderColor: 'rgba(200,169,107,0.25)', backgroundColor: 'rgba(200,169,107,0.04)' },
  notifAccent:     { width: 3, backgroundColor: theme.colors.primary, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  notifBody:       { flex: 1, padding: 12 },
  notifTopRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  notifIconBox:    { width: 26, height: 26, borderRadius: 8, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  notifType:       { fontSize: 12, fontWeight: '800', flex: 1 },
  unreadDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.primary },
  notifTime:       { color: theme.colors.textMuted, fontSize: 11 },
  notifMessage:    { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  bookingRef:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  bookingRefText:  { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  readBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 10,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(200,169,107,0.06)',
  },
  readBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },

  /* Load more */
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: 6,
    borderRadius: 12, borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
    backgroundColor: `${theme.colors.primary}08`,
  },
  loadMoreText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});