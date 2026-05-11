/**
 * AdminDashboardScreen — mobile-first "wake up and understand everything in 5 seconds" screen.
 *
 * Sections:
 *   1. Hero header  — date, greeting, live status pulse
 *   2. Daily overview — today's booking KPIs (total / pending / active / completed)
 *   3. Revenue summary — today + weekly snapshot
 *   4. Operational status — workers on duty, available, active jobs
 *   5. Alerts panel — unassigned, cancellations, reschedules, payment issues
 *   6. Quick actions — create booking, today dispatch, all jobs, workers, reports
 *
 * Data sources: bookingsAPI.getAll(), authAPI.getWorkers(), reportsAPI.getDashboardSummary()
 * All existing APIs are reused without modification.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { bookingsAPI } from '../api/bookings';
import { authAPI } from '../api/auth';
import { locationAPI } from '../api/location';
import { reportsAPI } from '../api/reports';
import { subscribeToNotifications } from '../api/notificationBus';
import realtimeService from '../api/realtimeService';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';
import StatsCard from '../components/StatsCard';
import AlertsPanel from '../components/AlertsPanel';
import ActionButtonPanel from '../components/ActionButtonPanel';

// ─── Brand palette helpers ──────────────────────────────────────────────────
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

// ─── Status color map ────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Pending:    '#FBBF24',
  Confirmed:  '#60A5FA',
  InProgress: '#C084FC',
  Completed:  '#84CC16',
  Cancelled:  '#F87171',
};

// ─── Pure date helpers ────────────────────────────────────────────────────────
const toLocalDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const extractDateKey = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : toLocalDateKey(d);
};

const weekStart = () => {
  const d  = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  d.setHours(0, 0, 0, 0);
  return toLocalDateKey(d);
};

// ─── Visual helpers ───────────────────────────────────────────────────────────
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const SectionHeader = ({ icon, title, sub, color = theme.colors.primary }) => (
  <View style={h.row}>
    <View style={[h.iconBox, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={h.title}>{title}</Text>
      {!!sub && <Text style={h.sub}>{sub}</Text>}
    </View>
  </View>
);

// ─── Pulse dot (live indicator) ───────────────────────────────────────────────
function PulseDot({ color = '#22C55E' }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale]);

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: `${color}30`, transform: [{ scale }] }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ─── Revenue mini-bar ─────────────────────────────────────────────────────────
function RevenueTrendBar({ days = [], maxRevenue = 1 }) {
  if (!days.length) return null;
  const todayKey = toLocalDateKey(new Date());
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 3 }}>
      {days.map((d) => {
        const pct     = Math.max(0.05, d.revenue / (maxRevenue || 1));
        const isToday = d.key === todayKey;
        return (
          <View key={d.key} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
            <LinearGradient
              colors={isToday ? [G(1), G(0.4)] : [T(0.75), T(0.15)]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={{ width: '100%', height: `${Math.round(pct * 100)}%`, borderRadius: 3, minHeight: 3 }}
            />
            <Text style={{ fontSize: 8, color: isToday ? theme.colors.primary : theme.colors.textMuted, fontWeight: isToday ? '800' : '600' }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Worker availability row ───────────────────────────────────────────────────
function WorkerRow({ worker, isOnDuty }) {
  const { t } = useTranslation();
  const color = isOnDuty ? '#C084FC' : '#22C55E';
  return (
    <View style={wr.row}>
      <View style={[wr.dot, { backgroundColor: color }]} />
      <Text style={wr.name} numberOfLines={1}>{worker.firstName} {worker.lastName}</Text>
      <Text style={[wr.status, { color }]}>{isOnDuty ? t('adminDashboard.workers.onJob') : t('adminDashboard.workers.available')}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const [bookings,        setBookings]        = useState([]);
  const [workers,         setWorkers]         = useState([]);
  const [dashSummary,     setDashSummary]     = useState(null);
  const [liveWorkers,     setLiveWorkers]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [lastRefreshed,   setLastRefreshed]   = useState(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [bkData, wkData, summaryData, liveData] = await Promise.allSettled([
        bookingsAPI.getAll(),
        authAPI.getWorkers(),
        reportsAPI.getDashboardSummary(),
        locationAPI.getLiveWorkers(),
      ]);
      if (bkData.status === 'fulfilled')       setBookings(bkData.value || []);
      if (wkData.status === 'fulfilled')       setWorkers(wkData.value || []);
      if (summaryData.status === 'fulfilled')  setDashSummary(summaryData.value || null);
      if (liveData && liveData.status === 'fulfilled') setLiveWorkers(liveData.value || []);
      setLastRefreshed(new Date());
    } catch { /* silent — individual settled failures handled above */ }
  }, []);

  useEffect(() => {
    const run = async () => { setLoading(true); await loadAll(); setLoading(false); };
    run();
  }, [loadAll]);


  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  // ── Real-time booking event listener ────────────────────────────────────────
  useEffect(() => {
    const BOOKING_EVENTS = new Set([
      'NewBooking', 'BookingConfirmed', 'BookingCancelled', 'BookingStatusChanged',
      'JobStarted', 'JobCompleted', 'BookingReassigned', 'BookingClaimed', 'BookingUnassigned',
    ]);
    const onNotif = (notif) => {
      if (BOOKING_EVENTS.has(notif?.type)) loadAll();
    };
    return subscribeToNotifications(onNotif);
  }, [loadAll]);

  // ── Live worker map stream (admin) ─────────────────────────────────────────
  useEffect(() => {
    realtimeService.subscribeToAllAdminLocations();
    const unsub = realtimeService.onLocationUpdate((payload) => {
      const workerId = Number(payload?.workerId);
      const latitude = Number(payload?.latitude ?? payload?.lat);
      const longitude = Number(payload?.longitude ?? payload?.lng);
      if (!Number.isFinite(workerId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      setLiveWorkers((prev) => {
        const idx = prev.findIndex((w) => Number(w.workerId) === workerId);
        const next = {
          workerId,
          workerName: prev[idx]?.workerName || t('adminDashboard.workers.workerId', { id: workerId }),
          latitude,
          longitude,
          timestamp: payload?.timestamp || new Date().toISOString(),
          status: payload?.status || prev[idx]?.status || t('adminDashboard.workers.live'),
          currentBooking: prev[idx]?.currentBooking || null,
        };
        if (idx === -1) return [...prev, next];
        const clone = [...prev];
        clone[idx] = { ...clone[idx], ...next };
        return clone;
      });
    });
    return () => { unsub(); };
  }, [t]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const todayBookings = useMemo(
    () => bookings.filter((b) => extractDateKey(b.scheduledDate) === todayKey),
    [bookings, todayKey]
  );

  const overview = useMemo(() => ({
    total:     todayBookings.length,
    pending:   todayBookings.filter((b) => b.status === 'Pending').length,
    confirmed: todayBookings.filter((b) => b.status === 'Confirmed').length,
    active:    todayBookings.filter((b) => b.status === 'InProgress').length,
    completed: todayBookings.filter((b) => b.status === 'Completed').length,
    cancelled: todayBookings.filter((b) => b.status === 'Cancelled').length,
    revenue:   todayBookings.filter((b) => b.status === 'Completed').reduce((s, b) => s + Number(b.totalAmount || 0), 0),
  }), [todayBookings]);

  // Weekly revenue trend (last 7 days)
  const weeklyTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d   = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const rev = bookings
        .filter((b) => extractDateKey(b.scheduledDate) === key && b.status === 'Completed')
        .reduce((s, b) => s + Number(b.totalAmount || 0), 0);
      const locale = i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('de') ? 'de-DE' : 'en-US';
      days.push({ key, label: d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1), revenue: rev });
    }
    return days;
  }, [bookings, i18n.language]);

  const weekRevenue = useMemo(
    () => weeklyTrend.reduce((s, d) => s + d.revenue, 0),
    [weeklyTrend]
  );

  const maxWeekRevenue = useMemo(
    () => Math.max(...weeklyTrend.map((d) => d.revenue), 1),
    [weeklyTrend]
  );

  // Operational status
  const activeWorkerIds = useMemo(() => new Set(
    todayBookings
      .filter((b) => b.status === 'InProgress' && b.assignedWorkerId)
      .map((b) => String(b.assignedWorkerId))
  ), [todayBookings]);

  const activeWorkers    = useMemo(() => workers.filter((w) => w.isActive && activeWorkerIds.has(String(w.id))), [workers, activeWorkerIds]);
  const availableWorkers = useMemo(() => workers.filter((w) => w.isActive && !activeWorkerIds.has(String(w.id))), [workers, activeWorkerIds]);

  // Alerts
  const alerts = useMemo(() => {
    const list = [];
    const unassigned = todayBookings.filter((b) =>
      !b.assignedWorkerId && b.status !== 'Completed' && b.status !== 'Cancelled'
    );
    if (unassigned.length > 0) {
      list.push({
        id: 'unassigned',
        type: 'warning',
        icon: 'person-outline',
        title: t('adminDashboard.alerts.unassignedTitle', { count: unassigned.length }),
        body: unassigned.map((b) => b.bookingNumber || `#${b.id}`).slice(0, 3).join(', ') + (unassigned.length > 3 ? '…' : ''),
        badge: t('adminDashboard.alerts.unassignedBadge'),
        raw: unassigned,
      });
    }

    const cancellationRequests = bookings.filter((b) => b.cancellationRequested && b.status !== 'Cancelled');
    if (cancellationRequests.length > 0) {
      list.push({
        id: 'cancellations',
        type: 'danger',
        icon: 'close-circle-outline',
        title: t('adminDashboard.alerts.cancellationTitle', { count: cancellationRequests.length }),
        body: cancellationRequests.map((b) => b.customerName).slice(0, 2).join(', ') + (cancellationRequests.length > 2 ? '…' : ''),
        badge: t('adminDashboard.alerts.actionNeededBadge'),
        raw: cancellationRequests,
      });
    }

    const rescheduleRequests = bookings.filter((b) => b.rescheduleRequested);
    if (rescheduleRequests.length > 0) {
      list.push({
        id: 'reschedules',
        type: 'info',
        icon: 'calendar-outline',
        title: t('adminDashboard.alerts.rescheduleTitle', { count: rescheduleRequests.length }),
        body: rescheduleRequests.map((b) => b.customerName).slice(0, 2).join(', ') + (rescheduleRequests.length > 2 ? '…' : ''),
        badge: t('adminDashboard.alerts.reviewBadge'),
        raw: rescheduleRequests,
      });
    }

    const unpaidCompleted = todayBookings.filter(
      (b) => b.status === 'Completed' && b.paymentStatus && b.paymentStatus.toLowerCase() !== 'paid'
    );
    if (unpaidCompleted.length > 0) {
      list.push({
        id: 'payment',
        type: 'danger',
        icon: 'card-outline',
        title: t('adminDashboard.alerts.unpaidCompletedTitle', { count: unpaidCompleted.length }),
        body: t('adminDashboard.alerts.unpaidCompletedBody'),
        badge: t('adminDashboard.alerts.paymentIssueBadge'),
        raw: unpaidCompleted,
      });
    }

    return list;
  }, [bookings, t, todayBookings]);

  // Quick actions
  const quickActions = useMemo(() => [
    {
      id: 'new-booking',
      icon: 'add-circle-outline',
      label: t('adminDashboard.quickActions.newBooking'),
      primary: true,
      onPress: () => navigation.navigate('Create Booking'),
    },
    {
      id: 'today-dispatch',
      icon: 'radio-outline',
      label: t('adminDashboard.quickActions.todaysJobs'),
      color: '#C084FC',
      badge: overview.active > 0 ? overview.active : undefined,
      onPress: () => navigation.navigate('Today Jobs'),
    },
    {
      id: 'all-jobs',
      icon: 'briefcase-outline',
      label: t('adminDashboard.quickActions.allJobs'),
      color: '#60A5FA',
      badge: overview.pending > 0 ? overview.pending : undefined,
      onPress: () => navigation.navigate('All Jobs'),
    },
    {
      id: 'workers',
      icon: 'people-outline',
      label: t('adminDashboard.quickActions.workers'),
      color: '#34D399',
      onPress: () => navigation.navigate('Worker Management'),
    },
    {
      id: 'reports',
      icon: 'bar-chart-outline',
      label: t('adminDashboard.quickActions.reports'),
      color: theme.colors.primary,
      onPress: () => navigation.navigate('Admin Reports'),
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      label: t('adminDashboard.quickActions.notifications'),
      color: '#FB923C',
      onPress: () => navigation.navigate('Admin Notifications'),
    },
  ], [navigation, overview.active, overview.pending, t]);

  // Greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('adminDashboard.greeting.morning');
    if (h < 17) return t('adminDashboard.greeting.afternoon');
    return t('adminDashboard.greeting.evening');
  }, [t]);

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar' : i18n.language?.startsWith('de') ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    [i18n.language]
  );

  const lastRefreshedLabel = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : null;

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={s.loadingText}>{t('adminDashboard.loading')}</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      {/* ── Fixed hero header ─────────────────────────────────────────────────── */}
      <View style={[s.hero, { paddingTop: insets.top + 14 }]}>
        {/* Top gradient tint */}
        <LinearGradient
          colors={[G(0.06), T(0.04), 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={s.heroLeft}>
          <View style={s.eyebrow}>
            <PulseDot color={overview.active > 0 ? '#C084FC' : '#22C55E'} />
            <Text style={s.eyebrowText}>
              {overview.active > 0 ? t('adminDashboard.hero.liveCount', { count: overview.active }) : t('adminDashboard.hero.operationsCenter')}
            </Text>
          </View>
          <Text style={s.heroTitle}>{greeting}</Text>
          <Text style={s.heroDate}>{dateLabel}</Text>
        </View>

        <View style={s.heroRight}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <Ionicons name="refresh-outline" size={18} color={theme.colors.primary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => navigation.navigate('Admin Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={18} color={theme.colors.primary} />
            {alerts.length > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{alerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
            onPress={() => navigation.openDrawer()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <SpectrumLine />

      {/* ── Scrollable body ────────────────────────────────────────────────────── */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={[s.scrollBody, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 1 — Daily Overview (today's booking KPIs)
        ──────────────────────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            icon="today-outline"
            title={t('adminDashboard.sections.todaysOverview')}
            sub={t('adminDashboard.sections.scheduledBookings', { count: overview.total })}
          />
          {/* 2×2 KPI grid */}
          <View style={s.kpiGrid}>
            <StatsCard
              icon="calendar-outline"
              label={t('adminDashboard.stats.totalToday')}
              value={overview.total}
              color={theme.colors.primary}
            />
            <StatsCard
              icon="flash-outline"
              label={t('adminDashboard.stats.inProgress')}
              value={overview.active}
              color="#C084FC"
              sub={overview.active > 0 ? t('adminDashboard.stats.jobsRunningNow') : t('adminDashboard.stats.noneActive')}
            />
            <StatsCard
              icon="hourglass-outline"
              label={t('adminDashboard.stats.pending')}
              value={overview.pending + overview.confirmed}
              color="#FBBF24"
              sub={overview.pending > 0 ? t('adminDashboard.stats.unconfirmed', { count: overview.pending }) : t('adminDashboard.stats.allConfirmed')}
            />
            <StatsCard
              icon="checkmark-circle-outline"
              label={t('adminDashboard.stats.completed')}
              value={overview.completed}
              color="#84CC16"
              sub={overview.cancelled > 0 ? t('adminDashboard.stats.cancelled', { count: overview.cancelled }) : undefined}
            />
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 2 — Revenue Summary
        ──────────────────────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            icon="cash-outline"
            title={t('adminDashboard.sections.revenue')}
            sub={t('adminDashboard.sections.completedOnly')}
            color={theme.colors.primary}
          />

          {/* Today's revenue — full width large card */}
          <StatsCard
            icon="cash-outline"
            label={t('adminDashboard.stats.todaysRevenue')}
            value={formatQAR(overview.revenue)}
            color={theme.colors.primary}
            size="lg"
            sub={t('adminDashboard.stats.jobsCompleted', { count: overview.completed })}
          />

          {/* Weekly snapshot card */}
          <View style={s.revenueWeekCard}>
            {/* Prism top line */}
            <LinearGradient
              colors={['transparent', G(0.70), T(0.55), 'transparent']}
              locations={[0, 0.38, 0.62, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={s.revenueWeekHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.revenueWeekLabel}>{t('adminDashboard.stats.weeklyRevenue')}</Text>
                <Text style={s.revenueWeekValue}>{formatQAR(weekRevenue)}</Text>
              </View>
              {/* Summary from API if available */}
              {dashSummary?.weeklyRevenue != null && (
                <View style={s.revenuePill}>
                  <Ionicons name="trending-up" size={12} color={theme.colors.success} />
                  <Text style={s.revenuePillText}>{formatQAR(dashSummary.weeklyRevenue)}</Text>
                </View>
              )}
            </View>
            <RevenueTrendBar days={weeklyTrend} maxRevenue={maxWeekRevenue} />
            <View style={s.revenueWeekFooter}>
              {weeklyTrend.map((d) => (
                <Text
                  key={d.key}
                  style={[
                    s.revenueWeekDayLabel,
                    d.key === todayKey && { color: theme.colors.primary, fontWeight: '800' },
                  ]}
                >
                  {d.label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 3 — Operational Status
        ──────────────────────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            icon="people-outline"
            title={t('adminDashboard.sections.operationalStatus')}
            sub={t('adminDashboard.sections.activeWorkers', { count: workers.filter((w) => w.isActive).length })}
            color="#34D399"
          />

          {/* Worker status strip */}
          <View style={s.opCard}>
            <LinearGradient
              colors={['transparent', 'rgba(52,211,153,0.65)', 'rgba(52,211,153,0.40)', 'transparent']}
              locations={[0, 0.38, 0.62, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(52,211,153,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Worker counts strip */}
            <View style={s.opStripRow}>
              {[
                { label: t('adminDashboard.workers.onJob'), value: activeWorkers.length, color: '#C084FC' },
                { label: t('adminDashboard.workers.available'), value: availableWorkers.length, color: '#34D399' },
                { label: t('adminDashboard.workers.total'), value: workers.filter((w) => w.isActive).length, color: theme.colors.text },
              ].map(({ label, value, color }, i, arr) => (
                <React.Fragment key={label}>
                  <View style={s.opStripItem}>
                    <Text style={[s.opStripVal, { color }]}>{value}</Text>
                    <Text style={s.opStripLabel}>{label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={s.opStripDivider} />}
                </React.Fragment>
              ))}
            </View>

            {/* Worker list — show first 4 */}
            {workers.filter((w) => w.isActive).length > 0 && (
              <View style={s.workerList}>
                {activeWorkers.slice(0, 2).map((w) => (
                  <WorkerRow key={w.id} worker={w} isOnDuty />
                ))}
                {availableWorkers.slice(0, 2).map((w) => (
                  <WorkerRow key={w.id} worker={w} isOnDuty={false} />
                ))}
                {workers.filter((w) => w.isActive).length > 4 && (
                  <TouchableOpacity
                    style={s.workerMoreBtn}
                    onPress={() => navigation.navigate('Worker Management')}
                    activeOpacity={0.7}
                  >
                    <Text style={s.workerMoreText}>
                      {t('adminDashboard.workers.viewAll', { count: workers.filter((w) => w.isActive).length })}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {workers.filter((w) => w.isActive).length === 0 && (
              <Text style={s.noWorkersText}>{t('adminDashboard.workers.noActiveWorkers')}</Text>
            )}

            {liveWorkers.length > 0 && (
              <View style={s.liveMapWrap}>
                <Text style={s.liveMapTitle}>{t('adminDashboard.workers.liveDetailerMap')}</Text>
                <MapView
                  style={s.liveMap}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={{ latitude: 25.2854, longitude: 51.5310, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
                  showsCompass
                >
                  {liveWorkers.map((w) => (
                    <Marker
                      key={String(w.workerId)}
                      coordinate={{ latitude: Number(w.latitude), longitude: Number(w.longitude) }}
                      title={w.workerName || t('adminDashboard.workers.workerId', { id: w.workerId })}
                      description={`${w.status || t('adminDashboard.workers.live')} · ${new Date(w.timestamp).toLocaleTimeString()}`}
                    >
                      <View style={s.liveWorkerPinOuter}>
                        <View style={s.liveWorkerPinInner}>
                          <Ionicons name="car-sport" size={13} color="#111827" />
                        </View>
                      </View>
                    </Marker>
                  ))}
                </MapView>
              </View>
            )}
          </View>
        </View>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 4 — Alerts & Issues
        ──────────────────────────────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              icon="warning-outline"
              title={t('adminDashboard.sections.alertsIssues')}
              sub={t('adminDashboard.sections.requiresAttention')}
              color={theme.colors.warning}
            />
            <AlertsPanel
              alerts={alerts}
              onPress={(alert) => {
                // Navigate to All Jobs screen so admin can act
                navigation.navigate('All Jobs');
              }}
              onViewAll={() => navigation.navigate('All Jobs')}
            />
          </View>
        )}

        {/* No alerts — green status */}
        {alerts.length === 0 && (
          <View style={s.section}>
            <View style={s.allClearCard}>
              <LinearGradient
                colors={['rgba(34,197,94,0.06)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={s.allClearTitle}>{t('adminDashboard.alerts.allClearTitle')}</Text>
                <Text style={s.allClearSub}>{t('adminDashboard.alerts.allClearSub')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 5 — Quick Actions
        ──────────────────────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            icon="flash-outline"
            title={t('adminDashboard.sections.quickActions')}
            color={theme.colors.primary}
          />
          <ActionButtonPanel
            actions={quickActions}
            columns={3}
          />
        </View>

        {/* ─────────────────────────────────────────────────────────────────────
            Status distribution mini-bar (full bookings history)
        ──────────────────────────────────────────────────────────────────────── */}
        {bookings.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              icon="pie-chart-outline"
              title={t('adminDashboard.sections.overallStatus')}
              sub={t('adminDashboard.sections.totalBookings', { count: bookings.length })}
              color={theme.colors.textMuted}
            />
            <View style={s.statusCard}>
              <LinearGradient
                colors={[G(0.04), 'transparent', T(0.03)]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              {/* Segmented bar */}
              <View style={s.segBar}>
                {Object.entries(STATUS_COLOR).map(([status, color]) => {
                  const count = bookings.filter((b) => b.status === status).length;
                  if (!count) return null;
                  return (
                    <View key={status} style={[s.segSlice, { flex: count, backgroundColor: color + 'CC' }]} />
                  );
                })}
              </View>
              {/* Legend */}
              <View style={s.segLegend}>
                {Object.entries(STATUS_COLOR).map(([status, color]) => {
                  const count = bookings.filter((b) => b.status === status).length;
                  if (!count) return null;
                  return (
                    <View key={status} style={s.segLegendItem}>
                      <View style={[s.segDot, { backgroundColor: color }]} />
                      <Text style={s.segText}>{status} {count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Last refreshed label */}
        {lastRefreshedLabel && (
          <Text style={s.lastRefreshed}>Updated {lastRefreshedLabel} · auto-refreshes every 30s</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Section header styles ────────────────────────────────────────────────────
const h = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});

// ─── Worker row styles ────────────────────────────────────────────────────────
const wr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },

  /* Hero header */
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: theme.colors.bg,
    overflow: 'hidden',
  },
  heroLeft: {
    flex: 1,
    gap: 3,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  eyebrowText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  heroDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryBg,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  scrollBody: {
    paddingTop: 8,
  },

  /* Section wrapper */
  section: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },

  /* KPI 2×2 grid */
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  /* Revenue week card */
  revenueWeekCard: {
    marginTop: 8,
    backgroundColor: theme.card.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    overflow: 'hidden',
  },
  revenueWeekHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  revenueWeekLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  revenueWeekValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  revenuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.successBg,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  revenuePillText: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  revenueWeekFooter: {
    flexDirection: 'row',
    marginTop: 4,
  },

  /* Operational card */
  opCard: {
    backgroundColor: theme.card.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
    overflow: 'hidden',
  },
  opStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  opStripItem: {
    flex: 1,
    alignItems: 'center',
  },
  opStripVal: {
    fontSize: 22,
    fontWeight: '900',
  },
  opStripLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  opStripDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  workerList: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  workerMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
  },
  workerMoreText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  noWorkersText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },

  liveMapWrap: {
    marginHorizontal: 14,
    marginBottom: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: 'rgba(17,24,39,0.12)',
  },
  liveMapTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  liveMap: {
    height: 190,
    width: '100%',
  },
  liveWorkerPinOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#111827',
    backgroundColor: 'rgba(17,24,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveWorkerPinInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* All clear card */
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.successBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    padding: 14,
    overflow: 'hidden',
  },
  allClearTitle: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  allClearSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },

  /* Status distribution */
  statusCard: {
    backgroundColor: theme.card.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    overflow: 'hidden',
  },
  segBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 1,
    marginBottom: 10,
  },
  segSlice: {
    height: '100%',
  },
  segLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  segText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },

  /* Last refreshed label */
  lastRefreshed: {
    color: theme.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    opacity: 0.6,
  },

  revenueWeekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 8,
    color: theme.colors.textMuted,
  },
});
