import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { bookingsAPI } from '../api/bookings';
import { useAuth } from '../context/AuthContext';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const PADDING = 20;

// ─── Info row helper ──────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <View style={s.infoRow}>
    <View style={s.infoIconBox}>
      <Ionicons name={icon} size={13} color={theme.colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ─── Section card ──────────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

const SectionLabel = ({ children, icon }) => (
  <View style={s.sectionRow}>
    {!!icon && <Ionicons name={icon} size={14} color={theme.colors.primary} />}
    <Text style={s.sectionLabel}>{children}</Text>
  </View>
);

// ─── Status-driven content ────────────────────────────────────────────────────
function getStatusContent(status) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return {
        ringBg:    '#0F766E',
        ringBorder:'#14B8A6',
        iconName:  'checkmark-done',
        eyebrow:   'Service Completed',
        eyebrowColor: '#5EEAD4',
        title:     'Your vehicle is clean!',
        titleColor:'#F0FDFA',
        body:      'Thank you for choosing Glanz. We hope you love the results.',
        bodyColor: '#CCFBF1',
        cardBorder:'rgba(20,184,166,0.25)',
        cardBg:    'rgba(4,47,46,0.45)',
        pillBorder:'rgba(20,184,166,0.2)',
        pillBg:    'rgba(15,70,68,0.7)',
        pillLabel: '#5EEAD4',
        pillValue: '#CCFBF1',
        steps: [
          { icon: 'checkmark-circle', color: '#14B8A6', text: 'Service has been completed successfully.' },
          { icon: 'star-outline',     color: '#FBBF24', text: 'Leave a review from My Bookings — we\'d love your feedback.' },
          { icon: 'refresh-outline',  color: '#A78BFA', text: 'Enjoyed it? Book again anytime from the Booking screen.' },
        ],
      };
    case 'cancelled':
      return {
        ringBg:    '#9F1239',
        ringBorder:'#F43F5E',
        iconName:  'close',
        eyebrow:   'Booking Cancelled',
        eyebrowColor: '#FDA4AF',
        title:     'This booking was cancelled',
        titleColor:'#FFF1F2',
        body:      'Your booking has been cancelled. You can make a new booking anytime.',
        bodyColor: '#FFE4E6',
        cardBorder:'rgba(244,63,94,0.25)',
        cardBg:    'rgba(76,5,25,0.45)',
        pillBorder:'rgba(244,63,94,0.2)',
        pillBg:    'rgba(76,5,25,0.7)',
        pillLabel: '#FDA4AF',
        pillValue: '#FFE4E6',
        steps: [
          { icon: 'close-circle-outline', color: '#F43F5E', text: 'This booking has been cancelled.' },
          { icon: 'headset-outline',      color: '#60A5FA', text: 'Contact our team if you have any questions.' },
          { icon: 'add-circle-outline',   color: '#22C55E', text: 'Ready to rebook? Start a new booking from the home screen.' },
        ],
      };
    case 'cancellationrequested':
    case 'cancellation requested':
      return {
        ringBg:    '#92400E',
        ringBorder:'#F59E0B',
        iconName:  'time-outline',
        eyebrow:   'Cancellation Requested',
        eyebrowColor: '#FCD34D',
        title:     'Request under review',
        titleColor:'#FFFBEB',
        body:      'Your cancellation request has been submitted. Our team will contact you shortly.',
        bodyColor: '#FEF3C7',
        cardBorder:'rgba(245,158,11,0.25)',
        cardBg:    'rgba(55,23,5,0.45)',
        pillBorder:'rgba(245,158,11,0.2)',
        pillBg:    'rgba(55,23,5,0.7)',
        pillLabel: '#FCD34D',
        pillValue: '#FEF3C7',
        steps: [
          { icon: 'hourglass-outline',    color: '#F59E0B', text: 'Cancellation request received and under review.' },
          { icon: 'notifications-outline',color: '#60A5FA', text: 'You\'ll be notified once the request is processed.' },
          { icon: 'headset-outline',      color: '#A78BFA', text: 'Contact support if you need urgent assistance.' },
        ],
      };
    case 'reschedulerequested':
    case 'reschedule requested':
      return {
        ringBg:    '#1E3A5F',
        ringBorder:'#60A5FA',
        iconName:  'calendar-outline',
        eyebrow:   'Reschedule Requested',
        eyebrowColor: '#93C5FD',
        title:     'Request under review',
        titleColor:'#EFF6FF',
        body:      'Your reschedule request has been submitted. Our team will confirm a new date soon.',
        bodyColor: '#DBEAFE',
        cardBorder:'rgba(96,165,250,0.25)',
        cardBg:    'rgba(14,36,75,0.45)',
        pillBorder:'rgba(96,165,250,0.2)',
        pillBg:    'rgba(14,36,75,0.7)',
        pillLabel: '#93C5FD',
        pillValue: '#DBEAFE',
        steps: [
          { icon: 'hourglass-outline',    color: '#60A5FA', text: 'Reschedule request received and under review.' },
          { icon: 'notifications-outline',color: '#FBBF24', text: 'You\'ll be notified once a new time is confirmed.' },
          { icon: 'headset-outline',      color: '#A78BFA', text: 'Contact support if you need to adjust your request.' },
        ],
      };
    case 'rescheduled':
      return {
        ringBg:    '#1E3A5F',
        ringBorder:'#60A5FA',
        iconName:  'calendar',
        eyebrow:   'Booking Rescheduled',
        eyebrowColor: '#93C5FD',
        title:     'New date confirmed',
        titleColor:'#EFF6FF',
        body:      'Your appointment has been moved. Check the details below for your updated date and time.',
        bodyColor: '#DBEAFE',
        cardBorder:'rgba(96,165,250,0.25)',
        cardBg:    'rgba(14,36,75,0.45)',
        pillBorder:'rgba(96,165,250,0.2)',
        pillBg:    'rgba(14,36,75,0.7)',
        pillLabel: '#93C5FD',
        pillValue: '#DBEAFE',
        steps: [
          { icon: 'checkmark-circle',     color: '#60A5FA', text: 'Your booking has been rescheduled successfully.' },
          { icon: 'person-outline',       color: '#22C55E', text: 'A detailer will be assigned for the new date.' },
          { icon: 'notifications-outline',color: '#FBBF24', text: 'Check Notifications for further updates.' },
        ],
      };
    case 'in progress':
    case 'inprogress':
      return {
        ringBg:    '#1E3A5F',
        ringBorder:'#3B82F6',
        iconName:  'car',
        eyebrow:   'In Progress',
        eyebrowColor: '#93C5FD',
        title:     'We\'re cleaning your vehicle',
        titleColor:'#EFF6FF',
        body:      'Your detailer is working on your vehicle right now. Sit back and relax!',
        bodyColor: '#DBEAFE',
        cardBorder:'rgba(59,130,246,0.25)',
        cardBg:    'rgba(14,36,75,0.45)',
        pillBorder:'rgba(59,130,246,0.2)',
        pillBg:    'rgba(14,36,75,0.7)',
        pillLabel: '#93C5FD',
        pillValue: '#DBEAFE',
        steps: [
          { icon: 'car-outline',          color: '#3B82F6', text: 'Your vehicle is currently being serviced.' },
          { icon: 'notifications-outline',color: '#FBBF24', text: 'You\'ll be notified as soon as the service is done.' },
        ],
      };
    case 'pending':
      return {
        ringBg:    '#78350F',
        ringBorder:'#F59E0B',
        iconName:  'hourglass-outline',
        eyebrow:   'Awaiting Confirmation',
        eyebrowColor: '#FCD34D',
        title:     'Booking received',
        titleColor:'#FFFBEB',
        body:      'We\'ve received your booking and our team will confirm it shortly.',
        bodyColor: '#FEF3C7',
        cardBorder:'rgba(245,158,11,0.25)',
        cardBg:    'rgba(41,24,4,0.45)',
        pillBorder:'rgba(245,158,11,0.2)',
        pillBg:    'rgba(41,24,4,0.7)',
        pillLabel: '#FCD34D',
        pillValue: '#FEF3C7',
        steps: [
          { icon: 'hourglass-outline',    color: '#F59E0B', text: 'Your booking is pending confirmation from our team.' },
          { icon: 'person-outline',       color: '#60A5FA', text: 'A detailer will be assigned once confirmed.' },
          { icon: 'notifications-outline',color: '#FBBF24', text: 'Check Notifications for status updates.' },
        ],
      };
    default: // 'confirmed' and fallback
      return {
        ringBg:    '#16A34A',
        ringBorder:'#22C55E',
        iconName:  'checkmark',
        eyebrow:   'Booking Confirmed',
        eyebrowColor: '#86EFAC',
        title:     'Your wash is locked in',
        titleColor:'#F0FDF4',
        body:      'Your appointment is saved and your details are ready below.',
        bodyColor: '#DCFCE7',
        cardBorder:'rgba(34,197,94,0.25)',
        cardBg:    'rgba(5,46,22,0.4)',
        pillBorder:'rgba(34,197,94,0.2)',
        pillBg:    'rgba(20,48,33,0.7)',
        pillLabel: '#86EFAC',
        pillValue: '#D1FAE5',
        steps: [
          { icon: 'checkmark-circle',    color: '#22C55E', text: 'Your booking is confirmed and saved.' },
          { icon: 'person-outline',       color: '#60A5FA', text: 'A detailer will be assigned to your booking.' },
          { icon: 'notifications-outline',color: '#FBBF24', text: 'Check Notifications for status updates.' },
          { icon: 'star-outline',         color: '#A78BFA', text: 'After your wash, leave a review from My Bookings.' },
        ],
      };
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingConfirmationScreen({ route, navigation }) {
  const bookingNumber = route?.params?.bookingNumber;
  const { isAdmin }   = useAuth();
  const headerHeight  = useHeaderHeight();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadBooking = useCallback(async () => {
    try {
      const data = await bookingsAPI.getByBookingNumber(bookingNumber);
      setBooking(data);
    } finally { setLoading(false); }
  }, [bookingNumber]);

  useEffect(() => {
    setLoading(true);
    loadBooking();
  }, [loadBooking]);

  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking])
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={36} color="#FCA5A5" style={{ marginBottom: 10 }} />
        <Text style={s.errorText}>Booking not found</Text>
      </View>
    );
  }

  const scheduledDate = new Date(booking.scheduledDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });

  const vehicleText = [booking.vehicleYear, booking.vehicleMake, booking.vehicleModel]
    .filter(Boolean).join(' ') || '—';

  const sc = getStatusContent(booking.status);
  const canTrackWorker = Boolean(booking.workerOnMyWayAt)
    && !booking.workerArrivedAt
    && booking.status !== 'Completed'
    && booking.status !== 'Cancelled';

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
    >

      {/* ── Status hero ────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.springify()} style={[s.heroCard, { borderColor: sc.cardBorder, backgroundColor: sc.cardBg }]}>
        <Animated.View entering={ZoomIn.duration(500).delay(120)} style={[s.successRing, { backgroundColor: sc.ringBg, borderColor: sc.ringBorder }]}>
          <Ionicons name={sc.iconName} size={34} color="#FFFFFF" />
        </Animated.View>

        <Animated.Text entering={FadeInUp.duration(400).delay(220)} style={[s.heroEyebrow, { color: sc.eyebrowColor }]}>
          {sc.eyebrow}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(400).delay(290)} style={[s.heroTitle, { color: sc.titleColor }]}>
          {sc.title}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(400).delay(360)} style={[s.heroBody, { color: sc.bodyColor }]}>
          {sc.body}
        </Animated.Text>

        {/* Booking number pill */}
        <Animated.View entering={FadeInUp.duration(400).delay(440)} style={[s.bookingNumPill, { borderColor: sc.pillBorder, backgroundColor: sc.pillBg }]}>
          <Text style={[s.bookingNumLabel, { color: sc.pillLabel }]}>Booking Reference</Text>
          <Text style={[s.bookingNumValue, { color: sc.pillValue }]}>{booking.bookingNumber}</Text>
        </Animated.View>
      </Animated.View>

      {/* ── Appointment details ────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(160)}>
        <Card>
          <SectionLabel icon="calendar-outline">Appointment Details</SectionLabel>
          <InfoRow icon="calendar-outline"  label="Date"    value={scheduledDate} />
          <InfoRow icon="time-outline"      label="Time"    value={booking.timeSlot} />
          <InfoRow icon="mail-outline"      label="Email"   value={booking.customerEmail} />
          <InfoRow icon="call-outline"      label="Phone"   value={booking.customerPhone} />
          {!!booking.customerAddress && (
            <InfoRow icon="location-outline" label="Address" value={booking.customerAddress} />
          )}
          <InfoRow icon="car-outline"       label="Vehicle" value={vehicleText} />
        </Card>
      </Animated.View>

      {/* ── Packages ───────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(220)}>
        <Card style={{ marginTop: 12 }}>
          <SectionLabel icon="cube-outline">Packages</SectionLabel>

          {(booking.items || []).map((item, idx) => (
            <View key={`${item.packageId}-${idx}`} style={s.pkgItem}>
              <View style={s.pkgItemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pkgName}>{item.packageName}</Text>
                  <View style={s.pkgTierRow}>
                    <View style={s.pkgTierPill}>
                      <Text style={s.pkgTierText}>{item.packageTier}</Text>
                    </View>
                  </View>
                </View>
                <Text style={s.pkgPrice}>{formatQAR(item.subtotal)}</Text>
              </View>

              {!!item.packageDescription && (
                <Text style={s.pkgDesc}>{item.packageDescription}</Text>
              )}

              {(item.includedServices || []).length > 0 && (
                <View style={s.servicesBox}>
                  <Text style={s.servicesLabel}>What's included</Text>
                  {(item.includedServices || []).map((svc, i) => (
                    <View key={`${item.packageId}-svc-${i}`} style={s.serviceRow}>
                      <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} />
                      <Text style={s.serviceText}>{svc}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Total */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Amount</Text>
            <Text style={s.totalValue}>{formatQAR(booking.totalAmount)}</Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Special instructions ───────────────────────────────── */}
      {!!booking.specialInstructions && (
        <Animated.View entering={FadeInUp.duration(420).delay(260)}>
          <Card style={{ marginTop: 12 }}>
            <SectionLabel icon="chatbox-ellipses-outline">Special Instructions</SectionLabel>
            <Text style={s.specialInstructions}>{booking.specialInstructions}</Text>
          </Card>
        </Animated.View>
      )}

      {/* ── Payment ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(300)}>
        <Card style={{ marginTop: 12 }}>
          <SectionLabel icon="card-outline">Payment</SectionLabel>
          <View style={s.paymentRow}>
            <View style={s.paymentBadge}>
              <Ionicons name="card-outline" size={14} color="#22C55E" />
              <Text style={s.paymentBadgeText}>Pay on Service</Text>
            </View>
            <Text style={s.paymentNote}>
              Payment will be collected by your detailer at the time of service.
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* ── Next steps ─────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(340)}>
        <Card style={{ marginTop: 12 }}>
          <SectionLabel icon="arrow-forward-circle-outline">What happens next?</SectionLabel>
          {sc.steps.map((step, i) => (
            <View key={i} style={s.nextStep}>
              <View style={[s.nextStepIconBox, { backgroundColor: `${step.color}18` }]}>
                <Ionicons name={step.icon} size={16} color={step.color} />
              </View>
              <Text style={s.nextStepText}>{step.text}</Text>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Actions ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(380)} style={s.actions}>
        {canTrackWorker && (
          <TouchableOpacity
            style={s.trackBtn}
            onPress={() => navigation.navigate('Live Tracking', {
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber,
            })}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
            <Text style={s.trackBtnText}>Track Worker</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.navigate(
            isAdmin ? 'All Jobs' : 'Main',
            isAdmin ? undefined : { screen: 'My Bookings' }
          )}
          activeOpacity={0.85}
        >
          <Ionicons name={isAdmin ? 'list-outline' : 'receipt-outline'} size={16} color={theme.colors.ink} />
          <Text style={s.primaryBtnText}>{isAdmin ? 'Open All Jobs' : 'View My Bookings'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => navigation.navigate(
            isAdmin ? 'Admin Overview' : 'Main',
            isAdmin ? undefined : { screen: 'Home' }
          )}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={16} color={theme.colors.primary} />
          <Text style={s.secondaryBtnText}>Return Home</Text>
        </TouchableOpacity>
      </Animated.View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  errorText: { color: '#FCA5A5', fontSize: 16, fontWeight: '600' },

  // Hero
  heroCard: {
    alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 22, backgroundColor: 'rgba(5,46,22,0.4)',
    padding: 24, marginBottom: 12,
  },
  successRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#16A34A',
    borderWidth: 3, borderColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  heroEyebrow: {
    color: '#86EFAC', fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  heroTitle:   { color: '#F0FDF4', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  heroBody:    { color: '#DCFCE7', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 18 },

  // Booking number pill
  bookingNumPill: {
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 14, backgroundColor: 'rgba(20,48,33,0.7)',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  bookingNumLabel: {
    color: '#86EFAC', fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5,
  },
  bookingNumValue: { color: '#D1FAE5', fontWeight: '900', fontSize: 20, letterSpacing: 0.5 },

  // Cards
  card: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 16,
  },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  sectionLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '800', flex: 1 },

  // Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 10,
  },
  infoIconBox: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    backgroundColor: 'rgba(200,169,107,0.1)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  infoLabel: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  infoValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Package items
  pkgItem: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 10,
  },
  pkgItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  pkgName:       { color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 5 },
  pkgTierRow:    { flexDirection: 'row' },
  pkgTierPill:   { backgroundColor: 'rgba(200,169,107,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pkgTierText:   { color: theme.colors.primary, fontSize: 10, fontWeight: '700' },
  pkgPrice:      { color: theme.colors.primary, fontWeight: '900', fontSize: 16, flexShrink: 0 },
  pkgDesc:       { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 10 },

  // Services inside package
  servicesBox: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, padding: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  servicesLabel: {
    color: theme.colors.mist, fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  serviceRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  serviceText: { color: theme.colors.text, fontSize: 12, fontWeight: '500', flex: 1 },

  // Total
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  totalLabel: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  totalValue: { color: theme.colors.primary, fontWeight: '900', fontSize: 22 },

  // Special instructions
  specialInstructions: { color: theme.colors.text, fontSize: 13, lineHeight: 20 },

  // Payment
  paymentRow: { gap: 10 },
  paymentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    backgroundColor: 'rgba(5,46,22,0.5)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  paymentBadgeText: { color: '#22C55E', fontWeight: '700', fontSize: 13 },
  paymentNote:      { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },

  // Next steps
  nextStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  nextStepIconBox: {
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  nextStepText: { color: theme.colors.text, flex: 1, lineHeight: 20, fontSize: 13 },

  // Actions
  actions: { marginTop: 16, gap: 10 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 14, paddingVertical: 14,
  },
  trackBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14, paddingVertical: 14,
  },
  primaryBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: 'rgba(200,169,107,0.3)',
    backgroundColor: 'rgba(200,169,107,0.06)',
    borderRadius: 14, paddingVertical: 14,
  },
  secondaryBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
});