import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, ScrollView,
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
import { toDateKey, parseDateKey } from '../utils/dateUtils';
import { theme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

import { s, ErrorBanner } from './booking/BookingShared';
import BookingPackageStep   from './booking/BookingPackageStep';
import BookingScheduleStep  from './booking/BookingScheduleStep';
import BookingDetailsStep   from './booking/BookingDetailsStep';
import BookingCheckoutStep  from './booking/BookingCheckoutStep';

export default function BookingScreen({ navigation, route }) {
  const selectedFromPackages = route?.params?.selectedPackage;
  const rebookFromBooking    = route?.params?.rebookFromBooking;

  const { user, isAdmin }               = useAuth();
  const { payments }                    = useFeatures();
  const settings                        = useSettings();
  const { packages, packagesLoading, fetchPackages } = usePackages();

  // Vehicle type options — badge text driven by backend multipliers
  const vehicleTypeOptions = useMemo(() => {
    const mult  = settings.vehicleMultipliers;
    const badge = (m) => {
      if (m === 1.0) return 'Base';
      const pct = Math.round((m - 1) * 100);
      return pct < 0 ? `${pct}%` : `+${pct}%`;
    };
    return [
      { value: 'Motorcycle', label: 'Motorcycle', badge: badge(mult.Motorcycle ?? 0.8),  badgeColor: { bg: 'rgba(64,196,99,0.1)',    border: 'rgba(64,196,99,0.25)',    text: '#4ADE80'              } },
      { value: 'Sedan',      label: 'Sedan',      badge: badge(mult.Sedan      ?? 1.0),  badgeColor: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)',   text: theme.colors.textMuted } },
      { value: 'SUV',        label: 'SUV / 4×4',  badge: badge(mult.SUV        ?? 1.25), badgeColor: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',    text: '#FBBF24'              } },
      { value: 'Pickup',     label: 'Pickup',     badge: badge(mult.Pickup     ?? 1.5),  badgeColor: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',    text: '#FBBF24'              } },
    ];
  }, [settings.vehicleMultipliers]);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();

  // Idempotency key — generated once per BookingScreen mount
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

  // ── State ─────────────────────────────────────────────────────────────────
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

  const [mySubscription, setMySubscription] = useState(null);
  const [subLoading,     setSubLoading]     = useState(false);

  useEffect(() => {
    if (!canAutofillCustomerData) { setMySubscription(null); return; }
    let cancelled = false;
    setSubLoading(true);
    subscriptionsAPI.getMySubscription()
      .then((sub) => { if (!cancelled) setMySubscription(sub || null); })
      .catch(() =>   { if (!cancelled) setMySubscription(null); })
      .finally(() => { if (!cancelled) setSubLoading(false); });
    return () => { cancelled = true; };
  }, [canAutofillCustomerData, user?.id]);

  const [form, setForm] = useState({
    scheduledDate:       toDateKey(new Date()),
    timeSlot:            '',
    customerName:        canAutofillCustomerData ? `${user.firstName} ${user.lastName}` : '',
    customerEmail:       canAutofillCustomerData ? user?.email  || '' : '',
    customerPhone:       canAutofillCustomerData ? user?.phone  || '' : '',
    customerAddress:     canAutofillCustomerData ? savedAddress.address     : '',
    houseNumber:         canAutofillCustomerData ? savedAddress.houseNumber : '',
    addressType:         savedAddress.address ? normalizedPreferredAddressType : 'Home',
    vehicleType:         'Sedan',
    vehicleMake:         '',
    vehicleModel:        '',
    vehicleYear:         '',
    specialInstructions: '',
    offerCode:           '',
    paymentMethod:       'card',
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

  // ── Effects ───────────────────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const [quote, setQuote]               = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const clientTotalAmount = useMemo(() => {
    const oneTimeTotal = selectedPackages.reduce((sum, item) => {
      const pkg = packages.find((p) => p.id === item.packageId);
      const adjPrice = Math.round((pkg?.price || 0) * vehicleMultiplier * 100) / 100;
      return sum + adjPrice;
    }, 0);
    if (subscriptionDiscountPercent > 0) {
      const discount = oneTimeTotal * (subscriptionDiscountPercent / 100);
      return Math.round((oneTimeTotal - discount) * 100) / 100;
    }
    return oneTimeTotal;
  }, [packages, selectedPackages, vehicleMultiplier, subscriptionDiscountPercent]);

  const totalAmount = quote?.finalPrice ?? clientTotalAmount;

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
        setQuote(result);
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackages, form.vehicleType, activeSubscription?.id, form.offerCode, packages]);

  // ── Derived calendar values ────────────────────────────────────────────────
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
        setAvailableSlots([]);
      }
      finally { setSlotsLoading(false); }
    };
    fetchSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scheduledDate, totalDuration]);

  // ── Submit ─────────────────────────────────────────────────────────────────
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

      let stripePaymentIntentId = `placeholder-${Date.now()}`;

      if (payments) {
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

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intentData.clientSecret,
          merchantDisplayName:       'Glanz',
          defaultBillingDetails: {
            name:  form.customerName,
            email: form.customerEmail,
          },
          applePay:  { merchantCountryCode: 'QA' },
          googlePay: { merchantCountryCode: 'QA', testEnv: !process.env.EXPO_PUBLIC_STRIPE_KEY?.startsWith('pk_live_') },
          style: 'alwaysDark',
        });

        if (initError) {
          setError(initError.message || 'Failed to initialize payment. Please try again.');
          return;
        }

        const { error: payError } = await presentPaymentSheet();

        if (payError) {
          if (payError.code === 'Canceled') {
            setError('Payment was cancelled. Complete payment to confirm your booking.');
          } else {
            setError(payError.message || 'Payment failed. Please try a different card.');
          }
          return;
        }

        stripePaymentIntentId = intentData.intentId ?? intentData.clientSecret.split('_secret_')[0];
      }

      const payload = {
        scheduledDate:          `${form.scheduledDate}T12:00:00.000Z`,
        timeSlot:               form.timeSlot,
        customerName:           form.customerName,
        customerEmail:          form.customerEmail,
        customerPhone:          form.customerPhone,
        customerAddress:        needsManualAddress ? (form.customerAddress.trim() || null) : savedAddress.address,
        houseNumber:            needsManualAddress ? (form.houseNumber?.trim() || null) : savedAddress.houseNumber,
        addressType:            needsManualAddress ? form.addressType : normalizedPreferredAddressType,
        vehicleType:            form.vehicleType,
        vehicleMake:            form.vehicleMake  || null,
        vehicleModel:           form.vehicleModel || null,
        vehicleYear:            form.vehicleYear  || null,
        customerSubscriptionId: subscriptionMatchesVehicle ? mySubscription?.id ?? null : null,
        specialInstructions:    form.specialInstructions || null,
        offerCode:              form.offerCode.trim() || null,
        stripePaymentIntentId,
        packages:               selectedPackages,
        idempotencyKey:         idempotencyKey.current,
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
      {/* ── Page Header ───────────────────────────────────────── */}
      <View style={s.pageHeader}>
        <View style={s.badgeRow}>
          <View style={s.badgeLine} />
          <Text style={s.badgeText}>Doorstep Detailing</Text>
          <View style={s.badgeLine} />
        </View>
        <Text style={s.heading}>Book Your Service</Text>
        <Text style={s.sub}>
          {isAdmin ? 'Create a booking for a customer.' : "Select a package, pick a date, and we'll handle the rest."}
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

      <BookingPackageStep
        packages={packages}
        packagesLoading={packagesLoading}
        selectedPackages={selectedPackages}
        onSelectPackage={(packageId) => setSelectedPackages([{ packageId, quantity: 1 }])}
        vehicleTypeOptions={vehicleTypeOptions}
        form={form}
        setForm={setForm}
        vehicleMultiplier={vehicleMultiplier}
        mySubscription={mySubscription}
        subLoading={subLoading}
        activeSubscription={activeSubscription}
        subscriptionMatchesVehicle={subscriptionMatchesVehicle}
        navigation={navigation}
      />

      <BookingScheduleStep
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
        availabilityByDate={availabilityByDate}
        availabilityLoading={availabilityLoading}
        form={form}
        setForm={setForm}
        availableSlots={availableSlots}
        slotsLoading={slotsLoading}
        totalDuration={totalDuration}
        minDateObj={minDateObj}
        monthLabel={monthLabel}
        selectedDateObj={selectedDateObj}
        calendarCells={calendarCells}
        onSelectDate={selectCalendarDate}
      />

      <BookingDetailsStep
        canAutofillCustomerData={canAutofillCustomerData}
        form={form}
        setForm={setForm}
        savedAddresses={savedAddresses}
        savedAddress={savedAddress}
        needsManualAddress={needsManualAddress}
        normalizedPreferredAddressType={normalizedPreferredAddressType}
        savedVehicles={savedVehicles}
        onLoadSavedAddress={handleLoadSavedAddress}
        navigation={navigation}
      />

      <BookingCheckoutStep
        form={form}
        setForm={setForm}
        myCoupons={myCoupons}
        totalAmount={totalAmount}
        totalDuration={totalDuration}
        quoteLoading={quoteLoading}
        vehicleMultiplier={vehicleMultiplier}
        subscriptionDiscountPercent={subscriptionDiscountPercent}
        mySubscription={mySubscription}
        activeSubscription={activeSubscription}
        subscriptionMatchesVehicle={subscriptionMatchesVehicle}
        submitting={submitting}
        onSubmit={onSubmit}
      />
    </ScrollView>
  );
}
