import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toDateKey, parseDateKey, toLocalIsoDate } from '../../utils/dateUtils';
import { bookingsAPI } from '../../api/bookings';
import { offersAPI } from '../../api/offers';
import { subscriptionsAPI } from '../../api/subscriptions';
import { useAuth } from '../../context/AuthContext';
import { usePackages } from '../../context/PackagesContext';
import { useSettings } from '../../context/SettingsContext';
import {
  Calendar, Clock, User, Mail, Phone, Car,
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Tag, MapPin, Zap, ArrowRight, Ticket, Shield, Star, CreditCard,
} from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../api/stripe';
import AddressAutocompleteInput from '../../components/shared/AddressAutocompleteInput';
import { formatQAR } from '../../utils/currency';
import { getSiteContent } from '../../config/siteContent';
import { useFeatures } from '../../context/FeaturesContext';

/* ── Availability helpers (unchanged) ─────────────────────── */
const deriveStatusFromCapacity = ({ freeSlots, totalSlots, utilizationPercent }) => {
  const free  = Number(freeSlots);
  const total = Number(totalSlots);
  const util  = Number(utilizationPercent);
  if (Number.isFinite(free) && free <= 0) return 'full';
  if (Number.isFinite(util) && util >= 70) return 'medium';
  if (Number.isFinite(total) && Number.isFinite(free) && total > 0) {
    if (((total - free) / total) * 100 >= 70) return 'medium';
  }
  return 'available';
};
const normalizeStatusKey = (rawStatus, fallbackMetrics = {}) => {
  if (typeof rawStatus === 'string') {
    const key = rawStatus.trim().toLowerCase();
    if (['available', 'medium', 'full'].includes(key)) return key;
    if (/^\d+$/.test(rawStatus.trim())) {
      return ['available', 'medium', 'full'][Number(rawStatus.trim())] || deriveStatusFromCapacity(fallbackMetrics);
    }
    return deriveStatusFromCapacity(fallbackMetrics);
  }
  if (typeof rawStatus === 'number') {
    return ['available', 'medium', 'full'][rawStatus] || deriveStatusFromCapacity(fallbackMetrics);
  }
  return deriveStatusFromCapacity(fallbackMetrics);
};

/* ── PRISM CSS ────────────────────────────────────────────── */
const PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg);          opacity: 0.28; }
  33%      { transform: translate(18px,-24px) rotate(120deg); opacity: 0.55; }
  66%      { transform: translate(-12px,12px) rotate(240deg); opacity: 0.38; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.5),  0 0 28px rgba(255,165,0,.2), 0 0 55px rgba(0,255,100,.15), 0 0 90px rgba(0,100,255,.1); }
  25%      { box-shadow: 0 0 0 1.5px rgba(255,210,0,.5),  0 0 28px rgba(0,255,150,.2), 0 0 55px rgba(0,150,255,.15), 0 0 90px rgba(200,0,255,.1); }
  50%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.5),  0 0 28px rgba(160,0,255,.2), 0 0 55px rgba(255,0,100,.15), 0 0 90px rgba(255,220,0,.1); }
  75%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.5),  0 0 28px rgba(255,0,100,.2), 0 0 55px rgba(255,210,0,.15), 0 0 90px rgba(0,255,150,.1); }
}
@keyframes prism-card-glow {
  0%,100% { box-shadow: 0 0 0 1px rgba(255,100,80,.4),  0 0 20px rgba(255,165,0,.16), 0 0 44px rgba(0,255,100,.12); }
  33%      { box-shadow: 0 0 0 1px rgba(0,160,255,.4),   0 0 20px rgba(160,0,255,.16), 0 0 44px rgba(255,0,100,.12); }
  66%      { box-shadow: 0 0 0 1px rgba(0,255,150,.4),   0 0 20px rgba(255,255,0,.16),  0 0 44px rgba(0,100,255,.12); }
}

/* ── Cursor orb ── */
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(85px); mix-blend-mode: screen;
  will-change: transform, background;
}

/* ── Prism ray — clipped by parent overflow:hidden ── */
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.055) 15%, rgba(255,200,0,.08) 30%,
    rgba(0,255,145,.07) 50%, rgba(0,145,255,.07) 70%,
    rgba(195,0,255,.05) 85%, transparent 100%);
}

/* ── Prism glass hover ── */
.prism-glass { position: relative; overflow: hidden; transition: box-shadow 0.45s ease; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(
    circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.2) 0%, rgba(80,255,160,.14) 25%,
    rgba(40,130,255,.14) 50%, rgba(200,40,255,.1) 70%, transparent 86%
  );
  opacity: 0; transition: opacity 0.3s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.prism-glass:hover        { animation: prism-card-glow 4s ease-in-out infinite; }

/* ── Selected state — persistent glow replaces ring ── */
.pkg-selected-glow { animation: prism-card-glow 4s ease-in-out infinite; }

/* ── CTA glow ── */
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }

