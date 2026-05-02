// ─── WorkerSalesScreen.js ─────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Modal, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { bookingsAPI } from '../api/bookings';
import { offersAPI } from '../api/offers';
import { packagesAPI } from '../api/packages';
import { servicesAPI } from '../api/services';
import { useSettings } from '../context/SettingsContext';
import { TouchableOpacity } from 'react-native';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';
import { useTranslation } from 'react-i18next';

const PADDING = 20;

/* ── Schedule helpers ────────────────────────────────────── */
const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const extractDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return toLocalDateKey(date);
};

const getTimeSlotStartMinutes = (timeSlot) => {
  const rawStart = String(timeSlot || '').split('-')[0]?.trim();
  const match    = rawStart?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 60 + Number(match[2]);
};

const getTimeSlotEndMinutes = (timeSlot) => {
  const parts = String(timeSlot || '').split('-');
  if (parts.length < 2) return Number.POSITIVE_INFINITY;
  const match = parts[1]?.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  const start = getTimeSlotStartMinutes(timeSlot);
  let end = Number(match[1]) * 60 + Number(match[2]);
  if (end <= start) end += 1440; // midnight rollover
  return end;
};

const getBookingSortValue = (booking) => {
  const date   = new Date(booking?.scheduledDate);
  const dateMs = Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
  return dateMs * 1440 + getTimeSlotStartMinutes(booking?.timeSlot);
};

