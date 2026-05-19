// ─── PackagesScreen.js ────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Image, RefreshControl, TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usePackages } from '../context/PackagesContext';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';
import { ListSkeleton, PackageCardSkeleton } from '../components/Skeleton';
import PressableScale from '../components/PressableScale';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { pickLocalizedField, normalizeLangCode } from '../utils/localization';

const PADDING     = 20;
const MAX_VISIBLE = 4;

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

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

/* ── ServicesList ─────────────────────────────────────────── */
function ServicesList({ services = [], isExpanded, onToggle, lang, t }) {
  if (!services.length) return null;
  const hasMore     = services.length > MAX_VISIBLE;
  const visible     = isExpanded ? services : services.slice(0, MAX_VISIBLE);
  const hiddenCount = services.length - MAX_VISIBLE;
  return (
    /* sl.wrap has overflow:'hidden' — clips PrismTopLine to borderRadius */
    <View style={sl.wrap}>
      <PrismTopLine />
      <Text style={sl.label}>{t('packagesScreen.servicesIncluded')}</Text>
      {visible.map((svc, i) => (
        <View key={i} style={sl.row}>
          <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} />
          <Text style={sl.text}>
            {pickLocalizedField(svc, 'serviceName', lang)
              || pickLocalizedField(svc, 'name', lang)
              || svc.serviceName
              || svc.name
              || t('packagesScreen.serviceFallback')}
          </Text>
        </View>
      ))}
      {hasMore && (
        <TouchableOpacity style={sl.toggleBtn} onPress={onToggle} activeOpacity={0.7}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={theme.colors.primary}
          />
          <Text style={sl.toggleText}>
            {isExpanded
              ? t('packagesScreen.showLess')
              : t('packagesScreen.moreServices', { count: hiddenCount })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function PackagesScreen({ navigation }) {
  const { t } = useTranslation();
  const lang = normalizeLangCode(i18n.language);
  const { isAdmin }  = useAuth();
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();
  const {
    packages,
    packagesLoading: loading,
    packagesError:   error,
    fetchPackages,
  } = usePackages();

  const [selectedTier,      setSelectedTier]      = useState('__all__');
  const [expandedPackageId, setExpandedPackageId] = useState(null);
  const [refreshing,        setRefreshing]        = useState(false);

  useEffect(() => { fetchPackages(); }, []);

  const tiers = useMemo(() => ['__all__', ...new Set(packages.map((p) => p.tier))], [packages]);
  const filtered = useMemo(
    () => (selectedTier === '__all__' ? packages : packages.filter((p) => p.tier === selectedTier)),
    [packages, selectedTier]
  );

  const getTierLabel = (tier) => {
    if (tier === '__all__') return t('packagesScreen.tiers.all');
    return t(`packagesScreen.tiers.${tier}`, { defaultValue: tier });
  };

  const toggleExpand = (id) => setExpandedPackageId((prev) => (prev === id ? null : id));

  const onRefresh = async () => {
    setRefreshing(true); await fetchPackages(); setRefreshing(false);
  };

  if (loading) {
    return (
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onScroll={scrollHeader.onScroll}
        scrollEventThrottle={scrollHeader.scrollEventThrottle}
      >
        <View style={{ paddingHorizontal: PADDING }}>
          <ListSkeleton count={5} ItemComponent={PackageCardSkeleton} />
        </View>
      </ScrollView>
    );
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* ── Header ─────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.eyebrow}>
            <LinearGradient
              colors={['transparent', G(0.70)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
            <Ionicons name="cube-outline" size={10} color={theme.colors.primary} />
            <Text style={s.eyebrowText}>{t('packagesScreen.catalogue')}</Text>
            <LinearGradient
              colors={[G(0.70), 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
          </View>
          <Text style={s.heading}>{t('packagesScreen.title')}</Text>
          <Text style={s.sub}>{t('packagesScreen.subtitle')}</Text>
          <SpectrumLine style={{ marginTop: 12 }} />
        </View>
        {/* Count pill — gradient ring technique */}
        <LinearGradient
          colors={[G(0.50), T(0.35)]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.countRingOuter}
        >
          <View style={s.countRingInner}>
            <Text style={s.countText}>{filtered.length}</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Error ──────────────────────────────────────── */}
      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Tier filter ────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400).delay(60)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tierRow}
          style={s.tierScroll}
        >
          {tiers.map((tier) => {
            const active = selectedTier === tier;
            return (
              <PressableScale
                key={tier}
                style={[s.tierChip, active && s.tierChipActive]}
                onPress={() => { setSelectedTier(tier); setExpandedPackageId(null); }}
                activeScale={0.94}
              >
                {active && <View style={s.tierChipDot} />}
                <Text style={[s.tierChipText, active && s.tierChipTextActive]}>{getTierLabel(tier)}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── Empty state ────────────────────────────────── */}
      {filtered.length === 0 && (
        <Animated.View entering={FadeInUp.springify()} style={s.emptyWrap}>
          <LinearGradient
            colors={[G(0.44), T(0.30)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.emptyIconRingOuter}
          >
            <View style={s.emptyIconRingInner}>
              <Ionicons name="cube-outline" size={28} color={theme.colors.primary} />
            </View>
          </LinearGradient>
          <Text style={s.emptyTitle}>{t('packagesScreen.emptyTitle')}</Text>
          <Text style={s.emptyBody}>
            {selectedTier === '__all__'
              ? t('packagesScreen.emptyAll')
              : t('packagesScreen.emptyTier', { tier: getTierLabel(selectedTier) })}
          </Text>
          {selectedTier !== '__all__' && (
            <View style={s.emptyBtnWrap}>
              <LinearGradient
                colors={[theme.colors.primary, G(0.82)]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <PressableScale style={s.emptyBtnTouch} onPress={() => setSelectedTier('__all__')}>
                <Text style={s.emptyBtnText}>{t('packagesScreen.showAll')}</Text>
              </PressableScale>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Package cards ──────────────────────────────── */}
      {filtered.map((pkg, index) => {
        const isExpanded = expandedPackageId === pkg.id;
        return (
          <Animated.View key={pkg.id} entering={FadeInUp.duration(420).delay(index * 80)}>
            {/*
              s.card already has overflow:'hidden'.
              PrismLeftBar shown only when expanded — signals the
              "open" state without adding permanent visual weight.
            */}
            <View style={[s.card, isExpanded && s.cardExpanded]}>
              <PrismTopLine />
              {isExpanded && <PrismLeftBar />}

              {/* Image — LinearGradient scrim replaces flat rgba overlay */}
              <View style={s.imgWrap}>
                <Image
                  source={{ uri: pkg.imageUrl || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400' }}
                  style={s.img}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(13,17,23,0)', 'rgba(13,17,23,0.48)']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <View style={s.tierBadge}>
                  <Text style={s.tierBadgeText}>{getTierLabel(pkg.tier)}</Text>
                </View>
                <View style={s.priceTag}>
                  <Text style={s.priceTagLabel}>{t('packagesScreen.startingAt')}</Text>
                  <Text style={s.priceTagText}>{formatQAR(pkg.price)}</Text>
                </View>
              </View>

              {/* Body */}
              <View style={s.body}>
                <View style={s.nameRow}>
                  <Text style={s.pkgName} numberOfLines={2}>
                    {pickLocalizedField(pkg, 'name', lang) || pkg.name}
                  </Text>
                  <View style={s.durationPill}>
                    <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                    <Text style={s.durationText}>{t('packagesScreen.minutes', { count: pkg.estimatedDurationMinutes })}</Text>
                  </View>
                </View>
                {!!pkg.description && (
                  <Text style={s.desc} numberOfLines={2}>
                    {pickLocalizedField(pkg, 'description', lang) || pkg.description}
                  </Text>
                )}
                <ServicesList
                  services={pkg.services || []}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(pkg.id)}
                  lang={lang}
                  t={t}
                />
                {/* Book button — gradient fill */}
                <View style={s.bookBtnWrap}>
                  <LinearGradient
                    colors={[theme.colors.primary, G(0.82)]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <PressableScale
                    style={s.bookBtnTouch}
                    onPress={() => navigation.navigate('Booking', { selectedPackage: pkg })}
                  >
                    <Text style={s.bookBtnText}>
                      {isAdmin ? t('packagesScreen.createCustomerBooking') : t('packagesScreen.bookThisPackage')}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color={theme.colors.ink} />
                  </PressableScale>
                </View>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

/* ── ServicesList styles ─────────────────────────────────── */
const sl = StyleSheet.create({
  wrap: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 4, overflow: 'hidden', /* clips PrismTopLine */
  },
  label:     { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  text:      { color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)', backgroundColor: 'rgba(200,169,107,0.06)' },
  toggleText:{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  /* Header */
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 },
  eyebrow:     { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 12 },
  eyebrowLine: { height: 1, width: 22 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  heading:     { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sub:         { color: theme.colors.textMuted, fontSize: 14 },

  /* Count ring */
  countRingOuter: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexShrink: 0 },
  countRingInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card.bg, alignItems: 'center', justifyContent: 'center' },
  countText:      { color: theme.colors.primary, fontWeight: '900', fontSize: 14 },

  /* Error banner */
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(127,29,29,0.24)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText:   { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },

  /* Tier filter */
  tierScroll:         { marginBottom: 18 },
  tierRow:            { gap: 8, paddingRight: 4 },
  tierChip:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.03)' },
  tierChipActive:     { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  tierChipDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.ink },
  tierChipText:       { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  tierChipTextActive: { color: theme.colors.ink },

  /* Empty state */
  emptyWrap:          { alignItems: 'center', paddingVertical: 40, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', marginBottom: 14, gap: 10 },
  emptyIconRingOuter: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:         { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  emptyBody:          { color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, fontSize: 13 },
  emptyBtnWrap:       { borderRadius: 20, overflow: 'hidden', marginTop: 4 },
  emptyBtnTouch:      { paddingVertical: 10, paddingHorizontal: 22 },
  emptyBtnText:       { color: theme.colors.ink, fontWeight: '800', fontSize: 13 },

  /* Package cards */
  card: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.card.bg,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  cardExpanded:  { borderColor: 'rgba(200,169,107,0.45)' },
  imgWrap:       { height: 185, position: 'relative' },
  img:           { width: '100%', height: '100%' },
  tierBadge:     { position: 'absolute', top: 12, right: 12, backgroundColor: theme.colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tierBadgeText: { color: theme.colors.ink, fontWeight: '800', fontSize: 11 },
  priceTag:      { position: 'absolute', bottom: 12, left: 14, backgroundColor: 'rgba(13,17,23,0.82)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)' },
  priceTagLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  priceTagText:  { color: theme.colors.primary, fontWeight: '900', fontSize: 18 },
  body:          { padding: 16 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  pkgName:       { color: theme.colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
  durationPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  durationText:  { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  desc:          { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },

  /* Book button — gradient fill via absoluteFillObject */
  bookBtnWrap:  { borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  bookBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  bookBtnText:  { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
});