/* ── Spectrum separator ── */
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.85) 12%, rgba(255,165,0,.9) 24%,
    rgba(255,255,0,.9) 36%, rgba(0,255,100,.9) 48%,
    rgba(0,150,255,.9) 60%, rgba(150,0,255,.85) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.45;
}
`;

/* ── Prismatic cursor orb ─────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY, rafId;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const tick = () => {
      curX += (mouseX - curX) * 0.09;
      curY += (mouseY - curY) * 0.09;
      const hue = (mouseX / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${curX}px, ${curY}px, 0)`;
      el.style.background = `conic-gradient(from ${hue}deg,
        rgba(255,0,80,.23), rgba(255,160,0,.21), rgba(255,255,0,.18),
        rgba(0,255,100,.21), rgba(0,160,255,.23), rgba(160,0,255,.21),
        rgba(255,0,80,.23))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}

/* ── Section heading ──────────────────────────────────────── */
function SectionHeading({ icon: Icon, children, step }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {step !== undefined && (
        <span className="text-[0.58rem] font-bold tracking-[0.2em] flex-shrink-0"
          style={{ color: 'var(--muted-color)', opacity: 0.45 }}>
          {String(step).padStart(2, '0')}
        </span>
      )}
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      )}
      <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">{children}</h2>
      <span className="flex-1 h-px ml-1 hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.18), transparent)' }} />
    </div>
  );
}

/* ── Status banner ────────────────────────────────────────── */
function StatusBanner({ type, message }) {
  const isError = type === 'error';
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${
      isError ? 'bg-red-500/8 border-red-500/20 text-red-400' : 'bg-green-500/8 border-green-500/20 text-green-400'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isError ? 'bg-red-500/15' : 'bg-green-500/15'
      }`}>
        {isError ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
      </div>
      <p className="text-sm font-medium leading-relaxed">{message}</p>
    </div>
  );
}