const minutesToAmPm = (mins) => {
  const totalMins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

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
  const { i18n } = useTranslation();
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();
  const settings     = useSettings();

  const [offers,       setOffers]       = useState([]);
  const [packages,     setPackages]     = useState([]);
  const [services,     setServices]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState('');
  const [workerBookings, setWorkerBookings] = useState([]);
  const [conflictModal,  setConflictModal]  = useState(null);

  // Upsell add-on state
  const [selectedPkgId,   setSelectedPkgId]   = useState(null);
  const [addedServiceIds, setAddedServiceIds] = useState([]);

  const load = async () => {
    try {
      setError('');
      const [offersData, packagesData, servicesData] = await Promise.all([
        offersAPI.getAll(),
        packagesAPI.getAll(i18n.language),
        servicesAPI.getAll(i18n.language),
      ]);
      setOffers(offersData    || []);
      setPackages(packagesData || []);
      setServices(servicesData || []);
    } catch { setError('Failed to load sales material.'); }
  };

  useEffect(() => {
    const run = async () => { setLoading(true); await load(); setLoading(false); };
    run();
  }, [i18n.language]);

  // Load worker's own bookings for schedule conflict detection (advisory — fails silently)
  useEffect(() => {
    bookingsAPI.getWorkerBookings()
      .then((data) => setWorkerBookings(data || []))
      .catch(() => {});
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

  // The detailer's currently active job (InProgress or arrived on site)
  const activeJob = useMemo(() =>
    workerBookings.find((b) =>
      b.status === 'InProgress' ||
      ((b.status === 'Pending' || b.status === 'Confirmed') && b.workerArrivedAt)
    ),
  [workerBookings]);

  // First upcoming job scheduled after the active one (same day or later)
  const nextJob = useMemo(() => {
    if (!activeJob) return null;
    const activeDateKey = extractDateKey(activeJob.scheduledDate) || toLocalDateKey(new Date());
    return workerBookings
      .filter((b) => {
        if (b.id === activeJob.id) return false;
        if (b.status === 'Completed' || b.status === 'Cancelled') return false;
        const dateKey = extractDateKey(b.scheduledDate);
        if (!dateKey) return false;
        return dateKey >= activeDateKey;
      })
      .sort((a, b) => getBookingSortValue(a) - getBookingSortValue(b))[0] || null;
  }, [workerBookings, activeJob]);

  // Returns conflict info if adding `svc` would push past departure time for nextJob
  const checkScheduleConflict = useCallback((svc) => {
    if (!activeJob || !nextJob) return null;
    const activeJobEnd = getTimeSlotEndMinutes(activeJob.timeSlot);
    const nextJobStart = getTimeSlotStartMinutes(nextJob.timeSlot);
    if (!Number.isFinite(activeJobEnd) || !Number.isFinite(nextJobStart)) return null;
    // Only warn when both jobs are on the same calendar day
    const activeDateKey = extractDateKey(activeJob.scheduledDate);
    const nextDateKey   = extractDateKey(nextJob.scheduledDate);
    if (activeDateKey && nextDateKey && nextDateKey !== activeDateKey) return null;
    const alreadyAddedDuration = services
      .filter((s) => addedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + (s.defaultDurationMinutes || 0), 0);
    const thisServiceDuration = svc.defaultDurationMinutes || 0;
    const projectedEnd = activeJobEnd + alreadyAddedDuration + thisServiceDuration;
    const travelBuffer = settings?.workerTravelBufferMinutes || 30;
    const mustLeaveBy  = nextJobStart - travelBuffer;
    if (projectedEnd > mustLeaveBy) {
      return {
        service: svc,
        nextJob,
        nextJobStart,
        travelBuffer,
        mustLeaveBy,
        projectedEnd,
        minutesOver: projectedEnd - mustLeaveBy,
        overlapsNextJob: projectedEnd > nextJobStart,
      };
    }
    return null;
  }, [activeJob, nextJob, services, addedServiceIds, settings]);

  const handleToggleService = useCallback((svc) => {
    const alreadyAdded = addedServiceIds.includes(svc.id);
    if (!alreadyAdded) {
      const conflict = checkScheduleConflict(svc);
      if (conflict) { setConflictModal(conflict); return; }
    }
    setAddedServiceIds((prev) =>
      alreadyAdded ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
    );
  }, [addedServiceIds, checkScheduleConflict]);

  const handleAddAnyway = useCallback(() => {
    if (!conflictModal) return;
    setAddedServiceIds((prev) => [...prev, conflictModal.service.id]);
    setConflictModal(null);
  }, [conflictModal]);

  const callDispatch = () => {
    const phone = settings?.businessConfig?.phone || '+974 4444 4444';
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <View style={s.screen}>
    <ScrollView
      style={s.screenFill}
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

      {/* ── Upsell Add-ons ─────────────────────────────────── */}
      {services.length > 0 && (
        <>
          <SectionLabel icon="add-circle-outline">Add-On Upsell</SectionLabel>

          {/* Package selector */}
          <View style={s.upsellPkgPicker}>
            <PrismTopLine />
            <Text style={s.upsellPickerLabel}>Customer's current package</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {packages.map(pkg => {
                  const active = selectedPkgId === pkg.id;
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      onPress={() => {
                        setSelectedPkgId(active ? null : pkg.id);
                        setAddedServiceIds([]);
                      }}
                      style={[s.pkgPill, active && s.pkgPillActive]}
                    >
                      <Text style={[s.pkgPillText, active && s.pkgPillTextActive]}>{pkg.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Add-on services — only ones NOT in selected package */}
          {(() => {
            const selectedPkg = packages.find(p => p.id === selectedPkgId);
            const includedIds = new Set(
              (selectedPkg?.services || []).map(sv => sv.serviceId || sv.id)
            );
            // Always show added services even if they're in the package (so detailer can remove them)
            const shownServices = selectedPkgId
              ? services.filter(svc => !includedIds.has(svc.id) || addedServiceIds.includes(svc.id))
              : services;

            // Compute duration from full services list so it survives filter changes
            const addedDuration = services
              .filter(svc => addedServiceIds.includes(svc.id))
              .reduce((sum, svc) => sum + (svc.defaultDurationMinutes || 0), 0);
            const baseDuration = selectedPkg?.estimatedDurationMinutes || 0;

            return (
              <>
                {addedServiceIds.length > 0 && (
                  <View style={s.upsellSummary}>
                    <View style={s.upsellSummaryItem}>
                      <Text style={s.upsellSummaryLabel}>Items</Text>
                      <Text style={s.upsellSummaryValue}>{addedServiceIds.length}</Text>
                    </View>
                    {selectedPkg && (
                      <View style={s.upsellSummaryItem}>
                        <Text style={s.upsellSummaryLabel}>Total</Text>
                        <Text style={s.upsellSummaryValue}>{formatQAR(selectedPkg.price)}</Text>
                      </View>
                    )}
                    <View style={s.upsellSummaryItem}>
                      <Text style={s.upsellSummaryLabel}>Est. Time</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {baseDuration > 0 && <Text style={s.upsellSummaryValue}>{baseDuration}m</Text>}
                        {addedDuration > 0 ? (
                          <Text style={s.upsellTimeDelta}>{baseDuration > 0 ? ` +${addedDuration}m` : `+${addedDuration}m`}</Text>
                        ) : baseDuration === 0 ? (
                          <Text style={s.upsellSummaryValue}>—</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}

                {shownServices.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <PrismTopLine />
                    <Ionicons name="checkmark-done-outline" size={22} color={theme.colors.textMuted} />
                    <Text style={s.emptyText}>All services included in package.</Text>
                  </View>
                ) : (
                  shownServices.map(svc => {
                    const added = addedServiceIds.includes(svc.id);
                    const inPackage = includedIds.has(svc.id);
                    return (
                      <TouchableOpacity
                        key={svc.id}
                        activeOpacity={0.75}
                        onPress={() => handleToggleService(svc)}
                        style={[s.upsellCard, added && s.upsellCardAdded]}
                      >
                        <PrismTopLine />
                        <LinearGradient
                          colors={added ? [T(0.08), 'transparent'] : [G(0.04), 'transparent']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                        <View style={s.upsellCardRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.upsellCardName}>{svc.name}</Text>
                            {inPackage && (
                              <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '700', marginBottom: 2 }}>Included in package</Text>
                            )}
                            {!!svc.description && (
                              <Text style={s.upsellCardDesc}>{svc.description}</Text>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                              <Text style={s.upsellCardDuration}>{svc.defaultDurationMinutes || 0} min</Text>
                              {added && (
                                <Text style={s.upsellDelta}>+{svc.defaultDurationMinutes || 0}m added</Text>
                              )}
                            </View>
                          </View>
                          <View style={[s.upsellToggle, added && s.upsellToggleActive]}>
                            <Ionicons
                              name={added ? 'checkmark' : 'add'}
                              size={16}
                              color={added ? '#fff' : theme.colors.primary}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            );
          })()}
        </>
      )}
    </ScrollView>

    {/* ── Schedule Conflict Warning Modal ────────────────── */}
    {conflictModal && (
      <Modal transparent animationType="fade" visible onRequestClose={() => setConflictModal(null)}>
        <View style={s.conflictBackdrop}>
          <View style={s.conflictCard}>
            {/* Amber top accent */}
            <LinearGradient
              colors={['transparent', 'rgba(251,146,60,0.85)', 'rgba(251,146,60,0.55)', 'transparent']}
              locations={[0, 0.38, 0.62, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(251,146,60,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Header row */}
            <View style={s.conflictHeaderRow}>
              <View style={s.conflictIconWrap}>
                <Ionicons name="warning" size={22} color="#FB923C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.conflictEyebrow}>Schedule Conflict</Text>
                <Text style={s.conflictTitle}>Upcoming Job Alert</Text>
              </View>
              <TouchableOpacity onPress={() => setConflictModal(null)} style={s.conflictClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <Text style={s.conflictBody}>
              Adding{' '}
              <Text style={s.conflictHighlight}>{conflictModal.service.name}</Text>
              {' '}(+{conflictModal.service.defaultDurationMinutes || 0} min) would push your finish time past your departure window for the next job.
            </Text>

            {/* Info grid */}
            <View style={s.conflictGrid}>
              <View style={s.conflictGridItem}>
                <Ionicons name="calendar-outline" size={13} color="#FB923C" />
                <Text style={s.conflictGridLabel}>Next Job</Text>
                <Text style={s.conflictGridValue}>{minutesToAmPm(conflictModal.nextJobStart)}</Text>
              </View>
              <View style={s.conflictGridDivider} />
              <View style={s.conflictGridItem}>
                <Ionicons name="car-outline" size={13} color="#FB923C" />
                <Text style={s.conflictGridLabel}>Travel Buffer</Text>
                <Text style={s.conflictGridValue}>{conflictModal.travelBuffer} min</Text>
              </View>
              <View style={s.conflictGridDivider} />
              <View style={s.conflictGridItem}>
                <Ionicons name="exit-outline" size={13} color={conflictModal.overlapsNextJob ? '#EF4444' : '#FB923C'} />
                <Text style={s.conflictGridLabel}>Must Leave By</Text>
                <Text style={[s.conflictGridValue, { color: conflictModal.overlapsNextJob ? '#EF4444' : '#FB923C' }]}>
                  {minutesToAmPm(conflictModal.mustLeaveBy)}
                </Text>
              </View>
            </View>

            {conflictModal.overlapsNextJob && (
              <View style={s.conflictOverlapBanner}>
                <Ionicons name="alert-circle" size={13} color="#EF4444" />
                <Text style={s.conflictOverlapText}>
                  This service would run into the next job's time slot — not just the buffer.
                </Text>
              </View>
            )}

            <Text style={s.conflictAdvice}>
              Contact dispatch to reschedule the next booking or get approval before proceeding.
            </Text>

            {/* Call Dispatch */}
            <TouchableOpacity
              style={s.conflictCallBtn}
              onPress={() => { callDispatch(); setConflictModal(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={15} color="#fff" />
              <Text style={s.conflictCallBtnText}>Call Dispatch</Text>
            </TouchableOpacity>

            {/* Secondary actions */}
            <View style={s.conflictRowBtns}>
              <TouchableOpacity style={s.conflictCancelBtn} onPress={() => setConflictModal(null)} activeOpacity={0.8}>
                <Text style={s.conflictCancelBtnText}>Don't Add</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.conflictAnywayBtn} onPress={handleAddAnyway} activeOpacity={0.8}>
                <Text style={s.conflictAnywayBtnText}>Add Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: theme.colors.bg },
  screenFill:  { flex: 1, backgroundColor: theme.colors.bg },
  content:     { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

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

  /* Upsell section */
  upsellPkgPicker: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 12, overflow: 'hidden' },
  upsellPickerLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  pkgPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  pkgPillActive: { backgroundColor: 'rgba(200,169,107,0.15)', borderColor: 'rgba(200,169,107,0.55)' },
  pkgPillText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  pkgPillTextActive: { color: theme.colors.primary },

  upsellSummary: { flexDirection: 'row', gap: 0, borderWidth: 1.5, borderColor: 'rgba(14,165,160,0.30)', borderRadius: 14, backgroundColor: 'rgba(14,165,160,0.06)', marginBottom: 10, overflow: 'hidden' },
  upsellSummaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  upsellSummaryLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  upsellSummaryValue: { color: theme.colors.text, fontSize: 15, fontWeight: '900' },
  upsellTimeDelta: { color: '#10B981', fontSize: 13, fontWeight: '800' },

  upsellCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 10, overflow: 'hidden' },
  upsellCardAdded: { borderColor: 'rgba(14,165,160,0.45)' },
  upsellCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upsellCardName: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  upsellCardDesc: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  upsellCardDuration: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  upsellDelta: { color: '#10B981', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  upsellToggle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', flexShrink: 0 },
  upsellToggleActive: { backgroundColor: 'rgba(14,165,160,0.85)', borderColor: 'rgba(14,165,160,0.85)' },

  /* Schedule conflict modal */
  conflictBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  conflictCard:       { width: '100%', maxWidth: 380, borderWidth: 1.5, borderColor: 'rgba(251,146,60,0.35)', borderRadius: 20, backgroundColor: '#0E1B23', padding: 20, overflow: 'hidden' },
  conflictHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  conflictIconWrap:   { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(251,146,60,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  conflictEyebrow:    { color: '#FB923C', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  conflictTitle:      { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  conflictClose:      { padding: 4 },
  conflictBody:       { color: theme.colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  conflictHighlight:  { color: theme.colors.text, fontWeight: '800' },
  conflictGrid:       { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(251,146,60,0.20)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  conflictGridItem:   { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 3 },
  conflictGridDivider:{ width: 1, backgroundColor: 'rgba(251,146,60,0.18)' },
  conflictGridLabel:  { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  conflictGridValue:  { color: '#FB923C', fontSize: 14, fontWeight: '900' },
  conflictOverlapBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 10, padding: 10, marginBottom: 12 },
  conflictOverlapText:   { color: '#FCA5A5', fontSize: 12, lineHeight: 17, flex: 1 },
  conflictAdvice:     { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16, fontStyle: 'italic' },
  conflictCallBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FB923C', borderRadius: 12, paddingVertical: 13, marginBottom: 10 },
  conflictCallBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  conflictRowBtns:    { flexDirection: 'row', gap: 10 },
  conflictCancelBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, paddingVertical: 11 },
  conflictCancelBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  conflictAnywayBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(251,146,60,0.40)', borderRadius: 12, paddingVertical: 11, backgroundColor: 'rgba(251,146,60,0.08)' },
  conflictAnywayBtnText: { color: '#FB923C', fontWeight: '700', fontSize: 13 },
});