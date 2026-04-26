import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { bookingsAPI } from '../api/bookings';
import { offersAPI } from '../api/offers';
import { vehiclesAPI } from '../api/vehicles';
import { subscriptionsAPI } from '../api/subscriptions';
import { paymentsAPI } from '../api/payments';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeaturesContext';
import { useSettings } from '../context/SettingsContext';
import { usePackages } from '../context/PackagesContext';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatQAR } from '../utils/currency';
import { toDateKey, parseDateKey } from '../utils/dateUtils';
import { theme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';

// ─── Constants ────────────────────────────────────────────────────────────────
// Vehicle multipliers, buffer minutes, and vehicle badge text are backend-driven.
// Values come from SettingsContext (loaded at startup, falls back to backend defaults).

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── ORIGINAL availability colors — unchanged ──────────────────────────────────
const availabilityColors = {
  available: { bg: '#0D2318', border: '#166534', text: '#DCFCE7', dot: '#4ADE80', label: 'Free'   },
  medium:    { bg: '#1C1506', border: '#92400E', text: '#FEF3C7', dot: '#FBBF24', label: 'Medium' },
  full:      { bg: '#1C0A0A', border: '#7F1D1D', text: '#FECACA', dot: '#F87171', label: 'Busy'   },
  disabled:  { bg: '#0D1117', border: '#1F2937', text: '#374151', dot: '#1F2937', label: 'Past'   },
};

const PAYMENT_METHODS = [
  { id: 'card',   label: 'Credit / Debit Card', icon: 'card-outline'  },
  { id: 'apple',  label: 'Apple Pay',           icon: 'logo-apple'    },
  { id: 'google', label: 'Google Pay',          icon: 'logo-google'   },
];

// ─── Helpers — ALL UNCHANGED FROM ORIGINAL ────────────────────────────────────
const calculateEndTime = (startTime, durationMinutes) => {
  if (!startTime || !durationMinutes) return '';
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  let hours   = Number(match[1]);
  let minutes = Number(match[2]);
  minutes += durationMinutes;
  hours   += Math.floor(minutes / 60);
  minutes  = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
const getSlotStartTime = (slot) => String(slot || '').split('-')[0]?.trim() || '';
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return toDateKey(d);
};
const adjustedPrice = (basePrice, multiplier) =>
  Math.round(basePrice * multiplier * 100) / 100;

// ─── Reusable layout helpers ──────────────────────────────────────────────────
// Redesigned: step number prefix + right divider line
const SectionHeader = ({ children, icon, step, style }) => (
  <View style={[h.sectionHeaderRow, style]}>
    {step !== undefined && (
      <Text style={h.sectionStep}>{String(step).padStart(2, '0')}</Text>
    )}
    {!!icon && <Ionicons name={icon} size={16} color={theme.colors.primary} />}
    <Text style={h.sectionTitle}>{children}</Text>
    <View style={h.sectionDivider} />
  </View>
);

const Card = ({ children, style }) => (
  <View style={[h.card, style]}>{children}</View>
);

const FieldLabel = ({ children }) => (
  <Text style={h.fieldLabel}>{children}</Text>
);

// Redesigned: icon sits inside a tinted box
const ErrorBanner = ({ message }) => (
  <View style={h.errorBanner}>
    <View style={h.errorIconBox}>
      <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
    </View>
    <Text style={h.errorText}>{message}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingScreen({ navigation, route }) {
  const selectedFromPackages = route?.params?.selectedPackage;
  const rebookFromBooking    = route?.params?.rebookFromBooking;
  const { user, isAdmin }               = useAuth();
  const { payments }                    = useFeatures();
  const settings                        = useSettings();
  // vehicleTypeOptions derived from backend multipliers — badge text updates automatically
  // when admin changes multipliers in System Settings without a code deploy.
  const vehicleTypeOptions = useMemo(() => {
    const mult  = settings.vehicleMultipliers;
    const badge = (m) => {
      if (m === 1.0) return 'Base';
      const pct = Math.round((m - 1) * 100);
      return pct < 0 ? `${pct}%` : `+${pct}%`;
    };
    return [
      { value: 'Motorcycle', label: 'Motorcycle', badge: badge(mult.Motorcycle ?? 0.8), badgeColor: { bg: 'rgba(64,196,99,0.1)',    border: 'rgba(64,196,99,0.25)',    text: '#4ADE80'              } },
      { value: 'Sedan',      label: 'Sedan',      badge: badge(mult.Sedan      ?? 1.0), badgeColor: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)',   text: theme.colors.textMuted } },
      { value: 'SUV',        label: 'SUV / 4×4',  badge: badge(mult.SUV        ?? 1.25),badgeColor: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',    text: '#FBBF24'              } },
      { value: 'Pickup',     label: 'Pickup',      badge: badge(mult.Pickup     ?? 1.5), badgeColor: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',    text: '#FBBF24'              } },
    ];
  }, [settings.vehicleMultipliers]);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const headerHeight            = useHeaderHeight();
  const scrollHeader            = useScrollHeader();

  // ── Idempotency key — generated once per BookingScreen mount ─────────────
  // Same key is sent on every retry attempt, so the server can detect
  // and return the existing booking instead of creating a duplicate.
  const idempotencyKey = useRef(
    `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const canAutofillCustomerData = !!user && !isAdmin;
  const normalizedPreferredAddressType = user?.preferredAddressType || 'Home';
  const savedAddresses = {
    Home:  { address: canAutofillCustomerData ? user?.homeAddress?.trim()  || '' : '', houseNumber: canAutofillCustomerData ? user?.homeHouseNumber?.trim()  || '' : '' },
    Work:  { address: canAutofillCustomerData ? user?.workAddress?.trim()  || '' : '', houseNumber: canAutofillCustomerData ? user?.workHouseNumber?.trim()  || '' : '' },
    Other: { address: canAutofillCustomerData ? user?.otherAddress?.trim() || '' : '', houseNumber: canAutofillCustomerData ? user?.otherHouseNumber?.trim() || '' : '' },
  };
  const savedAddress       = savedAddresses[normalizedPreferredAddressType] || {};
  const needsManualAddress = !canAutofillCustomerData || !savedAddress.address;

  const { packages, packagesLoading, fetchPackages } = usePackages();
  const [selectedPackages,    setSelectedPackages]    = useState([]);
  const [myCoupons,           setMyCoupons]           = useState([]);
  const [savedVehicles,       setSavedVehicles]       = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [submitting,          setSubmitting]          = useState(false);
  const [slotsLoading,        setSlotsLoading]        = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availableSlots,      setAvailableSlots]      = useState(null);
  const [availabilityByDate,  setAvailabilityByDate]  = useState({});
  const [calendarMonth,       setCalendarMonth]       = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [error, setError] = useState('');

  const [mySubscription,  setMySubscription]  = useState(null);
  const [subLoading,      setSubLoading]      = useState(false);

  useEffect(() => {
    if (!canAutofillCustomerData) {
      setMySubscription(null);
      return;
    }
    let cancelled = false;
    setSubLoading(true);
    subscriptionsAPI.getMySubscription()
      .then((sub) => { if (!cancelled) setMySubscription(sub || null); })
      .catch(() => {  if (!cancelled) setMySubscription(null); })
      .finally(() => { if (!cancelled) setSubLoading(false); });
    return () => { cancelled = true; };
  }, [canAutofillCustomerData, user?.id]);
  const [form, setForm] = useState({
    scheduledDate:         toDateKey(new Date()),
    timeSlot:              '',
    customerName:          canAutofillCustomerData ? `${user.firstName} ${user.lastName}` : '',
    customerEmail:         canAutofillCustomerData ? user?.email  || '' : '',
    customerPhone:         canAutofillCustomerData ? user?.phone  || '' : '',
    customerAddress:       canAutofillCustomerData ? savedAddress.address     : '',
    houseNumber:           canAutofillCustomerData ? savedAddress.houseNumber : '',
    addressType:           savedAddress.address ? normalizedPreferredAddressType : 'Home',
    vehicleType:           'Sedan',
    vehicleMake:           '',
    vehicleModel:          '',
    vehicleYear:           '',
    specialInstructions:   '',
    offerCode:             '',
    paymentMethod:         'card',
  });

  const vehicleMultiplier = settings.vehicleMultipliers[form.vehicleType] ?? 1.0;
  const activeSubscription = mySubscription?.isActive ? mySubscription : null;
  const subscriptionMatchesVehicle = activeSubscription?.vehicleType === form.vehicleType;
  const subscriptionDiscountPercent = subscriptionMatchesVehicle
    ? Number(activeSubscription?.discountPercent || 0)
    : 0;

  const handleLoadSavedAddress = (addressType) => {
    const saved = savedAddresses[addressType];
    if (saved.address) {
      setForm((prev) => ({ ...prev, customerAddress: saved.address, houseNumber: saved.houseNumber || '', addressType }));
    }
  };

  // ── All effects & handlers — IDENTICAL TO ORIGINAL ───────────────────────────
  useEffect(() => {
    if (user && canAutofillCustomerData) {
      setForm((prev) => ({
        ...prev,
        customerName:    prev.customerName    || `${user.firstName} ${user.lastName}`.trim(),
        customerEmail:   prev.customerEmail   || user.email  || '',
        customerPhone:   prev.customerPhone   || user.phone  || '',
        customerAddress: prev.customerAddress || savedAddress.address     || '',
        houseNumber:     prev.houseNumber     || savedAddress.houseNumber || '',
        addressType:     prev.addressType     || (savedAddress.address ? normalizedPreferredAddressType : 'Home'),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [, coupons, vehicles] = await Promise.all([
          fetchPackages(),
          offersAPI.getMyCoupons().catch(() => []),
          canAutofillCustomerData ? vehiclesAPI.getAll().catch(() => []) : Promise.resolve([]),
        ]);
        setMyCoupons(coupons || []);
        const vList = vehicles || [];
        setSavedVehicles(vList);
        if (!rebookFromBooking?.packages?.length) {
          const def = vList.find((v) => v.isDefault) || vList[0];
          if (def) {
            setForm((prev) => ({
              ...prev,
              vehicleType:  def.vehicleType || prev.vehicleType,
              vehicleMake:  def.make        || prev.vehicleMake,
              vehicleModel: def.model       || prev.vehicleModel,
              vehicleYear:  def.year        || prev.vehicleYear,
            }));
          }
        }
        if (rebookFromBooking?.packages?.length) {
          setSelectedPackages(rebookFromBooking.packages);
          setForm((prev) => ({
            ...prev,
            customerAddress:     rebookFromBooking.customerAddress     || prev.customerAddress,
            addressType:         rebookFromBooking.addressType         || prev.addressType,
            vehicleType:         rebookFromBooking.vehicleType         || prev.vehicleType,
            vehicleMake:         rebookFromBooking.vehicleMake         || prev.vehicleMake,
            vehicleModel:        rebookFromBooking.vehicleModel        || prev.vehicleModel,
            vehicleYear:         rebookFromBooking.vehicleYear         || prev.vehicleYear,
            specialInstructions: rebookFromBooking.specialInstructions || prev.specialInstructions,
          }));
        }
        if (selectedFromPackages?.id) {
          setSelectedPackages([{ packageId: selectedFromPackages.id, quantity: 1 }]);
        }
      } catch { setError('Failed to load booking data.'); }
      finally  { setLoading(false); }
    };
    load();
  }, [selectedFromPackages?.id, rebookFromBooking]);

  useEffect(() => {
    if (packages.length > 0 && selectedPackages.length === 0 && !selectedFromPackages?.id && !rebookFromBooking?.packages?.length) {
      setSelectedPackages([{ packageId: packages[0].id, quantity: 1 }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages]);

  useEffect(() => {
    const fetchMonthAvailability = async () => {
      try {
        setAvailabilityLoading(true);
        const fromDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const toDate   = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const data = await bookingsAPI.getCalendarAvailability(toDateKey(fromDate), toDateKey(toDate));
        const mapped = (data || []).reduce((acc, day) => {
          const key = String(day.date).split('T')[0];
          acc[key]  = { status: String(day.status || 'available').toLowerCase(), freeSlots: day.freeSlots, totalSlots: day.totalSlots };
          return acc;
        }, {});
        setAvailabilityByDate(mapped);
      } catch { setAvailabilityByDate({}); }
      finally  { setAvailabilityLoading(false); }
    };
    fetchMonthAvailability();
  }, [calendarMonth]);

  const totalDuration = useMemo(() =>
    selectedPackages.reduce((sum, item) => {
      const pkg = packages.find((p) => p.id === item.packageId);
      return sum + (pkg?.estimatedDurationMinutes || 0);
    }, 0),
  [packages, selectedPackages]);

  // quote: server-calculated breakdown (null = endpoint not yet deployed → use clientTotalAmount)
  const [quote, setQuote]               = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Client-side estimate — used ONLY as fallback until /Bookings/quote is deployed.
  const clientTotalAmount = useMemo(() => {
    const oneTimeTotal = selectedPackages.reduce((sum, item) => {
      const pkg = packages.find((p) => p.id === item.packageId);
      return sum + adjustedPrice(pkg?.price || 0, vehicleMultiplier);
    }, 0);
    if (subscriptionDiscountPercent > 0) {
      const discount = oneTimeTotal * (subscriptionDiscountPercent / 100);
      return Math.round((oneTimeTotal - discount) * 100) / 100;
    }
    return oneTimeTotal;
  }, [packages, selectedPackages, vehicleMultiplier, subscriptionDiscountPercent]);

  // Authoritative total: prefer server quote, fall back to client estimate.
  const totalAmount = quote?.finalPrice ?? clientTotalAmount;

  // Fetch server quote when pricing inputs change.
  useEffect(() => {
    if (!selectedPackages.length) { setQuote(null); return; }
    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const result = await bookingsAPI.getQuote({
          packageIds:     selectedPackages.map((p) => p.packageId),
          vehicleType:    form.vehicleType,
          subscriptionId: activeSubscription?.id ?? null,
          offerCode:      form.offerCode || null,
        });
        setQuote(result); // null = 404 fallback, non-null = use server value
      } catch {
        setQuote(null); // non-404 error: fall back to client estimate
      } finally {
        setQuoteLoading(false);
      }
    }, 400); // debounce
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackages, form.vehicleType, activeSubscription?.id, form.offerCode, packages]);

  const minDateObj      = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const monthLabel      = useMemo(() => calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), [calendarMonth]);
  const selectedDateObj = useMemo(() => parseDateKey(form.scheduledDate), [form.scheduledDate]);

  const calendarCells = useMemo(() => {
    const year  = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekDay = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekDay; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const selectCalendarDate = (dateObj) => {
    const dateKey = toDateKey(dateObj);
    const status  = availabilityByDate[dateKey]?.status || 'available';
    if (dateObj < minDateObj || status === 'full') return;
    setForm((prev) => ({ ...prev, scheduledDate: dateKey, timeSlot: '' }));
    setError('');
  };

  // Slot availability is evaluated per-worker against real booking intervals + buffer.
  // durationMinutes is sent so the backend can confirm the full job fits within shifts
  // and doesn't overlap with existing bookings for the entire duration.
  // Re-fetches whenever the date OR the total job duration changes (i.e. package changes).
  useEffect(() => {
    const fetchSlots = async () => {
      if (!form.scheduledDate) { setAvailableSlots([]); return; }
      try {
        setSlotsLoading(true);
        const slots = await bookingsAPI.getAvailableSlots(form.scheduledDate, totalDuration || undefined);
        const filtered = slots || [];
        setAvailableSlots(filtered);
        setForm((prev) => ({ ...prev, timeSlot: filtered.includes(prev.timeSlot) ? prev.timeSlot : '' }));
      } catch {
        // On error show empty — never fall back to hardcoded slots which ignore real bookings.
        setAvailableSlots([]);
      }
      finally  { setSlotsLoading(false); }
    };
    fetchSlots();
  // Re-fetch when date, total job duration, or buffer setting changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scheduledDate, totalDuration]);

  const selectPackage = (packageId) => setSelectedPackages([{ packageId, quantity: 1 }]);

  const onSubmit = async () => {
    if (selectedPackages.length === 0)         { setError('Please select a package to continue.'); return; }
    if (totalDuration <= 0)                    { setError('Selected package has no duration. Please contact support.'); return; }
    if (!form.scheduledDate || !form.timeSlot) { setError('Please select a date and time slot.'); return; }
    if (!form.customerName.trim())             { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) { setError('Please enter a valid email address.'); return; }
    if (!form.customerPhone.trim())            { setError('Please enter your phone number.'); return; }
    if (form.customerPhone.replace(/\D/g, '').length < 7) { setError('Please enter a valid phone number.'); return; }
    try {
      setSubmitting(true); setError('');

      // ── Phase 2A: Stripe payment flow ─────────────────────────────────────────
      // Flag OFF  → placeholder string (dev/testing mode, zero behaviour change)
      // Flag ON   → real PaymentIntent + native payment sheet
      let stripePaymentIntentId = `placeholder-${Date.now()}`;

      if (payments) {
        // Step 1 — ask our backend to create a PaymentIntent
        let intentData;
        try {
          intentData = await paymentsAPI.createIntent({
            amount:          totalAmount,
            currency:        'QAR',
            scheduledDate:   form.scheduledDate,
            timeSlot:        form.timeSlot,
            durationMinutes: totalDuration,
          });
        } catch {
          setError('Failed to initialize payment. Please check your connection and try again.');
          return;
        }

        // Step 2 — configure the native Stripe payment sheet
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentData.clientSecret,
          merchantDisplayName:       'Glanz',
          defaultBillingDetails: {
            name:  form.customerName,
            email: form.customerEmail,
          },
          applePay: { merchantCountryCode: 'QA' },
          googlePay: { merchantCountryCode: 'QA', testEnv: !process.env.EXPO_PUBLIC_STRIPE_KEY?.startsWith('pk_live_') },
          style: 'alwaysDark',
        });

        if (initError) {
          setError(initError.message || 'Failed to initialize payment. Please try again.');
          return;
        }

        // Step 3 — show the native payment UI
        const { error: payError } = await presentPaymentSheet();

        if (payError) {
          // 'Canceled' means user tapped the back/cancel button — not an error
          if (payError.code === 'Canceled') {
            setError('Payment was cancelled. Complete payment to confirm your booking.');
          } else {
            setError(payError.message || 'Payment failed. Please try a different card.');
          }
          return;
        }

        // Payment succeeded — extract PaymentIntent ID from clientSecret
        // Format: pi_XXXXXXXX_secret_YYYY → ID is everything before _secret_
        stripePaymentIntentId = intentData.intentId ?? intentData.clientSecret.split('_secret_')[0];
      }
      // ── End Stripe flow ────────────────────────────────────────────────────────

      const payload = {
        scheduledDate:         `${form.scheduledDate}T12:00:00.000Z`,
        timeSlot:              form.timeSlot,
        customerName:          form.customerName,
        customerEmail:         form.customerEmail,
        customerPhone:         form.customerPhone,
        customerAddress:       needsManualAddress ? (form.customerAddress.trim() || null) : savedAddress.address,
        houseNumber:           needsManualAddress ? (form.houseNumber?.trim() || null) : savedAddress.houseNumber,
        addressType:           needsManualAddress ? form.addressType : normalizedPreferredAddressType,
        vehicleType:           form.vehicleType,
        vehicleMake:           form.vehicleMake  || null,
        vehicleModel:          form.vehicleModel || null,
        vehicleYear:           form.vehicleYear  || null,
        customerSubscriptionId: subscriptionMatchesVehicle ? mySubscription?.id ?? null : null,
        specialInstructions:   form.specialInstructions || null,
        offerCode:             form.offerCode.trim() || null,
        stripePaymentIntentId,
        packages:              selectedPackages,
        idempotencyKey:        idempotencyKey.current,
      };
      const booking = await bookingsAPI.create(payload);
      if (!booking?.bookingNumber) {
        navigation.navigate('My Bookings');
        return;
      }
      navigation.navigate('Booking Confirmation', { bookingNumber: booking.bookingNumber });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create booking.');
    } finally { setSubmitting(false); }
  };

  if (loading && packages.length === 0) {
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
      keyboardShouldPersistTaps="handled"
      onScroll={scrollHeader.onScroll}
      scrollEventThrottle={scrollHeader.scrollEventThrottle}
    >
      {/* ── REDESIGNED Page Header ──────────────────────────────── */}
      <View style={s.pageHeader}>
        <View style={s.badgeRow}>
          <View style={s.badgeLine} />
          <Text style={s.badgeText}>Doorstep Detailing</Text>
          <View style={s.badgeLine} />
        </View>
        <Text style={s.heading}>Book Your Service</Text>
        <Text style={s.sub}>
          {isAdmin ? 'Create a booking for a customer.' : 'Select a package, pick a date, and we\'ll handle the rest.'}
        </Text>
        <View style={s.trustRow}>
          <View style={s.trustItem}>
            <Ionicons name="star" size={10} color={theme.colors.primary} />
            <Text style={s.trustText}>4.9 Rating</Text>
          </View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={10} color={theme.colors.primary} />
            <Text style={s.trustText}>Secure Booking</Text>
          </View>
          <View style={s.trustDivider} />
          <View style={s.trustItem}>
            <Ionicons name="location-outline" size={10} color={theme.colors.primary} />
            <Text style={s.trustText}>Mobile · We Come to You</Text>
          </View>
        </View>
      </View>

      {!!error && <ErrorBanner message={error} />}

      {/* ══════════════ 1. PACKAGE ══════════════════════════════ */}
      <Card>
        <SectionHeader icon="cube-outline" step={1}>Select Package</SectionHeader>
        {packagesLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : packages.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={20} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>No packages available right now.</Text>
          </View>
        ) : null}
        {packages.map((pkg) => {
          const selected  = selectedPackages.some((x) => x.packageId === pkg.id);
          const basePrice = pkg.price || 0;
          const adjPrice  = adjustedPrice(basePrice, vehicleMultiplier);
          const hasAdjust = vehicleMultiplier !== 1.0;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.pkgRow, selected && s.pkgRowSelected]}
              onPress={() => selectPackage(pkg.id)}
              activeOpacity={0.7}
            >
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <View style={s.radioDot} />}
              </View>
              <View style={s.pkgInfo}>
                <Text style={s.pkgName}>{pkg.name}</Text>
                <View style={s.pkgMeta}>
                  <View style={s.tierPill}>
                    <Text style={s.tierPillText}>{pkg.tier}</Text>
                  </View>
                  <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={s.pkgDuration}>{pkg.estimatedDurationMinutes} min</Text>
                </View>
              </View>
              <View style={s.priceCol}>
                {hasAdjust && (
                  <Text style={s.pkgPriceStrike}>{formatQAR(basePrice)}</Text>
                )}
                <Text style={s.pkgPrice}>{formatQAR(adjPrice)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* ══════════════ 2. VEHICLE + SUBSCRIPTION ═══════════════ */}
      <Card>
        <SectionHeader icon="car-outline" step={2}>Vehicle &amp; Service Type</SectionHeader>

        <FieldLabel>Vehicle Type</FieldLabel>
        {/* REDESIGNED: 2×2 button grid replaces flat chips */}
        <View style={s.vehicleGrid}>
          {vehicleTypeOptions.map((opt) => {
            const active = form.vehicleType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.vehicleBtn, active && s.vehicleBtnActive]}
                onPress={() => setForm((p) => ({ ...p, vehicleType: opt.value }))}
                activeOpacity={0.7}
              >
                <Text style={[s.vehicleBtnLabel, active && s.vehicleBtnLabelActive]}>
                  {opt.label}
                </Text>
                <View style={[s.vehicleBadge, {
                  backgroundColor: opt.badgeColor.bg,
                  borderColor: opt.badgeColor.border,
                }]}>
                  <Text style={[s.vehicleBadgeText, { color: opt.badgeColor.text }]}>
                    {opt.badge}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <FieldLabel>Subscription</FieldLabel>
        <View style={s.subscriptionPanel}>
          {subLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : activeSubscription ? (
            <>
              <View style={s.subscriptionPanelHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subscriptionPanelTitle}>{activeSubscription.planName}</Text>
                  <Text style={s.subscriptionPanelMeta}>
                    {activeSubscription.vehicleType} · {activeSubscription.billingCycle} · {formatQAR(activeSubscription.price)}
                  </Text>
                </View>
                <TouchableOpacity style={s.subscriptionPanelBtn} onPress={() => navigation.navigate('Subscriptions')} activeOpacity={0.8}>
                  <Text style={s.subscriptionPanelBtnText}>Manage</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.subscriptionPanelBody}>
                {subscriptionMatchesVehicle
                  ? `${activeSubscription.discountPercent}% discount will apply to this ${form.vehicleType} booking.`
                  : `This plan only applies to ${activeSubscription.vehicleType} bookings.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.subscriptionPanelTitle}>No active subscription</Text>
              <Text style={s.subscriptionPanelBody}>Browse plans for your vehicle type to unlock recurring discounts without touching slot or worker selection.</Text>
              <TouchableOpacity style={s.subscriptionPanelBtn} onPress={() => navigation.navigate('Subscriptions')} activeOpacity={0.8}>
                <Text style={s.subscriptionPanelBtnText}>Browse Plans</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Card>

      {/* ══════════════ 3. SCHEDULE ══════════════════════════════ */}
      <Card>
        <SectionHeader icon="calendar-outline" step={3}>Schedule</SectionHeader>

        {/* Calendar nav */}
        <View style={s.calHeader}>
          <TouchableOpacity
            style={s.monthBtn}
            onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
          >
            <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{monthLabel}</Text>
          <TouchableOpacity
            style={s.monthBtn}
            onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
          >
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={s.legendRow}>
          {['available', 'medium', 'full'].map((k) => (
            <View key={k} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: availabilityColors[k].dot }]} />
              <Text style={s.legendText}>{availabilityColors[k].label}</Text>
            </View>
          ))}
        </View>

        {/* Day headers */}
        <View style={s.weekRow}>
          {weekdayLabels.map((d) => <Text key={d} style={s.weekDay}>{d}</Text>)}
        </View>

        {availabilityLoading && (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 10 }} />
        )}

        {/* Calendar grid — original styles restored */}
        <View style={s.calGrid}>
          {calendarCells.map((dateObj, i) => {
            if (!dateObj) return <View key={`e-${i}`} style={s.calEmpty} />;
            const dateKey    = toDateKey(dateObj);
            const status     = availabilityByDate[dateKey]?.status || 'available';
            const isPast     = dateObj < minDateObj;
            const stateKey   = isPast ? 'disabled' : status;
            const palette    = availabilityColors[stateKey] || availabilityColors.available;
            const isSelected = toDateKey(selectedDateObj) === dateKey;
            return (
              <TouchableOpacity
                key={dateKey}
                style={[
                  s.calCell,
                  { backgroundColor: palette.bg, borderColor: isSelected ? theme.colors.primary : palette.border },
                  isSelected && s.calCellSelected,
                ]}
                disabled={isPast || status === 'full'}
                onPress={() => selectCalendarDate(dateObj)}
                activeOpacity={0.75}
              >
                <Text style={[s.calDayText, { color: palette.text }]}>{dateObj.getDate()}</Text>
                <View style={[s.calDot, { backgroundColor: palette.dot }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected date pill */}
        <View style={s.selectedDate}>
          <Ionicons name="calendar" size={13} color={theme.colors.primary} />
          <Text style={s.selectedDateText}>
            {parseDateKey(form.scheduledDate).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Time slots */}
        <FieldLabel>Time Slot</FieldLabel>
        {slotsLoading || availableSlots === null ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
        ) : availableSlots.length === 0 ? (
          <View style={s.noSlots}>
            <Ionicons name="time-outline" size={15} color="#FCA5A5" />
            <Text style={s.noSlotsText}>No slots available for this date. Try another day.</Text>
          </View>
        ) : (
          <View style={s.slotGrid}>
            {availableSlots.map((slot) => {
              const active = form.timeSlot === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[s.slotChip, active && s.slotActive]}
                  onPress={() => setForm((p) => ({ ...p, timeSlot: slot }))}
                >
                  <Text style={[s.slotText, active && s.slotTextActive]}>
                    {getSlotStartTime(slot)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Time confirmation — MOVED HERE from between sections ── */}
        {!!form.timeSlot && (
          <View style={s.timeConfirmStrip}>
            <View style={s.timeConfirmBlock}>
              <Text style={s.timeConfirmValue}>{getSlotStartTime(form.timeSlot)}</Text>
              <Text style={s.timeConfirmMeta}>Start</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
            <View style={s.timeConfirmBlock}>
              <Text style={s.timeConfirmValue}>
                {calculateEndTime(getSlotStartTime(form.timeSlot), totalDuration)}
              </Text>
              <Text style={s.timeConfirmMeta}>Est. End · {totalDuration} min</Text>
            </View>
          </View>
        )}
      </Card>

      {/* ══════════════ 4. CUSTOMER DETAILS ══════════════════════ */}
      <Card>
        <SectionHeader icon="person-outline" step={4}>Customer Details</SectionHeader>
        {canAutofillCustomerData ? (
          <>
            {[
              { label: 'Name',  value: form.customerName  },
              { label: 'Email', value: form.customerEmail },
              { label: 'Phone', value: form.customerPhone },
            ].map(({ label, value }) => (
              <View key={label} style={s.readRow}>
                <Text style={s.readLabel}>{label}</Text>
                <Text style={s.readValue}>{value || '—'}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.editProfileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
              <Text style={s.editProfileText}>Edit in Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FieldLabel>Full Name</FieldLabel>
            <TextInput style={s.input} value={form.customerName}  onChangeText={(v) => setForm((p) => ({ ...p, customerName: v }))}  placeholder="Customer name"  placeholderTextColor={theme.colors.textMuted} />
            <FieldLabel>Email</FieldLabel>
            <TextInput style={s.input} value={form.customerEmail} onChangeText={(v) => setForm((p) => ({ ...p, customerEmail: v }))} placeholder="Email address" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <FieldLabel>Phone</FieldLabel>
            <TextInput style={s.input} value={form.customerPhone} onChangeText={(v) => setForm((p) => ({ ...p, customerPhone: v }))} placeholder="Phone number"  placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" />
          </>
        )}
      </Card>

      {/* ══════════════ 5. DELIVERY ADDRESS ══════════════════════ */}
      <Card>
        <SectionHeader icon="location-outline" step={5}>Delivery Address</SectionHeader>
        {canAutofillCustomerData && savedAddress.address ? (
          <>
            {Object.values(savedAddresses).some(a => a.address) && (
              <View style={s.chipRow}>
                {['Home', 'Work', 'Other'].map((type) => {
                  if (!savedAddresses[type]?.address) return null;
                  const active = form.addressType === type;
                  const icons  = { Home: 'home-outline', Work: 'business-outline', Other: 'location-outline' };
                  return (
                    <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => handleLoadSavedAddress(type)}>
                      <Ionicons name={icons[type]} size={12} color={active ? theme.colors.ink : theme.colors.textMuted} />
                      <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={s.addressDisplay}>
              <Text style={s.addressDisplayText}>
                {form.customerAddress || savedAddress.address}
                {(form.houseNumber || savedAddress.houseNumber) ? ` — ${form.houseNumber || savedAddress.houseNumber}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.editProfileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
              <Text style={s.editProfileText}>Edit addresses in Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!savedAddress.address && canAutofillCustomerData && (
              <Text style={s.helperText}>No default address saved. Add one below or manage in Profile.</Text>
            )}
            {canAutofillCustomerData && Object.values(savedAddresses).some(a => a.address) && (
              <>
                <FieldLabel>Quick Select Saved Address</FieldLabel>
                <View style={s.chipRow}>
                  {['Home', 'Work', 'Other'].map((type) => {
                    const saved  = savedAddresses[type];
                    const active = form.addressType === type && form.customerAddress === saved.address;
                    if (!saved.address) return null;
                    return (
                      <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => handleLoadSavedAddress(type)}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <AddressAutocompleteInput
              label="Area / Street"
              value={form.customerAddress}
              onChangeText={(v) => setForm((p) => ({ ...p, customerAddress: v }))}
              placeholder="Search area or street name"
              helperText="Select your service area or street."
            />
            <FieldLabel>House / Building Number</FieldLabel>
            <TextInput style={s.input} value={form.houseNumber || ''} onChangeText={(v) => setForm((p) => ({ ...p, houseNumber: v }))} placeholder="e.g. 53, Villa 12" placeholderTextColor={theme.colors.textMuted} />
            <FieldLabel>Address Type</FieldLabel>
            <View style={s.chipRow}>
              {['Home', 'Work', 'Other'].map((type) => {
                const active = form.addressType === type;
                return (
                  <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => setForm((p) => ({ ...p, addressType: type }))}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </Card>

      {/* ══════════════ 6. VEHICLE DETAILS ═══════════════════════ */}
      <Card>
        <SectionHeader icon="speedometer-outline" step={6}>Vehicle Details</SectionHeader>
        {savedVehicles.length > 0 && (
          <>
            <FieldLabel>Saved Vehicles</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {savedVehicles.map((v) => {
                  const isSelected =
                    form.vehicleMake  === (v.make  || '') &&
                    form.vehicleModel === (v.model || '') &&
                    form.vehicleYear  === (v.year  || '') &&
                    form.vehicleType  === (v.vehicleType || 'Sedan');
                  const label = v.nickname || [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.savedVehicleChip, isSelected && s.savedVehicleChipActive]}
                      onPress={() => setForm((p) => ({
                        ...p,
                        vehicleType:  v.vehicleType || p.vehicleType,
                        vehicleMake:  v.make        || '',
                        vehicleModel: v.model       || '',
                        vehicleYear:  v.year        || '',
                      }))}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'car' : 'car-outline'}
                        size={14}
                        color={isSelected ? theme.colors.ink : theme.colors.textMuted}
                      />
                      <Text style={[s.savedVehicleChipText, isSelected && s.savedVehicleChipTextActive]} numberOfLines={1}>
                        {label}
                      </Text>
                      {v.isDefault && (
                        <Ionicons name="star" size={10} color={isSelected ? theme.colors.ink : theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}
        <FieldLabel>Make</FieldLabel>
        <TextInput style={s.input} value={form.vehicleMake}  onChangeText={(v) => setForm((p) => ({ ...p, vehicleMake: v }))}  placeholder="e.g. Toyota" placeholderTextColor={theme.colors.textMuted} />
        <FieldLabel>Model</FieldLabel>
        <TextInput style={s.input} value={form.vehicleModel} onChangeText={(v) => setForm((p) => ({ ...p, vehicleModel: v }))} placeholder="e.g. Camry"  placeholderTextColor={theme.colors.textMuted} />
        <FieldLabel>Year</FieldLabel>
        <TextInput style={s.input} value={form.vehicleYear}  onChangeText={(v) => setForm((p) => ({ ...p, vehicleYear: v }))}  placeholder="e.g. 2022"  placeholderTextColor={theme.colors.textMuted} keyboardType="number-pad" />
      </Card>

      {/* ══════════════ 7. OFFERS ════════════════════════════════ */}
      <Card>
        <SectionHeader icon="pricetag-outline" step={7}>Offers &amp; Coupon</SectionHeader>
        {myCoupons.slice(0, 4).map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[s.couponRow, form.offerCode === c.personalCode && s.couponRowActive]}
            onPress={() => setForm((p) => ({ ...p, offerCode: c.personalCode }))}
          >
            <View style={s.couponIconBox}>
              <Ionicons name="gift" size={14} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.couponName}>{c.offerName}</Text>
              <Text style={s.couponCode}>{c.personalCode}</Text>
            </View>
            {form.offerCode === c.personalCode && (
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
        <FieldLabel>Enter Code Manually</FieldLabel>
        <TextInput style={s.input} value={form.offerCode} onChangeText={(v) => setForm((p) => ({ ...p, offerCode: v }))} placeholder="Offer / promo code" placeholderTextColor={theme.colors.textMuted} autoCapitalize="characters" />
      </Card>

      {/* ══════════════ 8. SPECIAL INSTRUCTIONS ══════════════════ */}
      <Card>
        <SectionHeader icon="chatbox-ellipses-outline" step={8}>Special Instructions</SectionHeader>
        <TextInput
          style={[s.input, s.textArea]}
          value={form.specialInstructions}
          onChangeText={(v) => setForm((p) => ({ ...p, specialInstructions: v }))}
          placeholder="Any special requests or notes for the detailer…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
        />
      </Card>

      {/* ══════════════ 9. PAYMENT METHOD ════════════════════════ */}
      <Card>
        <SectionHeader icon="card-outline" step={9}>Payment Method</SectionHeader>
        <View style={s.mockBadge}>
          <Ionicons name="construct-outline" size={11} color="#92400E" />
          <Text style={s.mockBadgeText}>Mock — Stripe will be integrated before launch</Text>
        </View>
        {PAYMENT_METHODS.map((method) => {
          const active = form.paymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[s.payRow, active && s.payRowActive]}
              onPress={() => setForm((p) => ({ ...p, paymentMethod: method.id }))}
              activeOpacity={0.7}
            >
              <View style={[s.payIconBox, active && s.payIconBoxActive]}>
                <Ionicons name={method.icon} size={17} color={active ? theme.colors.primary : theme.colors.textMuted} />
              </View>
              <Text style={[s.payLabel, active && s.payLabelActive]}>{method.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* ══════════════ 10. SUMMARY + SUBMIT ═════════════════════ */}
      <View style={s.summaryCard}>
        {/* REDESIGNED: Summary card header */}
        <View style={s.summaryCardHeader}>
          <Ionicons name="receipt-outline" size={15} color={theme.colors.primary} />
          <Text style={s.summaryCardTitle}>Booking Summary</Text>
        </View>
        <View style={s.summaryRow}>
          <View>
            <Text style={s.summaryLabel}>Estimated Duration</Text>
            <Text style={s.summaryDuration}>{totalDuration} min</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.summaryLabel}>Total</Text>
            {quoteLoading
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <Text style={s.summaryAmount}>{formatQAR(totalAmount)}</Text>
            }
          </View>
        </View>
        {vehicleMultiplier !== 1.0 && (
          <View style={s.multiplierNote}>
            <Ionicons name="information-circle-outline" size={13} color={theme.colors.primary} />
            <Text style={s.multiplierNoteText}>
              {vehicleMultiplier < 1
                ? `${form.vehicleType} discount applied (×${vehicleMultiplier})`
                : `${form.vehicleType} surcharge applied (×${vehicleMultiplier})`}
            </Text>
          </View>
        )}
        {subscriptionDiscountPercent > 0 && (
          <View style={s.discountNote}>
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
            <Text style={s.discountNoteText}>
              {subscriptionDiscountPercent}% {mySubscription.planName || 'subscription'} discount applied
            </Text>
          </View>
        )}
        {activeSubscription && !subscriptionMatchesVehicle && (
          <View style={s.discountNote}>
            <Ionicons name="information-circle-outline" size={13} color={theme.colors.primary} />
            <Text style={s.discountNoteText}>Switch to {activeSubscription.vehicleType} to use your current plan discount.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.submitBtn, submitting && s.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={theme.colors.ink} size="small" />
        ) : (
          <>
            <Text style={s.submitText}>Confirm Booking</Text>
            <Ionicons name="arrow-forward" size={17} color={theme.colors.ink} />
          </>
        )}
      </TouchableOpacity>

      {/* REDESIGNED: Trust row below submit */}
      <View style={s.submitTrustRow}>
        {[
          { icon: 'shield-checkmark-outline', label: 'Secure Checkout'        },
          { icon: 'checkmark-circle-outline', label: 'Instant Confirmation'   },
          { icon: 'time-outline',             label: 'Free Reschedule'         },
        ].map(({ icon, label }) => (
          <View key={label} style={s.submitTrustItem}>
            <Ionicons name={icon} size={11} color={theme.colors.primary} />
            <Text style={s.submitTrustText}>{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Shared helper styles ─────────────────────────────────────────────────────
const h = StyleSheet.create({
  card: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 16, marginBottom: 14,
  },
  // Redesigned section header
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionStep: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 0.7, opacity: 0.5,
  },
  sectionTitle: {
    color: theme.colors.text, fontSize: 15, fontWeight: '800',
  },
  sectionDivider: {
    flex: 1, height: 1, marginLeft: 4,
    backgroundColor: 'rgba(200,169,107,0.15)',
  },
  fieldLabel: {
    color: theme.colors.mist, fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: 8, marginTop: 4,
  },
  // Redesigned error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(28,10,10,0.9)', borderWidth: 1,
    borderColor: 'rgba(127,29,29,0.4)', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  errorIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  // ── REDESIGNED page header ─────────────────────────────────────────────────
  pageHeader: { marginBottom: 18, alignItems: 'center' },
  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  badgeLine:  { height: 1, width: 20, backgroundColor: 'rgba(200,169,107,0.55)' },
  badgeText: {
    color: theme.colors.primary, fontSize: 10, fontWeight: '700',
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  sub:     { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 300 },
  trustRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10, marginTop: 14,
  },
  trustItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText:   { color: theme.colors.textMuted, fontSize: 10, fontWeight: '500' },
  trustDivider:{ width: 1, height: 12, backgroundColor: theme.colors.border },

  // ── Package rows (original) ────────────────────────────────────────────────
  pkgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 8,
  },
  pkgRowSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.07)' },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:  { borderColor: theme.colors.primary },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  pkgInfo:        { flex: 1 },
  pkgName:        { color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  pkgMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierPill:       { backgroundColor: 'rgba(200,169,107,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tierPillText:   { color: theme.colors.primary, fontSize: 10, fontWeight: '700' },
  pkgDuration:    { color: theme.colors.textMuted, fontSize: 12 },
  priceCol:       { alignItems: 'flex-end' },
  pkgPriceStrike: { color: theme.colors.textMuted, fontSize: 11, textDecorationLine: 'line-through', marginBottom: 1 },
  pkgPrice:       { color: theme.colors.primary, fontWeight: '900', fontSize: 15 },

  // ── Time confirm strip — SAME AS ORIGINAL, now lives inside Schedule card ──
  timeConfirmStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)',
    borderRadius: 14, backgroundColor: 'rgba(200,169,107,0.06)',
    padding: 14, marginTop: 14, marginBottom: 0,
  },
  timeConfirmBlock: { alignItems: 'center' },
  timeConfirmValue: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  timeConfirmMeta:  { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },

  // ── REDESIGNED vehicle type 2×2 grid ──────────────────────────────────────
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  vehicleBtn: {
    width: '48%', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 12, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  vehicleBtnActive:      { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.09)' },
  vehicleBtnLabel:       { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  vehicleBtnLabelActive: { color: theme.colors.text },
  vehicleBadge:          { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  vehicleBadgeText:      { fontSize: 10, fontWeight: '700' },
  subscriptionPanel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBg,
    padding: 14,
    gap: 10,
    marginBottom: 4,
  },
  subscriptionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  subscriptionPanelTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  subscriptionPanelMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  subscriptionPanelBody: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  subscriptionPanelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryBg,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  subscriptionPanelBtnText: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },

  // ── Chips (original) ───────────────────────────────────────────────────────
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipWide:        { flex: 1, justifyContent: 'center' },
  chipActive:      { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  chipText:        { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive:  { color: theme.colors.ink },
  helperText:      { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 8 },

  // ── Calendar (ALL ORIGINAL) ────────────────────────────────────────────────
  calHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  monthTitle:  { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  legendRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  weekRow:     { flexDirection: 'row', marginBottom: 6 },
  weekDay:     { width: '14.28%', textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', aspectRatio: 1, borderWidth: 1,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  calCellSelected: { borderWidth: 2, borderColor: theme.colors.primary },
  calEmpty:    { width: '14.28%', aspectRatio: 1, marginBottom: 5 },
  calDayText:  { fontWeight: '800', fontSize: 13 },
  calDot:      { width: 5, height: 5, borderRadius: 2.5, marginTop: 3 },
  selectedDate: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(200,169,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 10, marginBottom: 14,
  },
  selectedDateText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  noSlots: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#7F1D1D', backgroundColor: '#1C0A0A',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  noSlotsText: { color: '#FCA5A5', flex: 1, fontSize: 13 },
  slotGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    minWidth: 64, alignItems: 'center',
  },
  slotActive:       { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  slotDisabled:     { opacity: 0.3 },
  slotText:         { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  slotTextActive:   { color: theme.colors.ink },
  slotTextDisabled: { color: theme.colors.textMuted },

  // ── Read-only rows (original) ──────────────────────────────────────────────
  readRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  readLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  readValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(200,169,107,0.06)',
  },
  editProfileText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  addressDisplay: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 10,
  },
  addressDisplayText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    color: theme.colors.text, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, marginBottom: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },

  // ── Saved vehicle chips (original) ─────────────────────────────────────────
  savedVehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.inputBg, maxWidth: 160,
  },
  savedVehicleChipActive:      { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  savedVehicleChipText:        { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', flex: 1 },
  savedVehicleChipTextActive:  { color: theme.colors.ink },

  // ── Coupons (original) ─────────────────────────────────────────────────────
  couponRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.18)',
    borderRadius: 12, backgroundColor: 'rgba(200,169,107,0.04)',
    padding: 12, marginBottom: 8,
  },
  couponRowActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.10)' },
  couponIconBox:   { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  couponName:      { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  couponCode:      { color: theme.colors.primary, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, marginTop: 2 },

  // ── Payment (original) ─────────────────────────────────────────────────────
  mockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(254,243,199,0.08)', borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.25)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12, alignSelf: 'flex-start',
  },
  mockBadgeText: { color: '#D97706', fontSize: 11, fontWeight: '600' },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 13, marginBottom: 8,
  },
  payRowActive:     { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.07)' },
  payIconBox:       { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  payIconBoxActive: { backgroundColor: 'rgba(200,169,107,0.14)' },
  payLabel:         { flex: 1, color: theme.colors.textMuted, fontWeight: '600', fontSize: 14 },
  payLabelActive:   { color: theme.colors.text },

  // ── Summary (original + header) ────────────────────────────────────────────
  summaryCard: {
    borderWidth: 1.5, borderColor: 'rgba(200,169,107,0.3)',
    borderRadius: 18, backgroundColor: 'rgba(200,169,107,0.06)',
    padding: 18, marginBottom: 14,
  },
  // REDESIGNED summary card header
  summaryCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  summaryCardTitle:  { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  summaryRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryLabel:      { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryDuration:   { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  summaryAmount:     { color: theme.colors.primary, fontSize: 26, fontWeight: '900' },
  multiplierNote:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  multiplierNoteText:{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  discountNote:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  discountNoteText:  { color: '#10B981', fontSize: 12, fontWeight: '700' },

  // ── Submit (original + trust row) ──────────────────────────────────────────
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14, paddingVertical: 15, marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: theme.colors.ink, fontWeight: '900', fontSize: 16 },
  // REDESIGNED trust row
  submitTrustRow:  { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  submitTrustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  submitTrustText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '500' },

  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emptyText: { color: theme.colors.textMuted, flex: 1 },
});