/* ── BookingForm ──────────────────────────────────────────── */
function BookingForm({ stripe, elements, isStripeMode }) {
  const features = useFeatures();
  const { bookingPageConfig } = getSiteContent();
  const timeSlots      = bookingPageConfig.timeSlots || [];
  const minBookingDate = toLocalIsoDate(bookingPageConfig.earliestBookingOffsetDays ?? 0);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { packages, packagesLoading: packagesCtxLoading, fetchPackages: fetchPackagesCtx } = usePackages();
  const canAutofillCustomerData = isAuthenticated && !isAdmin;
  const addressHelperText = isAdmin
    ? undefined
    : 'Address suggestions help prevent invalid service locations before deployment.';

  /* ── State (unchanged) ──────────────────────────────────── */
  const settings      = useSettings();
  const [selectedPackages,    setSelectedPackages]    = useState([]);
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState('');
  const [success,             setSuccess]             = useState('');
  const [mySubscription,      setMySubscription]      = useState(null);
  const [paymentProcessing,   setPaymentProcessing]   = useState(false);
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
  const bookingTopRef = useRef(null);
  const [formData, setFormData] = useState({
    scheduledDate:       minBookingDate,
    timeSlot:            '',
    customerName:        canAutofillCustomerData ? `${user.firstName} ${user.lastName}` : '',
    customerEmail:       canAutofillCustomerData ? user?.email  || '' : '',
    customerPhone:       canAutofillCustomerData ? user?.phone  || '' : '',
    customerAddress:     '',
    addressType:         'Home',
    offerCode:           '',
    vehicleType:         'Sedan',
    vehicleMake:         '',
    vehicleModel:        '',
    vehicleYear:         '',
    specialInstructions: '',
  });

  const normalizedPreferredAddressType = user?.preferredAddressType || 'Home';
  const savedAddresses = {
    Home:  canAutofillCustomerData ? user?.homeAddress?.trim()  || '' : '',
    Work:  canAutofillCustomerData ? user?.workAddress?.trim()  || '' : '',
    Other: canAutofillCustomerData ? user?.otherAddress?.trim() || '' : '',
  };
  const savedAddress = savedAddresses[normalizedPreferredAddressType] || '';

  /* ── Vehicle multiplier — from backend settings, not hardcoded ─── */
  const vehicleMultiplier = settings.vehicleMultipliers[formData.vehicleType] ?? 1.0;

  /* ── Client-side total (fallback only — used until quote loads) ── */
  const calculateTotal = () => {
    const base = selectedPackages.reduce((total, item) => {
      const pkg = packages.find(p => p.id === item.packageId);
      return total + Math.round(((pkg?.price || 0) * vehicleMultiplier) * 100) / 100;
    }, 0);
    if (mySubscription?.isActive && mySubscription.discountPercent > 0) {
      return Math.round(base * (1 - mySubscription.discountPercent / 100) * 100) / 100;
    }
    return base;
  };
  const calculateDurationMinutes = () =>
    selectedPackages.reduce((total, item) => {
      const pkg = packages.find(p => p.id === item.packageId);
      return total + (pkg?.estimatedDurationMinutes || 0);
    }, 0);
  const formatDuration = (minutes) => {
    const safe = Math.max(0, Math.floor(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };
  const extractSlotStart = (slotValue) => {
    if (!slotValue || typeof slotValue !== 'string') return '';
    const t = slotValue.trim();
    if (t.includes('-')) return t.split('-')[0].trim();
    if (/^\d{1,2}$/.test(t)) return `${t.padStart(2, '0')}:00`;
    return t;
  };
  const calculateEndTimeFromSlot = (slotValue, durationMinutes) => {
    const start = extractSlotStart(slotValue);
    const parts = start.split(':');
    if (parts.length !== 2) return '';
    const [h, m] = parts.map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
    const total = h * 60 + m + Math.max(0, Number(durationMinutes) || 0);
    const endH  = Math.floor(total / 60) % 24;
    const endM  = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };
  const formatSlotStartHour = (slotValue) => {
    const start  = extractSlotStart(slotValue);
    const [h, m] = start.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return slotValue;
    const norm   = ((h % 24) + 24) % 24;
    const period = norm >= 12 ? 'PM' : 'AM';
    const twelve = norm % 12 === 0 ? 12 : norm % 12;
    return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
  };
  const formatTimeToAmPm = (timeValue) => {
    if (!timeValue || typeof timeValue !== 'string') return timeValue;
    const [h, m] = timeValue.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return timeValue;
    const norm   = ((h % 24) + 24) % 24;
    const period = norm >= 12 ? 'PM' : 'AM';
    const twelve = norm % 12 === 0 ? 12 : norm % 12;
    return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
  };
  const minDateObj      = parseDateKey(minBookingDate);
  const selectedDateObj = formData.scheduledDate ? parseDateKey(formData.scheduledDate) : null;
  const getCalendarCells = () => {
    const year     = calendarMonth.getFullYear();
    const month    = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const cells    = [];
    for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  /* ── Effects (unchanged) ────────────────────────────────── */
  useEffect(() => {
    fetchPackagesCtx().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSelectedPackages((prev) => (prev.length > 0 ? prev : [{ packageId: data[0].id, quantity: 1 }]));
      }
    });
    const preSelected       = location.state?.selectedPackage;
    const rebookFromBooking = location.state?.rebookFromBooking;
    if (rebookFromBooking?.packages?.length) {
      setSelectedPackages([rebookFromBooking.packages[0]]);
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
    if (preSelected) setSelectedPackages([{ packageId: preSelected.id, quantity: 1 }]);
  }, [location]);
  useEffect(() => {
    if (selectedPackages.length > 1) setSelectedPackages([selectedPackages[0]]);
  }, [selectedPackages]);
  useEffect(() => {
    if (user && canAutofillCustomerData) {
      setFormData((prev) => ({
        ...prev,
        customerName:    prev.customerName    || `${user.firstName} ${user.lastName}`.trim(),
        customerEmail:   prev.customerEmail   || user.email  || '',
        customerPhone:   prev.customerPhone   || user.phone  || '',
        customerAddress: savedAddress || prev.customerAddress || '',
        addressType:     savedAddress ? normalizedPreferredAddressType : prev.addressType,
      }));
    }
  }, [user, savedAddress, normalizedPreferredAddressType, canAutofillCustomerData]);
  useEffect(() => {
    fetchMonthAvailability(calendarMonth);
  }, [calendarMonth]);
  useEffect(() => {
    if (!formData.scheduledDate) { setAvailableSlots([]); return; }
    const durationMinutes = calculateDurationMinutes();
    let cancelled = false;
    setSlotsLoading(true);
    bookingsAPI.getAvailableSlots(formData.scheduledDate, durationMinutes, formData.vehicleType)
      .then((slots) => {
        if (!cancelled) {
          const todayKey = toLocalIsoDate(0);
          const bufferMinutes = settings.defaultBufferMinutes;
          const filtered = formData.scheduledDate === todayKey
            ? (slots || []).filter((slot) => {
                const [h, m] = String(slot).split('-')[0].trim().split(':').map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return true;
                const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
                return (slotTime - new Date()) >= bufferMinutes * 60 * 1000;
              })
            : (slots || []);
          setAvailableSlots(filtered);
          setFormData((prev) => ({ ...prev, timeSlot: filtered.includes(prev.timeSlot) ? prev.timeSlot : '' }));
        }
      })
      .catch(() => { if (!cancelled) setAvailableSlots([]); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [formData.scheduledDate, selectedPackages, settings.defaultBufferMinutes]);
  useEffect(() => {
    if (!isAuthenticated) { setMyCoupons([]); return; }
    offersAPI.getMyCoupons().then((c) => setMyCoupons(c || [])).catch(() => {});
  }, [isAuthenticated]);
  // Fetch active subscription to apply discount
  useEffect(() => {
    if (!isAuthenticated || isAdmin) { setMySubscription(null); return; }
    subscriptionsAPI.getMySubscription()
      .then(sub => setMySubscription((sub?.isActive || sub?.status === 'Active') ? sub : null))
      .catch(() => setMySubscription(null));
  }, [isAuthenticated, isAdmin]);

  // ── Server quote: fetch authoritative price whenever inputs change ────────────
  // Debounced 400ms to avoid hammering on every keystroke.
  // Falls back to null → UI uses calculateTotal() as a fallback display value.
  useEffect(() => {
    if (selectedPackages.length === 0) { setQuote(null); return; }
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = await bookingsAPI.getQuote({
          packages:              selectedPackages,
          vehicleType:           formData.vehicleType,
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
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      bookingTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  /* ── fetchMonthAvailability (unchanged) ─────────────────── */
  const fetchMonthAvailability = async (monthDate, duration) => {
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

  /* ── Handlers (unchanged) ───────────────────────────────── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value, ...(name === 'scheduledDate' ? { timeSlot: '' } : {}) });
  };
  const onSelectCalendarDate = (dateObj) => {
    const dateKey = toDateKey(dateObj);
    const status  = availabilityByDate[dateKey]?.status || 'available';
    if (dateObj < minDateObj || status === 'full') return;
    setFormData((prev) => ({ ...prev, scheduledDate: dateKey, timeSlot: '' }));
    setError('');
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (selectedPackages.length === 0) { setError('Please select at least one package.'); return; }
    if (!formData.scheduledDate || !formData.timeSlot) { setError('Please select a date and time slot.'); return; }
    if (isStripeMode && (!stripe || !elements)) { setError('Stripe is still loading. Please try again in a moment.'); return; }
    setPaymentProcessing(true);
    try {
      const bookingData = {
        scheduledDate:         `${formData.scheduledDate}T12:00:00.000Z`,
        timeSlot:              formData.timeSlot,
        customerName:          formData.customerName,
        customerEmail:         formData.customerEmail,
        customerPhone:         formData.customerPhone,
        customerAddress:       formData.customerAddress || null,
        addressType:           isAdmin ? 'Home' : (formData.addressType || 'Home'),
        offerCode:             formData.offerCode?.trim() || null,
        vehicleMake:           formData.vehicleMake  || null,
        vehicleModel:          formData.vehicleModel || null,
        vehicleYear:           formData.vehicleYear  || null,
        vehicleType:           formData.vehicleType,
        specialInstructions:   formData.specialInstructions || null,
        packages:              selectedPackages,
        customerSubscriptionId: (mySubscription?.isActive || mySubscription?.status === 'Active')
          ? (mySubscription.id ?? null)
          : null,
      };
      let stripePaymentIntentId = `placeholder-${Date.now()}`;
      if (isStripeMode) {
        // Use server-authoritative price from quote if available; fall back to
        // client calculation only if the quote endpoint hasn't responded yet.
        const serverAmount = quote?.finalPrice ?? calculateTotal();
        const intentRes = await bookingsAPI.createPaymentIntentV2({
          amount: serverAmount,
          scheduledDate: bookingData.scheduledDate,
          timeSlot: bookingData.timeSlot,
          durationMinutes: calculateDurationMinutes(),
          customerEmail: bookingData.customerEmail,
        });
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) { setError('Card input unavailable. Please refresh and try again.'); return; }
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(intentRes.clientSecret, {
          payment_method: { card: cardElement, billing_details: { name: formData.customerName, email: formData.customerEmail } },
        });
        if (stripeError) { setError(stripeError.message || 'Payment failed. Please try another card.'); return; }
        stripePaymentIntentId = paymentIntent?.id || stripePaymentIntentId;
      }
      const response = await bookingsAPI.create({ ...bookingData, stripePaymentIntentId });
      setSuccess('Booking confirmed! Redirecting…');
      setTimeout(() => navigate(`/booking-confirmation/${response.bookingNumber}`), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally { setPaymentProcessing(false); }
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
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

          {/* ════════════════════════════════════════════════════
              PAGE HEADER — matches home hero badge pattern
          ════════════════════════════════════════════════════ */}
          <div className="relative text-center mb-12 reveal-up">
            {/* Spectral orbs */}
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

            {/* ════════════════════════ LEFT: FORM ═══════════════════════ */}
            <div className="lg:col-span-2 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error   && <StatusBanner type="error"   message={error}   />}
                {success && <StatusBanner type="success" message={success} />}

                {/* ── 01 Package ──────────────────────────────────────── */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="prism-ray" style={{ left: '68%', width: '14%', animation: 'prism-ray-sweep 18s ease-in-out 1s infinite' }} />
                  <SectionHeading icon={Zap} step={1}>Select Package</SectionHeading>
                  {packagesCtxLoading && packages.length === 0 ? (
                    <div className="flex items-center gap-3 py-10 justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-[var(--muted-color)] text-sm">Loading packages…</span>
                    </div>
                  ) : packages.length === 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-amber-400 text-sm flex items-center gap-3">
                      <AlertCircle size={15} className="flex-shrink-0" />
                      No packages available right now. Please try again later.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {packages.map((pkg) => {
                        const isSelected = selectedPackages.some(p => p.packageId === pkg.id);
                        // Display-only estimate — server quote gives authoritative price in summary
                        const adjPrice   = Math.round(pkg.price * vehicleMultiplier * 100) / 100;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedPackages([{ packageId: pkg.id, quantity: 1 }])}
                            onMouseMove={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                              e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                            }}
                            className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 relative overflow-hidden prism-glass ${
                              isSelected
                                ? 'border-primary bg-primary/6 pkg-selected-glow'
                                : 'border-[var(--border-color)] hover:border-primary/40 hover:bg-white/3'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute inset-0 pointer-events-none"
                                style={{ background: 'linear-gradient(135deg, rgba(200,169,107,0.07) 0%, transparent 55%)' }} />
                            )}
                            <div className="relative flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                  isSelected ? 'border-primary bg-primary' : 'border-[var(--border-color)]'
                                }`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-[var(--ink)]" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[var(--heading-color)] tracking-tight">{pkg.name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/12 border border-primary/25 px-2 py-0.5 rounded-full">
                                      {pkg.tier}
                                    </span>
                                  </div>
                                  {pkg.description && (
                                    <p className="text-sm text-[var(--muted-color)] mt-1 line-clamp-2">{pkg.description}</p>
                                  )}
                                  <p className="text-xs text-[var(--muted-color)] mt-1.5 flex items-center gap-1">
                                    <Clock size={11} />{pkg.estimatedDurationMinutes} min
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {vehicleMultiplier !== 1.0 && (
                                  <p className="text-xs text-[var(--muted-color)] line-through">{formatQAR(pkg.price)}</p>
                                )}
                                <p className="text-xl font-bold text-primary">{formatQAR(adjPrice)}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── 02 Schedule — no overflow-hidden (select dropdown) ── */}
                <div className="glass-card p-6 relative">
                  <div className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.3), rgba(14,165,160,0.25), transparent)' }} />
                  <SectionHeading icon={Calendar} step={2}>Schedule</SectionHeading>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Calendar */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Select Date</p>
                      <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]"
                          style={{ background: 'rgba(255,255,255,0.025)' }}>
                          <button type="button"
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                            className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
                            <ChevronLeft size={14} className="text-[var(--muted-color)]" />
                          </button>
                          <span className="text-sm font-bold text-[var(--heading-color)]">
                            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <button type="button"
                            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                            className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
                            <ChevronRight size={14} className="text-[var(--muted-color)]" />
                          </button>
                        </div>
                        <div className="grid grid-cols-7" style={{ background: 'rgba(255,255,255,0.015)' }}>
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                            <div key={d} className="text-[10px] font-bold text-[var(--muted-color)] text-center py-2 tracking-wider">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-px p-px" style={{ background: 'var(--border-color)' }}>
                          {getCalendarCells().map((dateObj, i) => {
                            if (!dateObj) return (
                              <div key={`blank-${i}`} className="h-10" style={{ background: 'var(--surface-bg)' }} />
                            );
                            const dateKey    = toDateKey(dateObj);
                            const statusKey  = availabilityByDate[dateKey]?.status || 'available';
                            const isSelected = selectedDateObj && toDateKey(selectedDateObj) === dateKey;
                            const isBeforeMin = dateObj < minDateObj;
                            const isFull      = statusKey === 'full';
                            const isDisabled  = isBeforeMin || isFull;
                            const cellCls = isSelected
                              ? 'bg-primary text-[var(--ink)] font-bold ring-1 ring-primary/40 ring-inset'
                              : isDisabled
                                ? 'bg-[var(--surface-bg)] text-[var(--muted-color)] opacity-30 cursor-not-allowed'
                                : statusKey === 'medium'
                                  ? 'bg-amber-500/6 text-amber-300 hover:bg-amber-500/14 cursor-pointer'
                                  : 'bg-[var(--surface-bg)] text-[var(--text-color)] hover:bg-primary/10 hover:text-primary cursor-pointer';
                            const dotCls = statusKey === 'full' ? 'bg-red-500' : statusKey === 'medium' ? 'bg-amber-400' : 'bg-green-400';
                            return (
                              <button key={dateKey} type="button" disabled={isDisabled}
                                onClick={() => onSelectCalendarDate(dateObj)}
                                className={`h-10 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors relative ${cellCls}`}>
                                {dateObj.getDate()}
                                {!isBeforeMin && (
                                  <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-[var(--ink)]/40' : dotCls} opacity-70`} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[var(--border-color)]"
                          style={{ background: 'rgba(255,255,255,0.015)' }}>
                          {[{ dot: 'bg-green-400', label: 'Open' }, { dot: 'bg-amber-400', label: 'Filling up' }, { dot: 'bg-red-500', label: 'Full' }].map(({ dot, label }) => (
                            <span key={label} className="flex items-center gap-1.5 text-[10px] text-[var(--muted-color)]">
                              <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
                            </span>
                          ))}
                          {availabilityLoading && (
                            <span className="ml-auto text-[10px] text-primary animate-pulse">Updating…</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Time slot */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Time Slot</p>
                      <select name="timeSlot" value={formData.timeSlot} onChange={handleChange}
                        required disabled={slotsLoading}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition">
                        {slotsLoading ? (
                          <option value="">Checking availability…</option>
                        ) : availableSlots !== null && availableSlots.length === 0 ? (
                          <option value="">No times available — try another day</option>
                        ) : (
                          <>
                            <option value="">Select a time</option>
                            {(availableSlots || []).map((slot) => (
                              <option key={slot} value={slot}>{formatSlotStartHour(slot)}</option>
                            ))}
                          </>
                        )}
                      </select>
                      {availableSlots !== null && !slotsLoading && (
                        <p className={`text-xs mt-2 ${availableSlots.length === 0 ? 'text-red-400' : 'text-[var(--muted-color)]'}`}>
                          {availableSlots.length === 0
                            ? 'No times available for this date. Please choose another day.'
                            : `${availableSlots.length} slot${availableSlots.length !== 1 ? 's' : ''} available`}
                        </p>
                      )}
                      {formData.scheduledDate && formData.timeSlot && (() => {
                        const dur     = calculateDurationMinutes();
                        const start   = formatSlotStartHour(formData.timeSlot);
                        const endTime = calculateEndTimeFromSlot(formData.timeSlot, dur);
                        const end     = formatTimeToAmPm(endTime);
                        return (
                          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/6 p-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-[3px] h-full bg-primary/40 rounded-l-xl" />
                            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-2">Appointment Preview</p>
                            <p className="text-sm font-semibold text-[var(--heading-color)]">
                              {new Date(formData.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <p className="text-sm text-[var(--muted-color)] mt-1">
                              {endTime ? `${start} – ${end}` : start}
                              {dur > 0 && <span className="ml-2 opacity-60">· {formatDuration(dur)}</span>}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── 03 Customer info ────────────────────────────────── */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="prism-ray" style={{ left: '78%', width: '11%', animation: 'prism-ray-sweep 16s ease-in-out 7s infinite' }} />
                  <SectionHeading icon={User} step={3}>Your Information</SectionHeading>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { label: 'Full Name',     name: 'customerName',  type: 'text',  icon: User,  placeholder: 'John Smith',      colSpan: '' },
                      { label: 'Email Address', name: 'customerEmail', type: 'email', icon: Mail,  placeholder: 'you@example.com', colSpan: '' },
                      { label: 'Phone Number',  name: 'customerPhone', type: 'tel',   icon: Phone, placeholder: '+974 3300 0000',  colSpan: 'md:col-span-2' },
                    ].map(({ label, name, type, icon: FieldIcon, placeholder, colSpan }) => (
                      <div key={name} className={colSpan}>
                        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{label}</label>
                        <div className="relative">
                          <FieldIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                          <input type={type} name={name} value={formData[name]} onChange={handleChange}
                            placeholder={placeholder} required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 04 Address — no overflow-hidden (autocomplete dropdown) ── */}
                <div className="glass-card p-6 relative">
                  <div className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(14,165,160,0.3), rgba(200,169,107,0.25), transparent)' }} />
                  <SectionHeading icon={MapPin} step={4}>Service Address</SectionHeading>
                  {canAutofillCustomerData && (
                    <div className="mb-5 rounded-xl border border-[var(--border-color)] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Saved Addresses</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(savedAddresses).map(([type, address]) => {
                          const isActive = formData.addressType === type && formData.customerAddress === address;
                          return (
                            <button key={type} type="button" disabled={!address}
                              onClick={() => { if (!address) return; setFormData((prev) => ({ ...prev, customerAddress: address, addressType: type })); }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                !address
                                  ? 'opacity-30 cursor-not-allowed border-[var(--border-color)] text-[var(--muted-color)]'
                                  : isActive
                                    ? 'border-primary bg-primary/20 text-primary'
                                    : 'border-[var(--border-color)] hover:border-primary/50 text-[var(--text-color)]'
                              }`}>
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <AddressAutocompleteInput
                    label="Area / Street"
                    value={formData.customerAddress}
                    onChange={(v) => setFormData((prev) => ({ ...prev, customerAddress: v }))}
                    placeholder="Search your service address"
                    required
                    helperText={addressHelperText}
                  />
                  {!isAdmin && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Address Type</p>
                      <div className="flex gap-2">
                        {['Home', 'Work', 'Other'].map((type) => (
                          <button key={type} type="button"
                            onClick={() => setFormData({ ...formData, addressType: type })}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                              formData.addressType === type
                                ? 'border-primary bg-primary/15 text-primary'
                                : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                            }`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 05 Vehicle ──────────────────────────────────────── */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="prism-ray" style={{ left: '55%', width: '16%', animation: 'prism-ray-sweep 11s ease-in-out 6s infinite' }} />
                  <SectionHeading icon={Car} step={5}>Vehicle Details</SectionHeading>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Vehicle Type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { value: 'Motorcycle', label: 'Motorcycle', badge: '−20%', badgeCls: 'text-green-400 bg-green-500/10 border-green-500/25' },
                        { value: 'Sedan',      label: 'Sedan',      badge: 'Base',  badgeCls: 'text-[var(--muted-color)] bg-white/5 border-[var(--border-color)]' },
                        { value: 'SUV',        label: 'SUV / 4×4',  badge: '+25%', badgeCls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
                        { value: 'Pickup',     label: 'Pickup',     badge: '+50%', badgeCls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
                      ].map(({ value, label, badge, badgeCls }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData({ ...formData, vehicleType: value })}
                          onMouseMove={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                            e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                          }}
                          className={`rounded-xl border-2 p-3 text-center transition-all duration-200 prism-glass ${
                            formData.vehicleType === value
                              ? 'border-primary bg-primary/10 text-primary pkg-selected-glow'
                              : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                          }`}
                        >
                          <p className="text-sm font-bold leading-tight">{label}</p>
                          <span className={`mt-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Make',  name: 'vehicleMake',  placeholder: 'Toyota' },
                      { label: 'Model', name: 'vehicleModel', placeholder: 'Camry'  },
                      { label: 'Year',  name: 'vehicleYear',  placeholder: '2022', maxLength: 4 },
                    ].map(({ label, name, placeholder, maxLength }) => (
                      <div key={name}>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{label}</p>
                        <input type="text" name={name} value={formData[name]} onChange={handleChange}
                          placeholder={placeholder} maxLength={maxLength}
                          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2.5 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 06 Offers & Notes ───────────────────────────────── */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="prism-ray" style={{ left: '76%', width: '10%', animation: 'prism-ray-sweep 19s ease-in-out 2s infinite' }} />
                  <SectionHeading icon={Tag} step={6}>Offers &amp; Notes</SectionHeading>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Coupon Code</p>
                    <div className="relative">
                      <Ticket size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                      <input type="text" name="offerCode" value={formData.offerCode}
                        onChange={(e) => setFormData({ ...formData, offerCode: e.target.value.toUpperCase() })}
                        placeholder="WELCOME10"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition tracking-widest font-mono" />
                    </div>
                    {myCoupons.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {myCoupons.slice(0, 5).map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, offerCode: c.personalCode }))}
                            className={`text-xs px-3 py-1.5 rounded-full font-mono font-semibold border transition ${
                              formData.offerCode === c.personalCode
                                ? 'border-primary bg-primary/20 text-primary'
                                : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/50'
                            }`}>
                            {c.personalCode}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--muted-color)] mt-2 leading-relaxed">
                      Loyalty rewards appear here after completed bookings. Discounts are validated server-side at checkout.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Special Instructions</p>
                    <textarea name="specialInstructions" value={formData.specialInstructions} onChange={handleChange}
                      rows={3} placeholder="Any specific requests or concerns about your vehicle or service location…"
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none" />
                  </div>
                </div>

                {/* ── 07 Payment ──────────────────────────────────────── */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="prism-ray" style={{ left: '28%', width: '13%', animation: 'prism-ray-sweep 15s ease-in-out 9s infinite' }} />
                  <SectionHeading icon={CreditCard} step={7}>Payment</SectionHeading>
                  {isStripeMode ? (
                    <>
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4">
                        <CardElement options={{
                          style: {
                            base: { fontSize: '15px', color: '#E8E9EC', '::placeholder': { color: '#7A8495' } },
                            invalid: { color: '#EF4444' },
                          },
                        }} />
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Shield size={11} className="text-[var(--muted-color)] flex-shrink-0" />
                        <p className="text-xs text-[var(--muted-color)]">
                          Your card will be pre-authorised. Payment is captured only after service completion.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border-color)] p-5"
                      style={{ background: 'rgba(255,255,255,0.015)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                          <AlertCircle size={15} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--heading-color)]">Payment placeholder active</p>
                          <p className="text-sm text-[var(--muted-color)] mt-1">
                            Stripe is temporarily disabled. Bookings will be created without a payment charge — for testing purposes only.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Submit ──────────────────────────────────────────── */}
                <div>
                  {/* Prismatic glow wraps the button */}
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
                      { icon: Shield,      label: 'Secure Checkout'      },
                      { icon: CheckCircle, label: 'Instant Confirmation' },
                      { icon: Clock,       label: 'Free Reschedule'       },
                    ].map(({ icon: TrustIcon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-color)]">
                        <TrustIcon size={11} className="text-primary" />{label}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            {/* ════════════════════════ RIGHT: SIDEBAR ═══════════════════ */}
            <div className="lg:col-span-1">
              <div className="glass-card p-6 sticky top-24 relative overflow-hidden">
                <div className="prism-ray" style={{ left: '38%', width: '22%', animation: 'prism-ray-sweep 16s ease-in-out 5s infinite' }} />
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-[var(--border-color)]">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                    <Tag size={13} className="text-primary" />
                  </div>
                  <h2 className="text-base font-bold text-[var(--heading-color)] tracking-tight">Booking Summary</h2>
                </div>
                {selectedPackages.length > 0 ? (
                  <>
                    <div className="space-y-3 mb-5">
                      {selectedPackages.map((item) => {
                        const pkg = packages.find(p => p.id === item.packageId);
                        if (!pkg) return null;
                        // Use server multiplier from quote when available; fall back to settings value
                        const multiplierUsed = quote?.vehicleMultiplier ?? vehicleMultiplier;
                        const adjPrice = Math.round(pkg.price * multiplierUsed * 100) / 100;
                        return (
                          <div key={item.packageId} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--heading-color)] truncate">{pkg.name}</p>
                              <p className="text-xs text-primary font-medium mt-0.5">{pkg.tier}</p>
                            </div>
                            <p className="text-sm font-bold text-primary flex-shrink-0">{formatQAR(adjPrice)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5">
                      {vehicleMultiplier !== 1.0 && (
                        <div className="flex justify-between text-xs text-[var(--muted-color)]">
                          <span>Vehicle adj. ({formData.vehicleType})</span>
                          <span className={`font-semibold ${vehicleMultiplier > 1 ? 'text-amber-400' : 'text-green-400'}`}>×{vehicleMultiplier}</span>
                        </div>
                      )}
                      {quote?.subscriptionDiscountAmount > 0 && (
                        <div className="flex justify-between text-xs text-green-400">
                          <span>Subscription discount ({quote.subscriptionDiscountPercent}%)</span>
                          <span className="font-semibold">−{formatQAR(quote.subscriptionDiscountAmount)}</span>
                        </div>
                      )}
                      {quote?.offerDiscountAmount > 0 && (
                        <div className="flex justify-between text-xs text-green-400">
                          <span>Offer discount</span>
                          <span className="font-semibold">−{formatQAR(quote.offerDiscountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-[var(--muted-color)]">
                        <span>Est. duration</span>
                        <span className="font-semibold text-[var(--text-color)]">{formatDuration(calculateDurationMinutes())}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-color)]">
                        <span className="text-sm font-bold text-[var(--heading-color)]">Total</span>
                        {quoteLoading ? (
                          <span className="text-sm text-[var(--muted-color)] animate-pulse">Calculating…</span>
                        ) : (
                          <span className="text-2xl font-bold text-primary">
                            {formatQAR(quote?.finalPrice ?? calculateTotal())}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--muted-color)] leading-relaxed">
                        {quote ? 'Price confirmed by server.' : 'Estimated — server confirms at checkout.'}
                      </p>
                    </div>
                    {formData.offerCode && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2.5">
                        <Ticket size={12} className="text-primary flex-shrink-0" />
                        <span className="text-xs text-[var(--muted-color)]">Coupon:</span>
                        <span className="text-xs font-mono font-bold text-primary ml-auto">{formData.offerCode}</span>
                      </div>
                    )}
                    {formData.scheduledDate && formData.timeSlot && (() => {
                      const dur     = calculateDurationMinutes();
                      const start   = formatSlotStartHour(formData.timeSlot);
                      const endTime = calculateEndTimeFromSlot(formData.timeSlot, dur);
                      const end     = formatTimeToAmPm(endTime);
                      return (
                        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-[3px] h-full bg-primary/35 rounded-l-xl" />
                          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary mb-2">Appointment</p>
                          <p className="text-sm font-semibold text-[var(--heading-color)]">
                            {new Date(formData.scheduledDate).toLocaleDateString('en-US', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-[var(--muted-color)] mt-1">
                            {endTime ? `${start} – ${end}` : start}
                            {dur > 0 && <span className="ml-2 opacity-60">· {formatDuration(dur)}</span>}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="mt-5 pt-4 border-t border-[var(--border-color)] space-y-2.5">
                      {[
                        { icon: Shield,      label: 'Secure & Encrypted Payment'   },
                        { icon: CheckCircle, label: 'Instant Booking Confirmation' },
                        { icon: Clock,       label: 'Free Reschedule Available'    },
                      ].map(({ icon: TrustIcon, label }) => (
                        <div key={label} className="flex items-center gap-2.5 text-xs text-[var(--muted-color)]">
                          <TrustIcon size={12} className="text-primary flex-shrink-0" />{label}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
                      <Calendar size={22} className="text-primary" style={{ opacity: 0.5 }} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--heading-color)] mb-1">No package selected</p>
                    <p className="text-xs text-[var(--muted-color)]">Choose a package above to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Stripe wrapper (unchanged) ─────────────────────────────── */
function StripeBookingForm() {
  const stripe   = useStripe();
  const elements = useElements();
  return <BookingForm stripe={stripe} elements={elements} isStripeMode={true} />;
}

function Booking() {
  const { payments } = useFeatures();
  return payments ? (
    <Elements stripe={stripePromise}><StripeBookingForm /></Elements>
  ) : (
    <BookingForm stripe={null} elements={null} isStripeMode={false} />
  );
}

export default Booking;