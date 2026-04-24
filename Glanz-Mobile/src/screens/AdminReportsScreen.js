import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { reportsAPI } from '../api/reports';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const TAB = { FINANCIAL: 'financial', OPERATIONAL: 'operational' };

const RANGES = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null },
];

function getDateRange(days) {
  if (!days) return { startDate: null, endDate: null };
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate:   end.toISOString().split('T')[0],
  };
}

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

function KpiCard({ label, value, icon, color, sub }) {
  return (
    <View style={[k.card, { borderColor: `${color}30` }]}>
      <View style={[k.iconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={k.label}>{label}</Text>
      <Text style={[k.value, { color }]}>{value}</Text>
      {!!sub && <Text style={k.sub}>{sub}</Text>}
    </View>
  );
}

const k = StyleSheet.create({
  card: {
    flex: 1, minWidth: '45%', backgroundColor: theme.card.bg,
    borderRadius: theme.radius.lg, borderWidth: 1,
    padding: 14, gap: 4,
  },
  iconBox: { width: 36, height: 36, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontSize: 20, fontWeight: '800' },
  sub:   { color: theme.colors.textMuted, fontSize: 11 },
});

function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export default function AdminReportsScreen() {
  const headerHeight = useHeaderHeight();

  const [tab,        setTab]       = useState(TAB.FINANCIAL);
  const [rangeIdx,   setRangeIdx]  = useState(1); // default 30d
  const [financial,  setFinancial] = useState(null);
  const [operational,setOp]        = useState(null);
  const [loading,    setLoading]   = useState(false);
  const [refreshing, setRefreshing]= useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const { startDate, endDate } = getDateRange(RANGES[rangeIdx].days);
    try {
      if (tab === TAB.FINANCIAL) {
        setFinancial(await reportsAPI.getFinancial(startDate, endDate));
      } else {
        setOp(await reportsAPI.getOperational(startDate, endDate));
      }
    } catch {
      Alert.alert('Error', 'Failed to load report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, rangeIdx]);

  useEffect(() => { load(); }, [load]);

  const data = tab === TAB.FINANCIAL ? financial : operational;

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.pageHeader}>
        <View style={s.pageIconBox}>
          <Ionicons name="bar-chart" size={20} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>Reports</Text>
          <Text style={s.pageSubtitle}>Analytics & performance</Text>
        </View>
      </View>

      <SpectrumLine style={{ marginBottom: 18 }} />

      {/* Tab switcher */}
      <View style={s.tabs}>
        {[TAB.FINANCIAL, TAB.OPERATIONAL].map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={t === TAB.FINANCIAL ? 'cash-outline' : 'analytics-outline'}
              size={15}
              color={tab === t ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === TAB.FINANCIAL ? 'Financial' : 'Operational'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Range selector */}
      <View style={s.rangeRow}>
        {RANGES.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            style={[s.rangeChip, rangeIdx === i && s.rangeChipActive]}
            onPress={() => setRangeIdx(i)}
            activeOpacity={0.75}
          >
            <Text style={[s.rangeText, rangeIdx === i && s.rangeTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadBox}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : !data ? null : tab === TAB.FINANCIAL ? (
        <FinancialReport data={data} />
      ) : (
        <OperationalReport data={data} />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function FinancialReport({ data }) {
  return (
    <>
      <SectionTitle>Revenue Overview</SectionTitle>
      <View style={s.kpiGrid}>
        <KpiCard label="Total Revenue"  value={formatQAR(data.totalRevenue ?? 0)}  icon="cash"            color={theme.colors.primary} />
        <KpiCard label="Total Cost"     value={formatQAR(data.totalCost ?? 0)}     icon="cart-outline"    color="#EF4444" />
        <KpiCard label="Gross Profit"   value={formatQAR(data.grossProfit ?? 0)}   icon="trending-up"     color="#22c55e" />
        <KpiCard label="Profit Margin"  value={`${(data.profitMargin ?? 0).toFixed(1)}%`} icon="pie-chart" color="#8b5cf6" />
      </View>

      <SectionTitle>Booking Financials</SectionTitle>
      <View style={s.kpiGrid}>
        <KpiCard label="Bookings"       value={String(data.totalBookings ?? 0)}    icon="calendar"        color={theme.colors.info} />
        <KpiCard label="Avg Order Value" value={formatQAR(data.averageOrderValue ?? 0)} icon="receipt-outline" color="#0EA5A0" />
        <KpiCard label="Refunded"       value={formatQAR(data.totalRefunded ?? 0)} icon="return-down-back" color={theme.colors.warning} />
        <KpiCard label="Waived"         value={formatQAR(data.totalWaived ?? 0)}   icon="close-circle-outline" color="#94a3b8" />
      </View>

      {(data.paymentMethodBreakdown || []).length > 0 && (
        <>
          <SectionTitle>Payment Methods</SectionTitle>
          {data.paymentMethodBreakdown.map((pm, i) => (
            <View key={i} style={s.rowCard}>
              <Text style={s.rowLabel}>{pm.method}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rowValue}>{formatQAR(pm.amount)}</Text>
                <Text style={s.rowSub}>{pm.count} booking{pm.count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

function OperationalReport({ data }) {
  return (
    <>
      <SectionTitle>Booking Status</SectionTitle>
      <View style={s.kpiGrid}>
        <KpiCard label="Total"      value={String(data.totalBookings ?? 0)}     icon="calendar"          color={theme.colors.info} />
        <KpiCard label="Completed"  value={String(data.completedBookings ?? 0)} icon="checkmark-circle"  color="#22c55e" />
        <KpiCard label="Cancelled"  value={String(data.cancelledBookings ?? 0)} icon="close-circle"      color="#EF4444" />
        <KpiCard label="Completion" value={`${(data.completionRate ?? 0).toFixed(1)}%`} icon="trending-up" color={theme.colors.primary} />
      </View>

      <SectionTitle>Capacity & Efficiency</SectionTitle>
      <View style={s.kpiGrid}>
        <KpiCard label="Avg Duration" value={`${Math.round(data.averageDurationMinutes ?? 0)} min`} icon="time-outline" color="#8b5cf6" />
        <KpiCard label="Utilisation"  value={`${(data.workerUtilizationRate ?? 0).toFixed(1)}%`}    icon="people-outline" color="#0EA5A0" />
        <KpiCard label="Pending"      value={String(data.pendingBookings ?? 0)}  icon="hourglass-outline" color={theme.colors.warning} />
        <KpiCard label="In Progress"  value={String(data.inProgressBookings ?? 0)} icon="flash-outline"   color="#60A5FA" />
      </View>

      {(data.topServices || []).length > 0 && (
        <>
          <SectionTitle>Top Services</SectionTitle>
          {data.topServices.map((svc, i) => (
            <View key={i} style={s.rowCard}>
              <View style={s.rankBadge}><Text style={s.rankText}>{i + 1}</Text></View>
              <Text style={[s.rowLabel, { flex: 1 }]}>{svc.serviceName}</Text>
              <Text style={s.rowValue}>{svc.bookingCount} jobs</Text>
            </View>
          ))}
        </>
      )}

      {(data.workerPerformance || []).length > 0 && (
        <>
          <SectionTitle>Worker Performance</SectionTitle>
          {data.workerPerformance.map((w, i) => (
            <View key={i} style={s.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{w.workerName}</Text>
                <Text style={s.rowSub}>{w.completedJobs} completed · {(w.completionRate ?? 0).toFixed(0)}%</Text>
              </View>
              <View style={s.ratingBadge}>
                <Ionicons name="star" size={11} color={theme.colors.primary} />
                <Text style={s.ratingText}>{(w.averageRating ?? 0).toFixed(1)}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: theme.colors.bg },
  content:  { paddingHorizontal: 20, paddingBottom: 20 },

  pageHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageIconBox: {
    width: 42, height: 42, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:    { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  pageSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },

  tabs: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
    backgroundColor: theme.card.bg, borderRadius: theme.radius.md,
    padding: 4, borderWidth: 1, borderColor: theme.colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: theme.radius.sm,
  },
  tabActive:     { backgroundColor: theme.colors.primaryBg },
  tabText:       { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: theme.colors.primary, fontWeight: '700' },

  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangeChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.full,
    backgroundColor: theme.card.bg, borderWidth: 1, borderColor: theme.colors.border,
  },
  rangeChipActive: { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primaryBorder },
  rangeText:       { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  rangeTextActive: { color: theme.colors.primary, fontWeight: '700' },

  loadBox:     { alignItems: 'center', paddingVertical: 60 },
  sectionTitle:{ color: theme.colors.mist, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 20 },
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },

  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.card.bg, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  rowLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  rowValue: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  rowSub:   { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },

  rankBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: G(0.14), alignItems: 'center', justifyContent: 'center',
  },
  rankText:  { color: theme.colors.primary, fontSize: 11, fontWeight: '800' },
  ratingBadge: {
    flexDirection: 'row', gap: 3, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.full,
    backgroundColor: G(0.10), borderWidth: 1, borderColor: G(0.22),
  },
  ratingText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
});
