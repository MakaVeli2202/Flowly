import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { bookingsAPI } from '../api/bookings';
import { offersAPI } from '../api/offers';
import { formatQAR } from '../utils/currency';
import { getStatusColor } from '../utils/statusColors';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { theme } from '../theme/theme';
import { ListSkeleton, BookingCardSkeleton } from '../components/Skeleton';

const PADDING = 20;
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ─────────────────────────────────────────────────────────────
   Prism primitive styles — plain objects (not StyleSheet) so
   components defined above s/m can reference them safely.
───────────────────────────────────────────────────────────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Visual primitives ─────────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

/* Parent must have overflow:'hidden' */
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

/*
  Loyalty card gets its own top line using violet→amber
  to harmonise with the existing purple/gold rewards palette
  instead of imposing the gold-teal prism on it.
*/
const LoyaltyPrismTopLine = () => (
  <LinearGradient
    colors={['transparent', 'rgba(196,181,253,0.75)', 'rgba(251,191,36,0.65)', 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={prismStyles.topLine}
    pointerEvents="none"
  />
);

/* ── ModalInput — focus-aware TextInput wrapper ─────────────── */
/*
  Destructures multiline, numberOfLines, and focus callbacks
  so they don't interfere with the focus state tracking, then
  spreads the remainder into TextInput.
*/
function ModalInput({
  multiline, numberOfLines,
  onFocus: onFocusProp, onBlur: onBlurProp,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[m.inputBox, focused && m.inputBoxFocused, multiline && m.inputBoxMultiline]}>
      <TextInput
        style={m.inputText}
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onFocus={(e) => { setFocused(true); onFocusProp?.(e); }}
        onBlur={(e)  => { setFocused(false); onBlurProp?.(e); }}
        {...rest}
      />
    </View>
  );
}

/* ── Shared atoms ──────────────────────────────────────────── */
const SectionLabel = ({ children, icon }) => (
  <View style={u.sectionRow}>
    {!!icon && <Ionicons name={icon} size={14} color={theme.colors.primary} />}
    <Text style={u.sectionLabel}>{children}</Text>
  </View>
);

const FieldLabel = ({ children }) => <Text style={u.fieldLabel}>{children}</Text>;

/* ── Status description helper ─────────────────────────────── */
function getStatusMessage(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':                return 'Awaiting confirmation from our team.';
    case 'confirmed':              return 'Your appointment is confirmed and scheduled.';
    case 'in progress':
    case 'inprogress':             return 'Our team is currently cleaning your vehicle.';
    case 'completed':              return 'Service completed successfully. Thank you!';
    case 'cancelled':              return 'This booking has been cancelled.';
    case 'cancellationrequested':
    case 'cancellation requested': return 'Cancellation request submitted — awaiting review.';
    case 'reschedulerequested':
    case 'reschedule requested':   return 'Reschedule request submitted — awaiting review.';
    case 'rescheduled':            return 'Your booking has been moved to a new date.';
    default:                       return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   SCREEN
═══════════════════════════════════════════════════════════ */
export default function MyBookingsScreen({ navigation }) {
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();
  const route        = useRoute();

  const [bookings,            setBookings]            = useState([]);
  const [loyalty,             setLoyalty]             = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [refreshing,          setRefreshing]          = useState(false);
  const [error,               setError]               = useState('');
  const [activatingLoyalty,   setActivatingLoyalty]   = useState(false);
  const [requestModal,        setRequestModal]        = useState(null);
  const [requestReason,       setRequestReason]       = useState('');
  const [requestDate,         setRequestDate]         = useState('');
  const [submitting,          setSubmitting]          = useState(false);
  const [cancellationFeeInfo, setCancellationFeeInfo] = useState(null);
  const [feeLoading,          setFeeLoading]          = useState(false);
  const [expandedBookingId,   setExpandedBookingId]   = useState(null);

  // Deep-link from notification tap — expand the target booking
  useEffect(() => {
    const id = route.params?.openBookingId;
    if (id) setExpandedBookingId(Number(id));
  }, [route.params?.openBookingId]);

  /* ── Logic — identical to original ─────────────────────── */
  const loadData = useCallback(async () => {
    try {
      setError('');
      const [bookingData, loyaltyData] = await Promise.all([
        bookingsAPI.getMyBookings(),
        offersAPI.getMyLoyalty().catch(() => null),
      ]);
      setBookings(bookingData || []);
      setLoyalty(loyaltyData);
    } catch { setError('Failed to load bookings.'); }
  }, []);

  const initialLoadDone = useRef(false);

  // Initial full-screen load + silent refresh whenever screen regains focus
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(true);
        loadData().finally(() => setLoading(false));
      } else {
        loadData(); // silent refresh — no full-screen spinner
      }
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false);
  }, [loadData]);

  const onBookAgain = (booking) => {
    const rebookPackages = (booking.items || [])
      .filter(i => i.packageId)
      .map(i => ({ packageId: i.packageId, quantity: i.quantity || 1 }));
    navigation.navigate('Booking', {
      rebookFromBooking: {
        packages:            rebookPackages,
        customerAddress:     booking.customerAddress     || '',
        addressType:         booking.addressType         || 'Home',
        vehicleType:         booking.vehicleType         || 'Sedan',
        vehicleMake:         booking.vehicleMake         || '',
        vehicleModel:        booking.vehicleModel        || '',
        vehicleYear:         booking.vehicleYear         || '',
        specialInstructions: booking.specialInstructions || '',
      },
    });
  };

  const openGoogleReview = async () => {
    const url = loyalty?.googleReviewUrl || 'https://www.google.com/search?q=Glanz+Qatar+Google+review';
    await Linking.openURL(url);
  };

  const activateLoyaltyCounter = async () => {
    try {
      setActivatingLoyalty(true);
      await offersAPI.activateGoogleReviewLoyalty();
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to activate loyalty counter.');
    } finally { setActivatingLoyalty(false); }
  };

  const openCancelModal = async (booking) => {
    setCancellationFeeInfo(null);
    setRequestReason(''); setRequestDate('');
    setRequestModal({ booking, type: 'cancel' });
    const bookingId = booking.id;
    try {
      setFeeLoading(true);
      const feeInfo = await bookingsAPI.getCancellationFee(bookingId);
      // Only apply if this modal is still open for the same booking
      setRequestModal((current) => {
        if (current?.booking?.id !== bookingId) return current;
        setCancellationFeeInfo(feeInfo);
        return current;
      });
    } catch { /* non-critical */ }
    finally { setFeeLoading(false); }
  };

  const closeRequestModal = () => {
    setRequestModal(null);
    setRequestReason(''); setRequestDate('');
    setCancellationFeeInfo(null);
  };

  const submitRequest = async () => {
    if (!requestModal) return;
    try {
      setSubmitting(true);
      if (requestModal.type === 'cancel') {
        await bookingsAPI.requestCancellation(requestModal.booking.id, requestReason);
      } else {
        await bookingsAPI.requestReschedule(requestModal.booking.id, {
          reason: requestReason, preferredDate: requestDate,
        });
      }
      Alert.alert('Request Submitted', 'Our team will contact you shortly.');
      closeRequestModal();
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: PADDING }}>
          <ListSkeleton count={4} ItemComponent={BookingCardSkeleton} />
        </View>
      </ScrollView>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
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
        {/* ── Page header ──────────────────────────────── */}
        <View style={s.pageHeader}>
          <View style={s.eyebrow}>
            <LinearGradient
              colors={['transparent', G(0.70)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
            <Ionicons name="calendar-outline" size={10} color={theme.colors.primary} />
            <Text style={s.eyebrowText}>MY ACCOUNT</Text>
            <LinearGradient
              colors={[G(0.70), 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.eyebrowLine}
            />
          </View>
          <Text style={s.heading}>My Bookings</Text>
          <Text style={s.sub}>View and manage your appointments</Text>
          <SpectrumLine style={{ marginTop: 14 }} />
        </View>

        {/* ── Error banner ─────────────────────────────── */}
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Loyalty card ─────────────────────────────── */}
        {/*
          overflow:'hidden' added — clips LoyaltyPrismTopLine to the
          card's borderRadius. The absoluteFillObject gradient also
          needs this to be contained correctly.
        */}
        {loyalty && (
          <View style={s.loyaltyCard}>
            <LoyaltyPrismTopLine />
            <LinearGradient
              colors={['rgba(139,92,246,0.06)', 'transparent', 'rgba(245,158,11,0.04)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            <View style={s.loyaltyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.loyaltyEyebrow}>Loyalty Rewards</Text>
                <Text style={s.loyaltyTitle}>Reward Progress</Text>
                <Text style={s.loyaltySub}>
                  {loyalty.totalCompletedBookings} completed wash{loyalty.totalCompletedBookings !== 1 ? 'es' : ''}
                </Text>
              </View>
              <View style={s.loyaltyBadge}>
                <Text style={s.loyaltyBadgeNum}>{loyalty.totalCompletedBookings}</Text>
                <Text style={s.loyaltyBadgeLabel}>washes</Text>
              </View>
            </View>

            {!loyalty.isGoogleReviewActivated && (
              <View style={s.reviewUnlockCard}>
                <View style={s.reviewUnlockHeaderRow}>
                  <Ionicons name="star" size={15} color="#FBBF24" />
                  <Text style={s.reviewUnlockTitle}>One-Time Google Review Unlock</Text>
                </View>
                <Text style={s.reviewUnlockText}>
                  Rate Glanz on Google once to start the counter. Your next completed wash then begins the 3-slot reward cycle.
                </Text>
                <View style={s.reviewUnlockActions}>
                  <TouchableOpacity style={s.googleBtn} onPress={openGoogleReview} activeOpacity={0.8}>
                    <Ionicons name="star-outline" size={14} color="#1C1917" />
                    <Text style={s.googleBtnText}>Rate on Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.unlockBtn, activatingLoyalty && s.btnDisabled]}
                    onPress={activateLoyaltyCounter}
                    disabled={activatingLoyalty}
                    activeOpacity={0.8}
                  >
                    <Text style={s.unlockBtnText}>
                      {activatingLoyalty ? 'Activating…' : 'Unlock Counter'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(loyalty.programs || []).map((p) => (
              <View key={p.offerId} style={s.programWrap}>
                <View style={s.programHeadRow}>
                  <Text style={s.programName}>{p.programName}</Text>
                  <Text style={s.programCount}>{p.completedBookings}/{p.triggerBookings}</Text>
                </View>
                <View style={s.slotRow}>
                  {Array.from({ length: p.triggerBookings }).map((_, idx) => {
                    const filled = idx < p.completedBookings;
                    return (
                      <View key={`${p.offerId}-${idx}`} style={[s.slot, filled && s.slotFilled]}>
                        {filled
                          ? <Ionicons name="checkmark" size={14} color="#1C1917" />
                          : <Text style={s.slotNum}>{idx + 1}</Text>}
                      </View>
                    );
                  })}
                </View>
                {/* Progress bar — gradient fill replaces the flat green */}
                <View style={s.progressBg}>
                  <LinearGradient
                    colors={['#A3E635', '#22C55E']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[s.progressFill, { width: `${p.progressPercent}%` }]}
                  />
                </View>
                <Text style={s.programHint}>
                  {!loyalty.isGoogleReviewActivated
                    ? 'Rate us on Google once to unlock the counter.'
                    : p.bookingsToNext === 0
                      ? 'Reward ready — your free wash code is below.'
                      : `${p.bookingsToNext} more wash${p.bookingsToNext !== 1 ? 'es' : ''} until your reward.`}
                </Text>
              </View>
            ))}

            {(loyalty.availableCoupons || []).slice(0, 4).map((c) => (
              <View key={c.id} style={s.couponCard}>
                <View style={s.couponIconBox}>
                  <Ionicons name="gift" size={14} color="#FBBF24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.couponName}>{c.offerName}</Text>
                  <Text style={s.couponCode}>{c.personalCode}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Empty state ──────────────────────────────── */}
        {bookings.length === 0 ? (
          <View style={s.emptyWrap}>
            {/* Gradient ring icon (same technique as HomeScreen) */}
            <LinearGradient
              colors={[G(0.44), T(0.30)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.emptyIconRingOuter}
            >
              <View style={s.emptyIconRingInner}>
                <Ionicons name="calendar-outline" size={32} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            <Text style={s.emptyTitle}>No bookings yet</Text>
            <Text style={s.emptyBody}>
              Your upcoming washes will show up here once you make a booking.
            </Text>
            {/* Gradient button */}
            <View style={s.emptyBtnWrap}>
              <LinearGradient
                colors={[theme.colors.primary, G(0.82)]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <TouchableOpacity
                style={s.emptyBtnTouch}
                onPress={() => navigation.navigate('Booking')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color={theme.colors.ink} />
                <Text style={s.emptyBtnText}>Book Your First Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          bookings.map((booking) => {
            const statusStyle   = getStatusColor(booking.status);
            const statusMessage = getStatusMessage(booking.status);
            const canBookAgain  = booking.status === 'Completed';
            const canRequest    = booking.status !== 'Completed' && booking.status !== 'Cancelled';
            const isExpanded    = expandedBookingId === booking.id;
            const packageNames  = (booking.items || []).map(i => i.packageName).filter(Boolean).join(', ');
            const isSubscription = !!booking.isMonthlySubscription;

            return (
              /*
                bookingCard already has overflow:'hidden' — PrismTopLine
                clips to borderRadius without any change needed.
              */
              <View key={booking.id} style={s.bookingCard}>
                <PrismTopLine />
                {/* Dynamic status accent bar — left edge colored by status */}
                <View style={[s.bookingAccent, { backgroundColor: statusStyle.text }]} />

                <View style={s.bookingBody}>
                  <View style={s.bookingTopRow}>
                    <Text style={s.bookingNum}>{booking.bookingNumber}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isSubscription && (
                        <View style={s.subscriptionBadge}>
                          <Ionicons name="refresh-circle-outline" size={11} color="#8b5cf6" />
                          <Text style={s.subscriptionBadgeText}>
                            Sub {booking.subscriptionMonths ? `· ${booking.subscriptionMonths}mo` : ''}
                          </Text>
                        </View>
                      )}
                      <View style={[s.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.text }]}>
                        <Text style={[s.statusPillText, { color: statusStyle.text }]}>{booking.status}</Text>
                      </View>
                    </View>
                  </View>

                  {!!statusMessage && (
                    <View style={s.statusMessageRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={13}
                        color={statusStyle.text}
                      />
                      <Text style={[s.statusMessageText, { color: statusStyle.text }]}>
                        {statusMessage}
                      </Text>
                    </View>
                  )}

                  <View style={s.bookingInfoGrid}>
                    <View style={s.bookingInfoItem}>
                      <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={s.bookingInfoText}>
                        {new Date(booking.scheduledDate).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={s.bookingInfoItem}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={s.bookingInfoText}>{booking.timeSlot}</Text>
                    </View>
                    <View style={s.bookingInfoItem}>
                      <Ionicons name="cash-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={s.bookingInfoText}>{formatQAR(booking.totalAmount)}</Text>
                    </View>
                    {!!packageNames && (
                      <View style={s.bookingInfoItem}>
                        <Ionicons name="cube-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={s.bookingInfoText} numberOfLines={1}>{packageNames}</Text>
                      </View>
                    )}
                  </View>

                  {(booking.items || []).length > 0 && (
                    <>
                      <TouchableOpacity
                        style={s.expandToggle}
                        onPress={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.expandToggleText}>
                          {isExpanded ? 'Hide package details' : 'Show package details'}
                        </Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={theme.colors.primary}
                        />
                      </TouchableOpacity>

                      {isExpanded && (booking.items || []).map((item, idx) => (
                        <View
                          key={`${booking.id}-pkg-${item.packageId}-${idx}`}
                          style={s.pkgDetailCard}
                        >
                          <View style={s.pkgDetailHeader}>
                            <Text style={s.pkgDetailName}>{item.packageName}</Text>
                            <View style={s.pkgTierPill}>
                              <Text style={s.pkgTierText}>{item.packageTier}</Text>
                            </View>
                          </View>
                          {!!item.packageDescription && (
                            <Text style={s.pkgDetailDesc}>{item.packageDescription}</Text>
                          )}
                          {(item.includedServices || []).length > 0 && (
                            <View style={s.serviceList}>
                              {(item.includedServices || []).map((svc, si) => (
                                <View key={`${booking.id}-svc-${item.packageId}-${si}`} style={s.serviceRow}>
                                  <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} />
                                  <Text style={s.serviceText}>{svc}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </>
                  )}

                  {/* Primary actions */}
                  <View style={s.bookingActions}>
                    {/*
                      View Details: gradient fill via absoluteFillObject.
                      viewBtnWrap has overflow:'hidden' to clip gradient
                      to its borderRadius. TouchableOpacity sits on top.
                    */}
                    <View style={s.viewBtnWrap}>
                      <LinearGradient
                        colors={[theme.colors.primary, G(0.82)]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                        pointerEvents="none"
                      />
                      <TouchableOpacity
                        style={s.viewBtnTouch}
                        onPress={() => navigation.navigate('Booking Confirmation', {
                          bookingNumber: booking.bookingNumber,
                        })}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="receipt-outline" size={14} color={theme.colors.ink} />
                        <Text style={s.viewBtnText}>View Details</Text>
                      </TouchableOpacity>
                    </View>

                    {booking.status === 'InProgress' && (
                      <TouchableOpacity
                        style={s.bookAgainBtn}
                        onPress={() => navigation.navigate('Live Tracking', { bookingId: booking.id })}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="navigate-outline" size={14} color="#7C3AED" />
                        <Text style={[s.bookAgainBtnText, { color: '#7C3AED' }]}>Track Worker</Text>
                      </TouchableOpacity>
                    )}

                    {canBookAgain && (
                      <TouchableOpacity
                        style={s.bookAgainBtn}
                        onPress={() => onBookAgain(booking)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh-outline" size={14} color="#22C55E" />
                        <Text style={s.bookAgainBtnText}>Book Again</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Request actions */}
                  {canRequest && (
                    <View style={s.requestActions}>
                      <TouchableOpacity
                        style={s.rescheduleBtn}
                        onPress={() => {
                          setRequestModal({ booking, type: 'reschedule' });
                          setRequestReason('');
                          setRequestDate('');
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={13} color="#60A5FA" />
                        <Text style={s.rescheduleBtnText}>Reschedule</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.cancelBtn}
                        onPress={() => openCancelModal(booking)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle-outline" size={13} color="#F87171" />
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Request modal ─────────────────────────────── */}
      <Modal
        visible={requestModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => closeRequestModal()}
      >
        <View style={m.overlay}>
          {/*
            overflow:'hidden' clips PrismTopLine + PrismLeftBar and
            the absoluteFillObject body tint to the modal's borderRadius.
          */}
          <View style={m.card}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Header */}
            <View style={m.cardHeader}>
              <View style={[
                m.headerIconBox,
                requestModal?.type === 'cancel' ? m.headerIconCancel : m.headerIconReschedule,
              ]}>
                <Ionicons
                  name={requestModal?.type === 'cancel' ? 'close-circle-outline' : 'calendar-outline'}
                  size={18}
                  color={requestModal?.type === 'cancel' ? '#F87171' : '#60A5FA'}
                />
              </View>
              <Text style={m.title}>
                {requestModal?.type === 'cancel' ? 'Request Cancellation' : 'Request Reschedule'}
              </Text>
              <TouchableOpacity
                style={m.closeBtn}
                onPress={() => closeRequestModal()}
                disabled={submitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={15} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Cancellation fee info */}
            {requestModal?.type === 'cancel' && feeLoading && (
              <View style={m.feeLoading}>
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
                <Text style={m.feeLoadingText}>Checking cancellation policy…</Text>
              </View>
            )}
            {requestModal?.type === 'cancel'
              && cancellationFeeInfo?.feeEnabled
              && !cancellationFeeInfo?.withinFreeWindow
              && cancellationFeeInfo?.calculatedFee > 0 && (
              <View style={m.feeWarning}>
                <Ionicons name="warning-outline" size={15} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={m.feeWarningTitle}>Cancellation Fee May Apply</Text>
                  <Text style={m.feeWarningText}>
                    Your appointment is in {Math.round(cancellationFeeInfo.hoursUntilAppointment)}h —
                    outside the {cancellationFeeInfo.freeWindowHours}h free window.
                    Fee: {cancellationFeeInfo.calculatedFee?.toFixed(2)} QAR.
                  </Text>
                </View>
              </View>
            )}
            {requestModal?.type === 'cancel'
              && cancellationFeeInfo?.feeEnabled
              && cancellationFeeInfo?.withinFreeWindow && (
              <View style={m.feeFree}>
                <Ionicons name="checkmark-circle-outline" size={15} color="#22C55E" />
                <View style={{ flex: 1 }}>
                  <Text style={m.feeFreeTitle}>Free Cancellation</Text>
                  <Text style={m.feeFreeText}>You're within the free window — no charge will apply.</Text>
                </View>
              </View>
            )}

            <FieldLabel>Reason</FieldLabel>
            <ModalInput
              placeholder="Tell us why…"
              value={requestReason}
              onChangeText={setRequestReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {requestModal?.type === 'reschedule' && (
              <>
                <FieldLabel>Preferred Date</FieldLabel>
                <ModalInput
                  placeholder="e.g. 15 Apr 2026"
                  value={requestDate}
                  onChangeText={setRequestDate}
                />
              </>
            )}

            <View style={m.btnRow}>
              <TouchableOpacity
                style={m.dismissBtn}
                onPress={() => closeRequestModal()}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={m.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>

              {/* Submit — gradient wrapped, opacity applied to wrapper */}
              <View style={[m.submitBtnWrap, submitting && m.btnDisabled]}>
                <LinearGradient
                  colors={[theme.colors.primary, G(0.82)]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  style={m.submitBtnTouch}
                  onPress={submitRequest}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color={theme.colors.ink} />
                    : <Text style={m.submitBtnText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ── Utility styles ────────────────────────────────────────── */
const u = StyleSheet.create({
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
  fieldLabel: {
    fontSize: 9, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 1.2, color: theme.colors.textMuted, marginBottom: 7,
  },
});

/* ── Screen styles ─────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  /* Page header */
  pageHeader: { marginBottom: 18 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 7, alignSelf: 'flex-start', marginBottom: 12,
  },
  eyebrowLine: { height: 1, width: 22 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  heading:     { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sub:         { color: theme.colors.textMuted, fontSize: 14 },

  /* Error banner */
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 12, padding: 12,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 12, fontWeight: '500' },

  /* Loyalty card — overflow:'hidden' added */
  loyaltyCard: {
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.3)',
    borderRadius: 20, backgroundColor: 'rgba(33,28,58,0.9)',
    padding: 16, marginBottom: 14,
    overflow: 'hidden',
  },
  loyaltyHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  loyaltyEyebrow:   { color: '#C4B5FD', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  loyaltyTitle:     { color: '#FACC15', fontWeight: '900', fontSize: 20 },
  loyaltySub:       { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 },
  loyaltyBadge: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 14, backgroundColor: 'rgba(35,23,77,0.8)',
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 56,
  },
  loyaltyBadgeNum:   { color: '#FDE68A', fontWeight: '900', fontSize: 22 },
  loyaltyBadgeLabel: { color: 'rgba(253,230,138,0.6)', fontSize: 9, fontWeight: '600', marginTop: 1 },

  /* Review unlock */
  reviewUnlockCard: {
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 14, backgroundColor: 'rgba(58,37,7,0.8)',
    padding: 14, marginBottom: 14,
  },
  reviewUnlockHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  reviewUnlockTitle:     { color: '#FDE68A', fontWeight: '800', fontSize: 14 },
  reviewUnlockText:      { color: 'rgba(254,243,199,0.7)', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  reviewUnlockActions:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FBBF24', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  googleBtnText: { color: '#1C1917', fontWeight: '800', fontSize: 13 },
  unlockBtn: {
    borderWidth: 1, borderColor: 'rgba(253,230,138,0.4)',
    borderRadius: 20, backgroundColor: 'rgba(91,58,14,0.8)',
    paddingHorizontal: 14, paddingVertical: 9,
  },
  unlockBtnText: { color: '#FEF3C7', fontWeight: '800', fontSize: 13 },
  btnDisabled:   { opacity: 0.55 },

  /* Programs */
  programWrap:    { marginBottom: 14 },
  programHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  programName:    { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 13 },
  programCount:   { color: '#C7D2FE', fontSize: 12, fontWeight: '700' },
  slotRow:        { flexDirection: 'row', gap: 8, marginBottom: 10 },
  slot: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(109,99,168,0.6)', backgroundColor: 'rgba(29,23,59,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotFilled:   { borderColor: '#FBBF24', backgroundColor: '#FBBF24' },
  slotNum:      { color: '#C4B5FD', fontWeight: '900', fontSize: 14 },
  progressBg:   { backgroundColor: 'rgba(30,27,75,0.8)', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 8, borderRadius: 20 },   /* backgroundColor removed — using LinearGradient child */
  programHint:  { color: 'rgba(221,214,254,0.7)', fontSize: 11, lineHeight: 17 },

  /* Coupons */
  couponCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(97,87,168,0.4)',
    borderRadius: 12, backgroundColor: 'rgba(42,35,80,0.7)',
    padding: 10, marginTop: 8,
  },
  couponIconBox: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  couponName: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 12 },
  couponCode: { color: '#FDE68A', fontWeight: '900', fontSize: 13, marginTop: 2, letterSpacing: 0.5 },

  /* Empty state */
  emptyWrap: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 20, backgroundColor: 'rgba(19,27,37,0.8)',
    marginBottom: 14, gap: 10,
  },
  emptyIconRingOuter: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyIconRingInner: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(19,27,37,0.90)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:    { color: theme.colors.text, fontWeight: '900', fontSize: 20 },
  emptyBody:     { color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, fontSize: 13 },
  emptyBtnWrap:  { borderRadius: 20, overflow: 'hidden', marginTop: 4 },
  emptyBtnTouch: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 11, paddingHorizontal: 20,
  },
  emptyBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },

  /* Booking cards */
  bookingCard: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.card.bg,
    marginBottom: 12, overflow: 'hidden',
    ...theme.shadow.card,
  },
  bookingAccent:   { width: 4 },
  bookingBody:     { flex: 1, padding: 14 },
  bookingTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bookingNum:      { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
  statusPill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusPillText:  { fontSize: 11, fontWeight: '800' },
  subscriptionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#8b5cf640',
    backgroundColor: '#8b5cf615',
  },
  subscriptionBadgeText: { fontSize: 10, fontWeight: '700', color: '#8b5cf6' },
  statusMessageRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginBottom: 10, paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statusMessageText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  bookingInfoGrid: { gap: 5, marginBottom: 10 },
  bookingInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookingInfoText: { color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  expandToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 6,
  },
  expandToggleText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  pkgDetailCard: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10, marginBottom: 8,
  },
  pkgDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  pkgDetailName:   { color: theme.colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  pkgTierPill:     { backgroundColor: G(0.12), borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pkgTierText:     { color: theme.colors.primary, fontSize: 10, fontWeight: '700' },
  pkgDetailDesc:   { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  serviceList:     { gap: 4 },
  serviceRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceText:     { color: theme.colors.text, fontSize: 12, fontWeight: '500' },

  /* Primary actions */
  bookingActions: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  viewBtnWrap:    { flex: 1, borderRadius: 12, overflow: 'hidden' },
  viewBtnTouch: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10,
  },
  viewBtnText:      { color: theme.colors.ink, fontWeight: '800', fontSize: 13 },
  bookAgainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.07)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  bookAgainBtnText: { color: '#22C55E', fontWeight: '700', fontSize: 13 },

  /* Request actions */
  requestActions: { flexDirection: 'row', gap: 8 },
  rescheduleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    backgroundColor: 'rgba(14,36,75,0.5)', borderRadius: 12, paddingVertical: 9,
  },
  rescheduleBtnText: { color: '#60A5FA', fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    backgroundColor: 'rgba(42,10,10,0.5)', borderRadius: 12, paddingVertical: 9,
  },
  cancelBtnText: { color: '#F87171', fontWeight: '700', fontSize: 13 },
});

/* ── Modal styles ──────────────────────────────────────────── */
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center', alignItems: 'center', padding: PADDING,
  },
  /* overflow:'hidden' clips PrismTopLine + PrismLeftBar to borderRadius */
  card: {
    width: '100%',
    backgroundColor: theme.card.bg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  headerIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerIconCancel:     { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)' },
  headerIconReschedule: { backgroundColor: 'rgba(96,165,250,0.12)',  borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)'  },
  title:    { color: theme.colors.text, fontWeight: '900', fontSize: 17, flex: 1 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Fee info */
  feeLoading:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  feeLoadingText:  { color: theme.colors.textMuted, fontSize: 12 },
  feeWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14,
    backgroundColor: 'rgba(28,18,0,0.8)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 12, padding: 12,
  },
  feeWarningTitle: { color: '#FBBF24', fontWeight: '800', fontSize: 12, marginBottom: 3 },
  feeWarningText:  { color: 'rgba(254,243,199,0.7)', fontSize: 12, lineHeight: 17 },
  feeFree: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14,
    backgroundColor: 'rgba(5,46,22,0.5)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 12, padding: 12,
  },
  feeFreeTitle: { color: '#22C55E', fontWeight: '800', fontSize: 12, marginBottom: 3 },
  feeFreeText:  { color: 'rgba(220,252,231,0.7)', fontSize: 12, lineHeight: 17 },

  /* Focus-aware inputs */
  inputBox: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    backgroundColor: theme.colors.inputBg, marginBottom: 14, paddingHorizontal: 13,
  },
  inputBoxFocused:   { borderColor: G(0.65) },
  inputBoxMultiline: { paddingVertical: 4 },
  inputText:         { color: theme.colors.text, fontSize: 14, paddingVertical: 12 },

  /* Action buttons */
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  dismissBtn: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dismissBtnText: { color: theme.colors.text, fontWeight: '700' },
  submitBtnWrap:  { flex: 1, borderRadius: 12, overflow: 'hidden' },
  submitBtnTouch: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  submitBtnText:  { color: theme.colors.ink, fontWeight: '800' },
  btnDisabled:    { opacity: 0.55 },
});