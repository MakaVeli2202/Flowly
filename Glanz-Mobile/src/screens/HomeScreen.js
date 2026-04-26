import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, RefreshControl, Dimensions, TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { usePackages } from '../context/PackagesContext';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';
import { reviewsAPI } from '../api/reviews';
import PressableScale from '../components/PressableScale';

/* ── Constants ───────────────────────────────────────────── */
// Keys instead of labels — t() called at render time, not here
const FEATURES = [
  { icon: 'sparkles-outline',         labelKey: 'home.features.premiumProducts' },
  { icon: 'time-outline',             labelKey: 'home.features.onTimeService'   },
  { icon: 'shield-checkmark-outline', labelKey: 'home.features.fullyInsured'    },
  { icon: 'star-outline',             labelKey: 'home.features.rated5Stars'     },
];

const QUICK_ACTIONS = [
  { icon: 'list-outline',          labelKey: 'home.quickActions.myBookings', screen: 'My Bookings' },
  { icon: 'person-circle-outline', labelKey: 'home.quickActions.profile',    screen: 'Profile'     },
  { icon: 'grid-outline',          labelKey: 'home.quickActions.packages',   screen: 'Packages'    },
];

const { width } = Dimensions.get('window');
const PADDING = 20;

/* ── Prismatic palette shorthand helpers ─────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Visual primitives ───────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={s.prismTopLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={s.prismLeftBar}
    pointerEvents="none"
  />
);

/* ── Section Header ──────────────────────────────────────── */
const SectionHeader = ({ title, action, onAction }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionTitleGroup}>
      <LinearGradient
        colors={['transparent', G(0.80)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.sectionAccentBar}
      />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {!!action && (
      <PressableScale onPress={onAction}>
        <Text style={s.sectionAction}>{action}</Text>
      </PressableScale>
    )}
  </View>
);

