import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toDateKey, parseDateKey, toLocalIsoDate } from '../../utils/dateUtils';
import { bookingsAPI } from '../../api/bookings';
import { offersAPI } from '../../api/offers';
import { subscriptionsAPI } from '../../api/subscriptions';
import { useAuth } from '../../context/AuthContext';
import { usePackages } from '../../context/PackagesContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { ArrowRight, Shield, CheckCircle, Clock, MapPin, Star, CreditCard } from 'lucide-react';
import { getSiteContent } from '../../config/siteContent';
import { useFeatures } from '../../context/FeaturesContext';

import { PRISM_CSS, PrismaticCursorOrb, StatusBanner, normalizeStatusKey } from './booking/BookingShared';
import BookingVehiclePackageStep  from './booking/BookingVehiclePackageStep';
import BookingScheduleStep        from './booking/BookingScheduleStep';
import BookingDetailsCheckoutStep from './booking/BookingDetailsCheckoutStep';
import BookingSidebar             from './booking/BookingSidebar';

/* ── BookingForm (orchestrator) ─────────────────────────────────────────── */
function BookingForm({ isTapMode }) {
  const _features = useFeatures();
  const { lang } = useLanguage();
  const { bookingPageConfig } = getSiteContent(lang);
  const _timeSlots     = bookingPageConfig.timeSlots || [];
  const minBookingDate = toLocalIsoDate(bookingPageConfig.earliestBookingOffsetDays ?? 0);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { packages, packagesLoading: packagesCtxLoading, fetchPackages: fetchPackagesCtx } = usePackages();
  const settings = useSettings();

  const canAutofillCustomerData = isAuthenticated && !isAdmin;
  const addressHelperText = isAdmin
    ? undefined
    : 'Address suggestions help prevent invalid service locations before deployment.';

  // ── State ───────────────────────────────────────────────────────────────
  const [selectedPackages,    setSelectedPackages]    = useState([]);
  const [loading]                                      = useState(false);
  const [error,               setError]               = useState('');
  const [success,             setSuccess]             = useState('');
  const [mySubscription,      setMySubscription]      = useState(null);
  const [paymentProcessing,   setPaymentProcessing]   = useState(false);
  const [paymentMethod,       setPaymentMethod]       = useState('card');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotsLoading,        setSlotsLoading]        = useState(false);
  const [availableSlots,      setAvailableSlots]      = useState(null);
  const [quote,               setQuote]               = useState(null);
  const [quoteLoading,        setQuoteLoading]        = useState(false);
  const [calendarMonth,       setCalendarMonth]       = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [myCoupons,          setMyCoupons]          = useState([]);

  const normalizeSelectedPackage = useCallback((value) => {
    const packageId = value?.packageId ?? value?.id ?? null;
    return packageId ? { packageId } : null;
  }, []);

  const bookingTopRef = useRef(null);
  const initialized   = useRef(false);

  // Derived address values
  const normalizedPreferredAddressType = user?.preferredAddressType || 'Home';
  const savedAddresses = {
    Home:  canAutofillCustomerData ? user?.homeAddress?.trim()  || '' : '',
    Work:  canAutofillCustomerData ? user?.workAddress?.trim()  || '' : '',
    Other: canAutofillCustomerData ? user?.otherAddress?.trim() || '' : '',
  };
  const savedHouseNumbers = {
    Home:  canAutofillCustomerData ? user?.homeHouseNumber?.trim()  || '' : '',
    Work:  canAutofillCustomerData ? user?.workHouseNumber?.trim()  || '' : '',
    Other: canAutofillCustomerData ? user?.otherHouseNumber?.trim() || '' : '',
  };
  const savedAddress = savedAddresses[normalizedPreferredAddressType] || '';
  const savedHouseNumber = savedHouseNumbers[normalizedPreferredAddressType] || '';

  // Referral info
  const hasUsedReferral = user?.hasUsedReferralCode || false;
  const referredByName = user?.referredByName || null;

  const _vehicleMultiplier = settings.vehicleMultipliers;

  const [formData, setFormData] = useState({
    scheduledDate:       minBookingDate,
    timeSlot:            '',
    customerName:        canAutofillCustomerData ? `${user.firstName} ${user.lastName}` : '',
    customerEmail:       canAutofillCustomerData ? user?.email  || '' : '',
    customerPhone:       canAutofillCustomerData ? user?.phone  || '' : '',
    customerAddress:     '',
    houseNumber:         '',
    addressType:         'Home',
    offerCode:           new URLSearchParams(location.search).get('coupon')?.toUpperCase() || '',
    vehicleType:         'Sedan',
    vehicleMake:         '',
    vehicleModel:        '',
    vehicleYear:         '',
    specialInstructions: '',
    leadSource:          'Direct',
    leadSourceDetails:   '',
    useReferralPoints:   true, // Default: use points
  });

  // Current vehicle multiplier from backend settings
  const currentVehicleMultiplier = settings.vehicleMultipliers[formData.vehicleType] ?? 1.0;

  // ── Derived totals ────────────────────────────────────────────────────
  const totalDuration = useMemo(() => {
    const selectedPackageId = selectedPackages[0]?.packageId;
    if (!selectedPackageId) return 0;
    const pkg = packages.find((p) => p.id === selectedPackageId);
    return pkg?.estimatedDurationMinutes || 0;
  }, [packages, selectedPackages]);

  const calculateTotal = useCallback(() => {
    const selectedPackageId = selectedPackages[0]?.packageId;
    if (!selectedPackageId) return 0;
    const pkg = packages.find((p) => p.id === selectedPackageId);
    const base = Math.round(((pkg?.price || 0) * currentVehicleMultiplier) * 100) / 100;
    if (mySubscription?.isActive && mySubscription.discountPercent > 0) {
      return Math.round(base * (1 - mySubscription.discountPercent / 100) * 100) / 100;
    }
    return base;
  }, [packages, selectedPackages, currentVehicleMultiplier, mySubscription]);

  const totalAmount = quote?.finalPrice ?? calculateTotal();

  // ── Derived calendar values ────────────────────────────────────────────
  const minDateObj      = useMemo(() => parseDateKey(minBookingDate), [minBookingDate]);
  const selectedDateObj = formData.scheduledDate ? parseDateKey(formData.scheduledDate) : null;

  // ── Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchPackagesCtx(lang).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSelectedPackages((prev) => (prev.length > 0 ? prev : [{ packageId: data[0].id }]));
      }
    });
    const preSelected       = location.state?.selectedPackage;
    const rebookFromBooking = location.state?.rebookFromBooking;
    if (rebookFromBooking?.packages?.length) {
      const normalizedRebookPackage = normalizeSelectedPackage(rebookFromBooking.packages[0]);
      if (normalizedRebookPackage) {
        setSelectedPackages([normalizedRebookPackage]);
      }
      setFormData((prev) => ({
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
    if (preSelected) {
      const normalizedPreSelectedPackage = normalizeSelectedPackage(preSelected);
      if (normalizedPreSelectedPackage) {
        setSelectedPackages([normalizedPreSelectedPackage]);
      }
    }
  }, [location, fetchPackagesCtx, lang, normalizeSelectedPackage]);

  useEffect(() => {
    fetchPackagesCtx(lang);
  }, [fetchPackagesCtx, lang]);

  useEffect(() => {
    if (user && canAutofillCustomerData) {
      setFormData((prev) => ({
        ...prev,
        customerName:    prev.customerName    || `${user.firstName} ${user.lastName}`.trim(),
        customerEmail:   prev.customerEmail   || user.email  || '',
        customerPhone:   prev.customerPhone   || user.phone  || '',
        customerAddress: savedAddress || prev.customerAddress || '',
        houseNumber:     savedHouseNumber || prev.houseNumber || '',
        addressType:     savedAddress ? normalizedPreferredAddressType : prev.addressType,
      }));
    }
  }, [user, savedAddress, savedHouseNumber, normalizedPreferredAddressType, canAutofillCustomerData]);

  // Auto-capture UTM parameters for lead tracking (invisible to user)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source')?.toLowerCase() || '';
    const utmMedium = params.get('utm_medium')?.toLowerCase() || '';
    const utmCampaign = params.get('utm_campaign') || '';
    
    let leadSource = 'Direct';
    if (utmSource.includes('google')) {
      if (utmMedium === 'cpc' || utmMedium === 'lsa') {
        leadSource = utmMedium === 'lsa' ? 'GoogleLSA' : 'GoogleSearch';
      } else {
        leadSource = 'GoogleMaps';
      }
    } else if (utmSource.includes('facebook') || utmSource.includes('fb')) {
      leadSource = 'Facebook';
    } else if (utmSource.includes('instagram')) {
      leadSource = 'Instagram';
    } else if (utmSource.includes('whatsapp')) {
      leadSource = 'WhatsApp';
    } else if (utmSource.includes('referral') || params.get('ref')) {
      leadSource = 'Referral';
    }
    
    const leadSourceDetails = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(' | ');
    
    setFormData((prev) => ({
      ...prev,
      leadSource: leadSource,
      leadSourceDetails: leadSourceDetails || prev.leadSourceDetails,
    }));
  }, []);

  useEffect(() => {
    fetchMonthAvailability(calendarMonth, totalDuration || 60);
  }, [calendarMonth, totalDuration]);

  useEffect(() => {
    if (!formData.scheduledDate) { setAvailableSlots([]); return; }
    let cancelled = false;
    setSlotsLoading(true);
    bookingsAPI.getAvailableSlots(formData.scheduledDate, totalDuration, formData.vehicleType)
      .then((slots) => {
        if (!cancelled) {
          const filtered = slots || [];
          setAvailableSlots(filtered);
          setFormData((prev) => ({ ...prev, timeSlot: filtered.includes(prev.timeSlot) ? prev.timeSlot : '' }));
        }
      })
      .catch(() => { if (!cancelled) setAvailableSlots([]); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [formData.scheduledDate, totalDuration, formData.vehicleType]);

  useEffect(() => {
    if (!isAuthenticated) { setMyCoupons([]); return; }
    offersAPI.getMyCoupons().then((c) => setMyCoupons(c || [])).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || isAdmin) { setMySubscription(null); return; }
    subscriptionsAPI.getMy()
      .then((sub) => setMySubscription((sub?.isActive || sub?.status === 'Active') ? sub : null))
      .catch(() => setMySubscription(null));
  }, [isAuthenticated, isAdmin]);

  // Quote: debounced 400ms
  useEffect(() => {
    if (selectedPackages.length === 0) { setQuote(null); return; }
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const selectedPackage = selectedPackages[0];
        const q = await bookingsAPI.getQuote({
          packages:               selectedPackage ? [{ packageId: selectedPackage.packageId }] : [],
          vehicleType:            formData.vehicleType,
          customerSubscriptionId: (mySubscription?.isActive || mySubscription?.status === 'Active')
            ? (mySubscription?.id ?? null)
            : null,
          offerCode: formData.offerCode?.trim() || null,
        });
        setQuote(q);
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedPackages, formData.vehicleType, formData.offerCode, mySubscription]);

  useEffect(() => {
    if (error) {
      bookingTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const fetchMonthAvailability = async (monthDate, _duration) => {
    try {
      setAvailabilityLoading(true);
      const fromDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const toDate   = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const data = await bookingsAPI.getCalendarAvailability(toDateKey(fromDate), toDateKey(toDate));
      const map  = data.reduce((acc, day) => {
        const rawDate = day.date ?? day.Date;
        if (!rawDate) return acc;
        const dayKey             = String(rawDate).split('T')[0];
        const freeSlots          = day.freeSlots          ?? day.FreeSlots          ?? 0;
        const totalSlots         = day.totalSlots         ?? day.TotalSlots         ?? 0;
        const utilizationPercent = day.utilizationPercent ?? day.UtilizationPercent ?? 0;
        acc[dayKey] = {
          status: normalizeStatusKey(day.status ?? day.Status, { freeSlots, totalSlots, utilizationPercent }),
          freeSlots, totalSlots, utilizationPercent,
        };
        return acc;
      }, {});
      setAvailabilityByDate(map);
    } catch { setAvailabilityByDate({}); }
    finally { setAvailabilityLoading(false); }
  };

  const onSelectCalendarDate = (dateObj) => {
    const dateKey = toDateKey(dateObj);
    const status  = availabilityByDate[dateKey]?.status || 'available';
    if (dateObj < minDateObj || status === 'full') return;
    setFormData((prev) => ({ ...prev, scheduledDate: dateKey, timeSlot: '' }));
    setError('');
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (selectedPackages.length === 0) { setError('Please select at least one package.'); return; }
    if (!formData.scheduledDate || !formData.timeSlot) { setError('Please select a date and time slot.'); return; }
    setPaymentProcessing(true);
    try {
      const bookingData = {
        scheduledDate:          `${formData.scheduledDate}T12:00:00.000Z`,
        timeSlot:               formData.timeSlot,
        customerName:           formData.customerName,
        customerEmail:          formData.customerEmail,
        customerPhone:          formData.customerPhone,
        customerAddress:        formData.customerAddress || null,
        houseNumber:            formData.houseNumber?.trim() || null,
        addressType:            isAdmin ? 'Home' : (formData.addressType || 'Home'),
        offerCode:              formData.offerCode?.trim() || null,
        vehicleMake:            formData.vehicleMake  || null,
        vehicleModel:           formData.vehicleModel || null,
        vehicleYear:            formData.vehicleYear  || null,
        vehicleType:            formData.vehicleType,
        specialInstructions:    formData.specialInstructions || null,
        leadSource:             formData.leadSource || 'Direct',
        leadSourceDetails:      formData.leadSourceDetails || null,
        packages:               selectedPackages[0] ? [{ packageId: selectedPackages[0].packageId }] : [],
        customerSubscriptionId: (mySubscription?.isActive || mySubscription?.status === 'Active')
          ? (mySubscription.id ?? null)
          : null,
      };

      // ── No payment mode: create booking directly ───────────────────────
      if (!isTapMode) {
        const response = await bookingsAPI.create({ ...bookingData, stripePaymentIntentId: `placeholder-${Date.now()}` });
        setSuccess('Booking confirmed! Redirecting…');
        setTimeout(() => navigate(`/booking-confirmation/${response.bookingNumber}`), 1800);
        return;
      }

      // ── Tap Payments mode: create booking first, then redirect to Tap ──
      const serverAmount = quote?.finalPrice ?? calculateTotal();

      // Create the booking (Pending + no payment intent yet)
      const response = await bookingsAPI.create({ ...bookingData, stripePaymentIntentId: `pending-tap-${Date.now()}` });
      const bookingNumber = response.bookingNumber;

      if (serverAmount > 0) {
        // Build the return URL — Tap will append ?tap_id=<chargeId>
        const origin      = window.location.origin;
        const redirectUrl = `${origin}/booking-confirmation/${bookingNumber}`;

        const chargeRes = await bookingsAPI.createTapCharge({
          amount:          serverAmount,
          currency:        'QAR',
          scheduledDate:   bookingData.scheduledDate,
          timeSlot:        bookingData.timeSlot,
          durationMinutes: totalDuration,
          customerEmail:   bookingData.customerEmail,
          bookingNumber,
          redirectUrl,
        });

        // Redirect customer to Tap-hosted payment page
        if (chargeRes?.redirectUrl) {
          window.location.href = chargeRes.redirectUrl;
          return;
        }
        throw new Error('Payment gateway did not return a redirect URL.');
      }

      // Amount is 0 (fully covered by coupon/points) — no payment needed
      setSuccess('Booking confirmed! Redirecting…');
      setTimeout(() => navigate(`/booking-confirmation/${bookingNumber}`), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally { setPaymentProcessing(false); }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div
        className="min-h-screen text-[var(--text-color)] py-10 md:py-16"
        style={{
          background: `
            radial-gradient(circle at 14% 18%, rgba(200,169,107,0.07) 0%, transparent 38%),
            radial-gradient(circle at 86% 10%, rgba(14,165,160,0.05) 0%, transparent 32%)
          `,
        }}
      >
        <div ref={bookingTopRef} className="container mx-auto px-4 max-w-6xl">

          {/* Page Header */}
          <div className="relative text-center mb-12 reveal-up">
            <div className="absolute -top-20 left-0 w-72 h-56 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 0deg,rgba(255,0,80,.08),rgba(255,165,0,.07),rgba(0,255,100,.07),rgba(0,150,255,.08),rgba(180,0,255,.07),rgba(255,0,80,.08))', filter: 'blur(70px)', animation: 'spectrum-float 16s ease-in-out infinite' }} />
            <div className="absolute -top-12 right-0 w-52 h-44 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 180deg,rgba(0,255,200,.08),rgba(255,100,0,.07),rgba(200,0,255,.07),rgba(0,100,255,.08),rgba(255,200,0,.07),rgba(0,255,200,.08))', filter: 'blur(60px)', animation: 'spectrum-float 20s ease-in-out 5s infinite' }} />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="uppercase tracking-[0.28em] text-primary text-[0.7rem] font-semibold whitespace-nowrap">
                  Doorstep Detailing
                </p>
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-3">
                Book Your Service
              </h1>
              <p className="text-[var(--muted-color)] text-base max-w-md mx-auto">
                Select a package, pick a date, and we'll handle the rest.
              </p>
              <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 mt-5">
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={10} className="fill-primary text-primary" />)}
                  <span className="text-[var(--muted-color)] text-xs ml-1">4.9 Rating</span>
                </div>
                <span className="hidden sm:block h-3 w-px bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-color)]">
                  <Shield size={10} className="text-primary" />Secure Booking
                </div>
                <span className="hidden sm:block h-3 w-px bg-[var(--border-color)]" />
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-color)]">
                  <MapPin size={10} className="text-primary" />Mobile · We Come to You
                </div>
              </div>
            </div>
          </div>

          {/* Spectrum separator */}
          <div className="mb-8"><div className="spectrum-line" /></div>

          <div className="grid lg:grid-cols-3 gap-6 items-start">

            {/* ── FORM ── */}
            <div className="lg:col-span-2 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error   && <StatusBanner type="error"   message={error}   />}
                {success && <StatusBanner type="success" message={success} />}

                <BookingVehiclePackageStep
                  formData={formData}
                  setFormData={setFormData}
                  vehicleMultiplier={currentVehicleMultiplier}
                  packages={packages}
                  packagesCtxLoading={packagesCtxLoading}
                  selectedPackages={selectedPackages}
                  setSelectedPackages={setSelectedPackages}
                  quote={quote}
                />

                <BookingScheduleStep
                  calendarMonth={calendarMonth}
                  setCalendarMonth={setCalendarMonth}
                  availabilityByDate={availabilityByDate}
                  availabilityLoading={availabilityLoading}
                  formData={formData}
                  setFormData={setFormData}
                  availableSlots={availableSlots}
                  slotsLoading={slotsLoading}
                  totalDuration={totalDuration}
                  minDateObj={minDateObj}
                  selectedDateObj={selectedDateObj}
                  onSelectDate={onSelectCalendarDate}
                />

                <BookingDetailsCheckoutStep
                  formData={formData}
                  setFormData={setFormData}
                  canAutofillCustomerData={canAutofillCustomerData}
                  isAdmin={isAdmin}
                  savedAddresses={savedAddresses}
                  savedHouseNumbers={savedHouseNumbers}
                  addressHelperText={addressHelperText}
                  myCoupons={myCoupons}
                  isTapMode={isTapMode}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  quote={quote}
                  totalAmount={totalAmount}
                  userReferralPoints={user?.referralPoints || 0}
                  hasUsedReferral={hasUsedReferral}
                  referredByName={referredByName}
                />

                {/* ── Submit ── */}
                <div>
                  <div className="cta-prism-glow rounded-2xl mb-3">
                    <button
                      type="submit"
                      disabled={loading || paymentProcessing || selectedPackages.length === 0}
                      className="premium-btn w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {paymentProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Processing…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Confirm Booking<ArrowRight size={17} />
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5">
                    {[
                      { Icon: Shield,      label: 'Secure Checkout'      },
                      { Icon: CheckCircle, label: 'Instant Confirmation' },
                      { Icon: Clock,       label: 'Free Reschedule'       },
                    ].map(({ Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-color)]">
                        <Icon size={11} className="text-primary" />{label}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            {/* ── SIDEBAR ── */}
            <BookingSidebar
              selectedPackages={selectedPackages}
              packages={packages}
              quote={quote}
              vehicleMultiplier={currentVehicleMultiplier}
              formData={formData}
              totalDuration={totalDuration}
              totalAmount={totalAmount}
              quoteLoading={quoteLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Booking() {
  const { payments } = useFeatures();
  const devBypass = !!localStorage.getItem('DEV_BYPASS_PAYMENT');
  const paymentsEnabled = payments || devBypass;

  return <BookingForm isTapMode={paymentsEnabled} />;
}

export default Booking;
