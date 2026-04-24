// ─── WorkerSalesScreen.js ─────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { offersAPI } from '../api/offers';
import { packagesAPI } from '../api/packages';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const PADDING = 20;

/* ── Palette ──────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Prism plain styles ──────────────────────────────────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
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

/* ── SectionLabel — icon + text + gradient line ───────────── */
/*
  Gradient line extends to the right of the label text,
  replacing the previous layout where sectionLabel had flex: 1.
*/
const SectionLabel = ({ children, icon }) => (
  <View style={s.sectionRow}>
    {!!icon && <Ionicons name={icon} size={14} color={theme.colors.primary} />}
    <Text style={s.sectionLabel}>{children}</Text>
    <LinearGradient
      colors={['transparent', G(0.55)]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={s.sectionDivider}
    />
  </View>
);

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function WorkerSalesScreen() {
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();

  const [offers,     setOffers]     = useState([]);
  const [packages,   setPackages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = async () => {
    try {
      setError('');
      const [offersData, packagesData] = await Promise.all([
        offersAPI.getAll(),
        packagesAPI.getAll(),
      ]);
      setOffers(offersData    || []);
      setPackages(packagesData || []);
    } catch { setError('Failed to load sales material.'); }
  };

  useEffect(() => {
    const run = async () => { setLoading(true); await load(); setLoading(false); };
    run();
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const activeOffers = useMemo(() => {
    const now = new Date();
    return offers.filter((o) => {
      if (!o.isActive) return false;
      if (o.startsAt && new Date(o.startsAt) > now) return false;
      if (o.endsAt   && new Date(o.endsAt)   < now) return false;
      return true;
    });
  }, [offers]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      onScroll={scrollHeader.onScroll}
      scrollEventThrottle={scrollHeader.scrollEventThrottle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      {/* ── Page header ────────────────────────────────────── */}
      <View style={s.pageHeader}>
        <View style={s.eyebrow}>
          <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          <Ionicons name="briefcase-outline" size={10} color={theme.colors.primary} />
          <Text style={s.eyebrowText}>SALES KIT</Text>
          <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
        </View>
        <Text style={s.heading}>Sales Kit</Text>
        <Text style={s.sub}>
          Show this screen to customers during a visit to introduce available services, upgrades, and active offers.
        </Text>
        <SpectrumLine style={{ marginTop: 12 }} />
      </View>

      {/* ── Error ──────────────────────────────────────────── */}
      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Subscription placeholder ───────────────────────── */}
      {/*
        Uses an amber-toned top line instead of the standard gold-teal
        PrismTopLine to stay cohesive with the card's yellow #FBBF24 palette.
      */}
      <View style={s.subCard}>
        <LinearGradient
          colors={['transparent', 'rgba(251,191,36,0.65)', 'rgba(251,191,36,0.40)', 'transparent']}
          locations={[0, 0.38, 0.62, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={prismStyles.topLine}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(251,191,36,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={s.subCardHeader}>
          <View style={s.subIconBox}>
            <Ionicons name="calendar-outline" size={18} color="#FBBF24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.subCardEyebrow}>Coming Soon</Text>
            <Text style={s.subCardTitle}>Monthly Subscription</Text>
          </View>
        </View>
        <Text style={s.subCardBody}>
          Subscription plans are being prepared for the next release. You can introduce the idea to interested customers — they'll be able to subscribe directly through the app once it launches.
        </Text>
        <View style={s.subCardBadge}>
          <Ionicons name="construct-outline" size={11} color="#FBBF24" />
          <Text style={s.subCardBadgeText}>Placeholder — not yet active in backend</Text>
        </View>
      </View>

      {/* ── Active offers ──────────────────────────────────── */}
      <SectionLabel icon="pricetag-outline">Current Offers</SectionLabel>
      {activeOffers.length === 0 ? (
        <View style={s.emptyWrap}>
          <PrismTopLine />
          <Ionicons name="pricetag-outline" size={22} color={theme.colors.textMuted} />
          <Text style={s.emptyText}>No active offers right now.</Text>
        </View>
      ) : (
        activeOffers.map((offer) => (
          <View key={offer.id} style={s.offerCard}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={s.offerTopRow}>
              <Text style={s.offerName}>{offer.name}</Text>
              <View style={s.activePill}>
                <View style={s.activeDot} />
                <Text style={s.activePillText}>Active</Text>
              </View>
            </View>
            <Text style={s.offerDesc}>{offer.description || 'Promotion available now.'}</Text>
            {offer.code ? (
              <View style={s.offerCodeRow}>
                <Ionicons name="barcode-outline" size={13} color={theme.colors.textMuted} />
                <Text style={s.offerCodeLabel}>Code</Text>
                <Text style={s.offerCode}>{offer.code}</Text>
              </View>
            ) : (
              <View style={s.offerCodeRow}>
                <Ionicons name="gift-outline" size={13} color={theme.colors.textMuted} />
                <Text style={s.offerCodeLabel}>Auto-generated / loyalty reward</Text>
              </View>
            )}
          </View>
        ))
      )}

      {/* ── Packages ───────────────────────────────────────── */}
      <SectionLabel icon="cube-outline">Recommended Packages</SectionLabel>
      {packages.length === 0 ? (
        <View style={s.emptyWrap}>
          <PrismTopLine />
          <Ionicons name="cube-outline" size={22} color={theme.colors.textMuted} />
          <Text style={s.emptyText}>No packages available.</Text>
        </View>
      ) : (
        packages.map((pkg) => (
          <View key={pkg.id} style={s.pkgCard}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Name + tier badge */}
            <View style={s.pkgHeader}>
              <Text style={s.pkgName}>{pkg.name}</Text>
              {/* Tier badge — gradient fill replaces flat primary */}
              <View style={s.pkgTierBadge}>
                <LinearGradient
                  colors={[theme.colors.primary, G(0.82)]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={s.pkgTierText}>{pkg.tier}</Text>
              </View>
            </View>
            {!!pkg.description && (
              <Text style={s.pkgDesc}>{pkg.description}</Text>
            )}
            {/* Price + duration */}
            <View style={s.pkgFooter}>
              <Text style={s.pkgPrice}>{formatQAR(pkg.price)}</Text>
              <View style={s.pkgDurationPill}>
                <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                <Text style={s.pkgDuration}>{pkg.estimatedDurationMinutes} min</Text>
              </View>
            </View>
            {/* Services — inner card gets its own PrismTopLine */}
            {(pkg.services || []).length > 0 && (
              <View style={s.pkgServices}>
                <PrismTopLine />
                <Text style={s.pkgServicesLabel}>Includes</Text>
                {(pkg.services || []).map((svc, i) => (
                  <View key={i} style={s.pkgServiceRow}>
                    <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} />
                    <Text style={s.pkgServiceText}>{svc.serviceName || svc.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  /* Header */
  pageHeader:  { marginBottom: 20 },
  eyebrow:     { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 12 },
  eyebrowLine: { height: 1, width: 22 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  heading:     { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sub:         { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },

  /* Error */
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14, backgroundColor: 'rgba(127,29,29,0.24)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', borderRadius: 12, padding: 10 },
  errorText:   { color: '#FCA5A5', flex: 1, fontSize: 12 },

  /* SectionLabel — sectionLabel no longer has flex: 1; sectionDivider does */
  sectionRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionLabel:   { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  sectionDivider: { flex: 1, height: 1, marginLeft: 4, borderRadius: 1 },

  /* Subscription placeholder card — overflow:'hidden' for amber top line */
  subCard:        { borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.25)', borderRadius: 18, backgroundColor: 'rgba(251,191,36,0.04)', padding: 16, marginBottom: 20, overflow: 'hidden' },
  subCardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  subIconBox:     { width: 38, height: 38, borderRadius: 10, flexShrink: 0, backgroundColor: 'rgba(251,191,36,0.12)', alignItems: 'center', justifyContent: 'center' },
  subCardEyebrow: { color: '#FBBF24', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  subCardTitle:   { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  subCardBody:    { color: theme.colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  subCardBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  subCardBadgeText:{ color: '#FBBF24', fontSize: 10, fontWeight: '700' },

  /* Empty state rows — overflow:'hidden' for PrismTopLine */
  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 14, overflow: 'hidden' },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },

  /* Offer cards — overflow:'hidden' required */
  offerCard:      { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16, marginBottom: 12, overflow: 'hidden' },
  offerTopRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  offerName:      { color: theme.colors.text, fontWeight: '900', fontSize: 17, flex: 1 },
  activePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.10)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  activeDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10B981' },
  activePillText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  offerDesc:      { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  offerCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offerCodeLabel: { color: theme.colors.textMuted, fontSize: 12 },
  offerCode:      { color: theme.colors.primary, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  /* Package cards — overflow:'hidden' required */
  pkgCard:   { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16, marginBottom: 12, overflow: 'hidden' },
  pkgHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  pkgName:   { color: theme.colors.text, fontWeight: '900', fontSize: 17, flex: 1 },

  /* Tier badge — overflow:'hidden' clips the gradient */
  pkgTierBadge: { borderRadius: 20, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  pkgTierText:  { color: theme.colors.ink, fontWeight: '800', fontSize: 11 },

  pkgDesc:        { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  pkgFooter:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pkgPrice:       { color: theme.colors.primary, fontWeight: '900', fontSize: 22 },
  pkgDurationPill:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  pkgDuration:    { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },

  /* Services inner card — overflow:'hidden' for PrismTopLine */
  pkgServices:      { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', padding: 10, overflow: 'hidden' },
  pkgServicesLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  pkgServiceRow:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  pkgServiceText:   { color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
});