/* ── HomeScreen ──────────────────────────────────────────── */
export default function HomeScreen({ navigation }) {
  const { t }      = useTranslation();
  const { user }   = useAuth();
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();

  const preferredAddressType = user?.preferredAddressType || 'Home';
  const preferredAddress =
    preferredAddressType === 'Work'
      ? user?.workAddress
      : preferredAddressType === 'Other'
        ? user?.otherAddress
        : user?.homeAddress;

  const { packages, packagesLoading, packagesError, fetchPackages } = usePackages();
  const featuredPackages = packages.slice(0, 3);

  const [refreshing,        setRefreshing]        = useState(false);
  const [expandedPackageId, setExpandedPackageId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => { fetchPackages(); fetchReviews(); }, []);

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const data = await reviewsAPI.getPublic();
      setReviews(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch { setReviews([]); }
    finally { setReviewsLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPackages(), fetchReviews()]);
    setRefreshing(false);
  };

  const toggleExpand = (id) =>
    setExpandedPackageId((prev) => (prev === id ? null : id));

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
      {/* ── Greeting ────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.greetingWrap}>
        <View style={s.greetingBadge}>
          <Ionicons name="sparkles" size={10} color={theme.colors.primary} />
          <Text style={s.greetingBadgeText}>{t('home.eyebrow')}</Text>
        </View>
        <Text style={s.greetingName}>
          {t('home.greeting', { name: user?.firstName || t('home.greetingFallback') })}
        </Text>
        <Text style={s.greetingSub}>{t('home.greetingSub')}</Text>
        <SpectrumLine style={s.greetingRule} />
      </Animated.View>

      {/* ── Hero card ───────────────────────────────────── */}
      <Animated.View entering={FadeInUp.springify().delay(80)} style={s.hero}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=900&q=80' }}
          style={s.heroBg}
          resizeMode="cover"
        />
        {/* Dark vertical scrim */}
        <LinearGradient
          colors={['rgba(13,17,23,0)', 'rgba(13,17,23,0.26)', 'rgba(13,17,23,0.94)']}
          locations={[0, 0.28, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Diagonal prismatic colour cast */}
        <LinearGradient
          colors={[G(0.13), 'transparent', T(0.09)]}
          locations={[0, 0.50, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <PrismTopLine />
        <View style={s.heroBody}>
          <LinearGradient
            colors={[G(0.20), T(0.13)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroBadge}
          >
            <Text style={s.heroBadgeText}>{t('home.heroBadge')}</Text>
          </LinearGradient>
          {/* Brand name — intentionally not translated */}
          <Text style={s.heroTitle}>Glanz</Text>
          <Text style={s.heroSub}>{t('home.heroSub')}</Text>
          <PressableScale onPress={() => navigation.navigate('Booking')} style={s.heroBtn}>
            <Text style={s.heroBtnText}>{t('home.bookNow')}</Text>
            <Ionicons name="arrow-forward" size={15} color={theme.colors.ink} />
          </PressableScale>
        </View>
      </Animated.View>

      {/* ── Address strip ───────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(360).delay(160)}>
        <PressableScale style={s.addressStrip} onPress={() => navigation.navigate('Profile')}>
          <PrismLeftBar />
          <View style={s.addressIconBox}>
            <Ionicons name="location" size={15} color={theme.colors.primary} />
          </View>
          <View style={s.addressBody}>
            <Text style={s.addressLabel}>
              {preferredAddress
                ? t(`home.address.${preferredAddressType.toLowerCase()}`)
                : t('home.address.none')}
            </Text>
            <Text style={s.addressValue} numberOfLines={1}>
              {preferredAddress || t('home.address.placeholder')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
        </PressableScale>
      </Animated.View>

      {/* ── Why Choose Us ───────────────────────────────── */}
      <SectionHeader title={t('home.features.title')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.featuresRow}
        style={s.featuresScroll}
      >
        {FEATURES.map((item, i) => (
          <Animated.View key={item.labelKey} entering={FadeInUp.duration(360).delay(i * 55)}>
            <View style={s.featureCard}>
              <PrismTopLine />
              <LinearGradient
                colors={[G(0.48), T(0.34)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.featureIconRing}
              >
                <View style={s.featureIconInner}>
                  <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                </View>
              </LinearGradient>
              {/* labelKey resolved here at render time — not in the array */}
              <Text style={s.featureLabel}>{t(item.labelKey)}</Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* ── Reviews ──────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <View style={s.sectionTitleGroup}>
          <LinearGradient colors={['transparent', G(0.80)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sectionAccentBar} />
          <Text style={s.sectionTitle}>What Our Clients Say</Text>
        </View>
        <Text style={s.sectionAction}>Based on {reviews.length}+ reviews</Text>
      </View>
      {reviewsLoading ? (
        <View style={s.loader}><ActivityIndicator color={theme.colors.primary} size="small" /></View>
      ) : reviews.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No reviews yet</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.reviewsScroll}>
          <View style={s.reviewsRow}>
            {reviews.map((review) => (
              <View key={review.id} style={s.reviewCard}>
                <PrismLeftBar />
                <View style={s.reviewHeader}>
                  <View style={s.reviewAvatar}>
                    <Text style={s.reviewAvatarText}>{review.fallbackInitials || review.author?.[0]}</Text>
                  </View>
                  <View style={s.reviewInfo}>
                    <Text style={s.reviewAuthor}>{review.author}</Text>
                    <Text style={s.reviewDate}>{review.date}</Text>
                  </View>
                </View>
                <View style={s.reviewStars}>
                  {[...Array(review.rating || 5)].map((_, i) => (
                    <Ionicons key={i} name="star" size={12} color="#FBBF24" />
                  ))}
                </View>
                <Text style={s.reviewText} numberOfLines={3}>{review.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Featured Packages ───────────────────────────── */}
      <SectionHeader
        title={t('home.packages.title')}
        action={t('home.packages.seeAll')}
        onAction={() => navigation.navigate('Packages')}
      />
      {packagesLoading ? (
        <View style={s.loader}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : packagesError ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
          <Text style={s.errorText}>{t('home.packages.loadError')}</Text>
        </View>
      ) : (
        <View style={s.pkgList}>
          {featuredPackages.map((pkg, index) => {
            const isExpanded      = expandedPackageId === pkg.id;
            const allServices     = pkg.services || [];
            const visibleServices = isExpanded ? allServices : allServices.slice(0, 2);
            return (
              <Animated.View key={pkg.id} entering={FadeInUp.duration(420).delay(index * 90)}>
                <View style={s.pkgCard}>
                  <PrismTopLine />
                  <PrismLeftBar />
                  {/* Image */}
                  <View style={s.pkgImgWrap}>
                    <Image
                      source={{ uri: pkg.imageUrl || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400' }}
                      style={s.pkgImg}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['rgba(13,17,23,0)', 'rgba(13,17,23,0.52)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View style={s.pkgTierBadge}>
                      <Text style={s.pkgTierText}>{pkg.tier}</Text>
                    </View>
                    <View style={s.pkgPriceTag}>
                      <Text style={s.pkgPrice}>{formatQAR(pkg.price)}</Text>
                    </View>
                  </View>
                  {/* Body */}
                  <View style={s.pkgBody}>
                    <LinearGradient
                      colors={[G(0.04), 'transparent', T(0.02)]}
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View style={s.pkgNameRow}>
                      <Text style={s.pkgName}>{pkg.name}</Text>
                      <View style={s.pkgDurationPill}>
                        <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                        <Text style={s.pkgDurationText}>
                          {t('home.packages.minutes', { count: pkg.estimatedDurationMinutes })}
                        </Text>
                      </View>
                    </View>
                    {!!pkg.description && (
                      <Text style={s.pkgDesc} numberOfLines={2}>{pkg.description}</Text>
                    )}
                    {allServices.length > 0 && (
                      <View style={s.serviceList}>
                        {visibleServices.map((svc, i) => (
                          <View key={i} style={s.serviceRow}>
                            <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                            <Text style={s.serviceText}>{svc.serviceName || svc.name}</Text>
                          </View>
                        ))}
                        {allServices.length > 2 && (
                          <PressableScale onPress={() => toggleExpand(pkg.id)} style={s.expandBtn}>
                            <Text style={s.expandText}>
                              {isExpanded
                                ? t('home.packages.showLess')
                                : t('home.packages.moreServices', { count: allServices.length - 2 })}
                            </Text>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={13}
                              color={theme.colors.primary}
                            />
                          </PressableScale>
                        )}
                      </View>
                    )}
                    <PressableScale
                      onPress={() => navigation.navigate('Booking', { selectedPackage: pkg })}
                      style={s.pkgBookBtn}
                    >
                      <Text style={s.pkgBookBtnText}>{t('home.packages.bookPackage')}</Text>
                      <Ionicons name="arrow-forward" size={15} color={theme.colors.ink} />
                    </PressableScale>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* ── Quick Actions ────────────────────────────────── */}
      <SectionHeader title={t('home.quickActions.title')} />
      <Animated.View entering={FadeInUp.duration(400).delay(180)} style={s.quickRow}>
        {QUICK_ACTIONS.map((action) => (
          <PressableScale
            key={action.screen}
            style={s.quickCard}
            onPress={() => navigation.navigate(action.screen)}
          >
            <LinearGradient
              colors={[G(0.06), 'transparent', T(0.04)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <PrismTopLine />
            <LinearGradient
              colors={[G(0.44), T(0.30)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.quickIconRing}
            >
              <View style={s.quickIconInner}>
                <Ionicons name={action.icon} size={22} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            {/* labelKey resolved here at render time */}
            <Text style={s.quickLabel}>{t(action.labelKey)}</Text>
          </PressableScale>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    paddingHorizontal: PADDING,
    paddingBottom: 52,
    backgroundColor: theme.colors.bg,
  },
  /* Prismatic accent primitives */
  prismTopLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5, zIndex: 2,
  },
  prismLeftBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 3, zIndex: 2,
  },
  /* Greeting */
  greetingWrap: { marginBottom: 12 },
  greetingBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(200,169,107,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.28)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12,
  },
  greetingBadgeText: {
    color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
  },
  greetingName: { color: theme.colors.text,     fontSize: 26, fontWeight: '900', marginBottom: 4 },
  greetingSub:  { color: theme.colors.textMuted, fontSize: 15 },
  greetingRule: { marginTop: 10 },
  /* Hero */
  hero: {
    height: 260, borderRadius: 22, overflow: 'hidden',
    marginBottom: 12, justifyContent: 'flex-end',
    backgroundColor: theme.card.bg,
  },
  heroBg:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.27 },
  heroBody: { padding: 22, paddingBottom: 26 },
  heroBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.40)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14,
  },
  heroBadgeText: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  heroTitle:     { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 8 },
  heroSub:       { color: 'rgba(232,233,236,0.7)', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  heroBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 22,
  },
  heroBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
  /* Address strip */
  addressStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14,
    backgroundColor: 'rgba(19,27,37,0.80)',
    paddingHorizontal: 14, paddingVertical: 13,
    overflow: 'hidden',
  },
  addressIconBox: {
    width: 34, height: 34, borderRadius: 17, flexShrink: 0,
    backgroundColor: 'rgba(200,169,107,0.12)',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  addressBody:  { flex: 1 },
  addressLabel: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  addressValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  /* Section header */
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionAccentBar:  { height: 1.5, width: 24, borderRadius: 1 },
  sectionTitle:      { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  sectionAction:     { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  /* Feature cards */
  featuresScroll: { marginHorizontal: -PADDING, marginBottom: 16 },
  featuresRow:    { paddingHorizontal: PADDING, gap: 10 },
  featureCard: {
    width: 118, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.70)',
    padding: 14, alignItems: 'center', gap: 10,
    overflow: 'hidden',
  },
  featureIconRing: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  featureIconInner: {
    width: 43, height: 43, borderRadius: 21.5,
    backgroundColor: theme.card.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: {
    color: theme.colors.text, fontSize: 12,
    fontWeight: '700', textAlign: 'center', lineHeight: 16,
  },
  /* Packages */
  loader: { paddingVertical: 24, alignItems: 'center' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#7F1D1D', backgroundColor: '#1C0A0A',
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },
  pkgList:   { gap: 12, marginBottom: 16 },
  pkgCard: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.card.bg,
    ...theme.shadow.card,
  },
  pkgImgWrap: { height: 155 },
  pkgImg:     { width: '100%', height: '100%' },
  pkgTierBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  pkgTierText: { color: theme.colors.ink, fontWeight: '800', fontSize: 11 },
  pkgPriceTag: {
    position: 'absolute', bottom: 12, left: 14,
    backgroundColor: 'rgba(13,17,23,0.82)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.32)',
  },
  pkgPrice:    { color: theme.colors.primary, fontSize: 17, fontWeight: '900' },
  pkgBody:     { padding: 16, gap: 10 },
  pkgNameRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pkgName:     { color: theme.colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  pkgDurationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  pkgDurationText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  pkgDesc:         { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  serviceList:     { gap: 6 },
  serviceRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceText:     { color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  expandBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingVertical: 6, marginTop: 2,
  },
  expandText:     { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  pkgBookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12, paddingVertical: 13, marginTop: 4,
  },
  pkgBookBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
  /* Quick actions */
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickCard: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(19,27,37,0.60)',
    borderRadius: 16, padding: 16, alignItems: 'center', gap: 10,
    overflow: 'hidden',
  },
  quickIconRing: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  quickIconInner: {
    width: 47, height: 47, borderRadius: 23.5,
    backgroundColor: theme.card.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { color: theme.colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  /* Reviews */
  reviewsScroll: { marginBottom: 16 },
  reviewsRow: { paddingRight: PADDING, gap: 12 },
  reviewCard: {
    width: 240, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.70)',
    padding: 14, overflow: 'hidden',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: G(0.20), alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { color: theme.colors.primary, fontWeight: '800', fontSize: 12 },
  reviewInfo: { flex: 1 },
  reviewAuthor: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  reviewDate: { color: theme.colors.textMuted, fontSize: 10 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewText: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  emptyCard: { padding: 24, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13 },
});
