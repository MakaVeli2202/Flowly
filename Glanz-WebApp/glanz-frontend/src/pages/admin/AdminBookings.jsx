import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../../api/bookings';
import { authAPI } from '../../api/auth';
import {
  Calendar, Clock, Package,
  Filter, Search, AlertCircle,
  X, Zap, Mail, Phone,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';
import { getStatusConfig } from '../../utils/statusConfig';
import { subscribeToNotifications } from '../../api/notificationBus';

const getLocale = (lang) => {
  if (String(lang || '').startsWith('ar')) return 'ar';
  if (String(lang || '').startsWith('de')) return 'de-DE';
  return 'en-GB';
};

const UI_BY_LANG = {
  en: {
    failedLoadBookings: 'Failed to load bookings',
    failedUpdateAssignmentMode: 'Failed to update assignment mode',
    cannotAssignWorker: 'Cannot assign: this worker is not available.',
    scheduleConflict: 'Schedule conflict at this booking time.',
    failedAssignWorker: 'Failed to assign worker',
    unassigned: 'Unassigned',
    inactive: 'Inactive',
    inactiveWorker: 'Inactive worker',
    unavailable: 'Unavailable',
    loadingBookings: 'Loading bookings...',
    allBookings: 'All Bookings',
    subtitle: 'Manage customer appointments in real time',
    searchPlaceholder: 'Search by booking #, name or email...',
    filtersBypassed: 'Period and status filters bypassed',
    result: 'result',
    results: 'results',
    noResults: 'No results',
    bookings: 'Bookings',
    revenue: 'Revenue',
    cost: 'Cost',
    profit: 'Profit',
    ofTotal: (n) => `of ${n} total`,
    margin: 'margin',
    all: 'All',
    today: 'Today',
    assignmentMode: 'Assignment Mode',
    assignmentModeDesc: 'Auto assigns a detailer on booking. Manual keeps them unassigned but still checks capacity.',
    auto: 'Auto',
    manual: 'Manual',
    loading: 'Loading...',
    saving: 'Saving...',
    activeMode: (enabled) => `Active: ${enabled ? 'Auto Assign' : 'Manual Assignment'}`,
    filterByStatus: 'Filter by Status',
    period: 'Period',
    thisWeek: 'This Week',
    nextWeek: 'Next Week',
    thisMonth: 'This Month',
    pickDay: 'Pick Day',
    chooseDate: 'Choose Date',
    unassignedBookings: (n) => `Unassigned Bookings (${n})`,
    needWorkerBeforeDate: 'Need a worker before scheduled date',
    assign: 'Assign',
    bookingNumber: 'Booking #',
    customer: 'Customer',
    dateTime: 'Date & Time',
    amount: 'Amount',
    worker: 'Worker',
    cancelReq: 'Cancel req.',
    rescheduleReq: 'Reschedule req.',
    details: 'Details',
    checking: 'Checking...',
    noBookingsFound: 'No Bookings Found',
    noBookingsForFilters: 'No bookings match your current filters.',
    noStatusBookings: (status) => `No ${status.toLowerCase()} bookings.`,
    statusLabels: {
      Pending: 'Pending',
      Confirmed: 'Confirmed',
      InProgress: 'In Progress',
      Completed: 'Completed',
      Cancelled: 'Cancelled',
    },
  },
  ar: {
    failedLoadBookings: 'فشل تحميل الحجوزات',
    failedUpdateAssignmentMode: 'فشل تحديث وضع التعيين',
    cannotAssignWorker: 'لا يمكن التعيين: هذا العامل غير متاح.',
    scheduleConflict: 'تعارض في الجدول في وقت هذا الحجز.',
    failedAssignWorker: 'فشل تعيين العامل',
    unassigned: 'غير معيّن',
    inactive: 'غير نشط',
    inactiveWorker: 'عامل غير نشط',
    unavailable: 'غير متاح',
    loadingBookings: 'جارٍ تحميل الحجوزات...',
    allBookings: 'كل الحجوزات',
    subtitle: 'إدارة مواعيد العملاء بشكل فوري',
    searchPlaceholder: 'ابحث برقم الحجز أو الاسم أو البريد الإلكتروني...',
    filtersBypassed: 'تم تجاوز فلاتر الفترة والحالة',
    result: 'نتيجة',
    results: 'نتائج',
    noResults: 'لا نتائج',
    bookings: 'الحجوزات',
    revenue: 'الإيرادات',
    cost: 'التكلفة',
    profit: 'الربح',
    ofTotal: (n) => `من إجمالي ${n}`,
    margin: 'الهامش',
    all: 'الكل',
    today: 'اليوم',
    assignmentMode: 'وضع التعيين',
    assignmentModeDesc: 'التعيين التلقائي يحدد عاملًا عند الحجز. الوضع اليدوي يتركه غير معيّن مع استمرار فحص السعة.',
    auto: 'تلقائي',
    manual: 'يدوي',
    loading: 'جارٍ التحميل...',
    saving: 'جارٍ الحفظ...',
    activeMode: (enabled) => `النشط: ${enabled ? 'تعيين تلقائي' : 'تعيين يدوي'}`,
    filterByStatus: 'تصفية حسب الحالة',
    period: 'الفترة',
    thisWeek: 'هذا الأسبوع',
    nextWeek: 'الأسبوع القادم',
    thisMonth: 'هذا الشهر',
    pickDay: 'اختر يومًا',
    chooseDate: 'اختر التاريخ',
    unassignedBookings: (n) => `حجوزات غير معيّنة (${n})`,
    needWorkerBeforeDate: 'تحتاج عاملا قبل الموعد المحدد',
    assign: 'تعيين',
    bookingNumber: 'رقم الحجز',
    customer: 'العميل',
    dateTime: 'التاريخ والوقت',
    amount: 'المبلغ',
    worker: 'العامل',
    cancelReq: 'طلب إلغاء',
    rescheduleReq: 'طلب إعادة جدولة',
    details: 'التفاصيل',
    checking: 'جارٍ التحقق...',
    noBookingsFound: 'لم يتم العثور على حجوزات',
    noBookingsForFilters: 'لا توجد حجوزات تطابق الفلاتر الحالية.',
    noStatusBookings: (status) => `لا توجد حجوزات بالحالة ${status.toLowerCase()}.`,
    statusLabels: {
      Pending: 'قيد الانتظار',
      Confirmed: 'مؤكد',
      InProgress: 'قيد التنفيذ',
      Completed: 'مكتمل',
      Cancelled: 'ملغي',
    },
  },
  de: {
    failedLoadBookings: 'Buchungen konnten nicht geladen werden',
    failedUpdateAssignmentMode: 'Zuweisungsmodus konnte nicht aktualisiert werden',
    cannotAssignWorker: 'Zuweisung nicht moglich: Dieser Mitarbeiter ist nicht verfugbar.',
    scheduleConflict: 'Terminuberschneidung zur Buchungszeit.',
    failedAssignWorker: 'Mitarbeiter konnte nicht zugewiesen werden',
    unassigned: 'Nicht zugewiesen',
    inactive: 'Inaktiv',
    inactiveWorker: 'Inaktiver Mitarbeiter',
    unavailable: 'Nicht verfugbar',
    loadingBookings: 'Buchungen werden geladen...',
    allBookings: 'Alle Buchungen',
    subtitle: 'Kundentermine in Echtzeit verwalten',
    searchPlaceholder: 'Nach Buchungsnummer, Name oder E-Mail suchen...',
    filtersBypassed: 'Zeitraum- und Statusfilter werden umgangen',
    result: 'Ergebnis',
    results: 'Ergebnisse',
    noResults: 'Keine Ergebnisse',
    bookings: 'Buchungen',
    revenue: 'Umsatz',
    cost: 'Kosten',
    profit: 'Gewinn',
    ofTotal: (n) => `von insgesamt ${n}`,
    margin: 'Marge',
    all: 'Alle',
    today: 'Heute',
    assignmentMode: 'Zuweisungsmodus',
    assignmentModeDesc: 'Auto weist bei Buchung automatisch einen Mitarbeiter zu. Manuell lasst die Buchung unzugewiesen und pruft weiter die Kapazitat.',
    auto: 'Auto',
    manual: 'Manuell',
    loading: 'Wird geladen...',
    saving: 'Wird gespeichert...',
    activeMode: (enabled) => `Aktiv: ${enabled ? 'Automatische Zuweisung' : 'Manuelle Zuweisung'}`,
    filterByStatus: 'Nach Status filtern',
    period: 'Zeitraum',
    thisWeek: 'Diese Woche',
    nextWeek: 'Nachste Woche',
    thisMonth: 'Dieser Monat',
    pickDay: 'Tag auswahlen',
    chooseDate: 'Datum auswahlen',
    unassignedBookings: (n) => `Nicht zugewiesene Buchungen (${n})`,
    needWorkerBeforeDate: 'Vor dem Termin ist ein Mitarbeiter erforderlich',
    assign: 'Zuweisen',
    bookingNumber: 'Buchung #',
    customer: 'Kunde',
    dateTime: 'Datum & Zeit',
    amount: 'Betrag',
    worker: 'Mitarbeiter',
    cancelReq: 'Stornoanfrage',
    rescheduleReq: 'Umbuchungsanfrage',
    details: 'Details',
    checking: 'Wird gepruft...',
    noBookingsFound: 'Keine Buchungen gefunden',
    noBookingsForFilters: 'Keine Buchungen entsprechen den aktuellen Filtern.',
    noStatusBookings: (status) => `Keine Buchungen mit Status ${status.toLowerCase()}.`,
    statusLabels: {
      Pending: 'Ausstehend',
      Confirmed: 'Bestatigt',
      InProgress: 'In Bearbeitung',
      Completed: 'Abgeschlossen',
      Cancelled: 'Storniert',
    },
  },
};

/* ── PRISM CSS ─────────────────────────────────────────────── */

/* ── Cursor orb ─────────────────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.14),rgba(255,160,0,.12),rgba(255,255,0,.10),rgba(0,255,100,.12),rgba(0,160,255,.14),rgba(160,0,255,.12),rgba(255,0,80,.14))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 420, height: 420, top: '-210px', left: '-210px' }} />;
}

/* ── FilterPill ──────────────────────────────────────────────── */
function FilterPill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition ${
        active
          ? 'bg-primary text-white border-primary'
          : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/50 hover:text-[var(--text-color)]'
      }`}
    >
      {children}
    </button>
  );
}

/* ── StatCard ────────────────────────────────────────────────── */
function StatCard({ label, value, sub, colorClass = 'text-primary' }) {
  return (
    <div className="px-6 py-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{label}</p>
      <p className={`text-2xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--muted-color)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */
function formatBookingTimeWindow(timeSlot, durationMinutes) {
  if (!timeSlot) return '—';
  if (!durationMinutes) return timeSlot;
  const [startHour, startMin] = timeSlot.split(':').map(Number);
  if (isNaN(startHour)) return timeSlot;
  const endTotal = startHour * 60 + (startMin || 0) + Number(durationMinutes);
  const endH = Math.floor(endTotal / 60) % 24;
  const endM = endTotal % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${timeSlot} – ${pad(endH)}:${pad(endM)}`;
}

/* ════════════════════════════════════════════════════════════
   ADMIN BOOKINGS
════════════════════════════════════════════════════════════ */
function AdminBookings() {
  const { t, lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
  const navigate = useNavigate();
  const [bookings,       setBookings]       = useState([]);
  const [totalCount,     setTotalCount]     = useState(0);
  const [totalPages,     setTotalPages]     = useState(1);
  const [page,           setPage]           = useState(1);
  const PAGE_SIZE = 100;
  const [workers,        setWorkers]        = useState([]);
  const [availableWorkersByBooking,        setAvailableWorkersByBooking]        = useState({});
  const [loadingAvailableWorkersByBooking, setLoadingAvailableWorkersByBooking] = useState({});
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [periodFilter,   setPeriodFilter]   = useState('Today');
  const [specificDateFilter, setSpecificDateFilter] = useState(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  });
  const [filterStatus,    setFilterStatus]    = useState('All');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchInput,     setSearchInput]     = useState('');
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const [isHighlightFading,    setIsHighlightFading]    = useState(false);
  const [autoAssignEnabled,    setAutoAssignEnabled]    = useState(true);
  const [assignmentModeLoading, setAssignmentModeLoading] = useState(true);
  const [assignmentModeSaving,  setAssignmentModeSaving]  = useState(false);
  const searchDebounceRef = useRef(null);

  /* ── Highlight row ─────────────────────────────────────── */
  const triggerRowHighlight = (bookingId) => {
    setHighlightedBookingId(bookingId);
    setIsHighlightFading(false);
    window.setTimeout(() => {
      const el = document.querySelector(`[data-booking-id="${bookingId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    window.setTimeout(() => {
      setIsHighlightFading(true);
      window.setTimeout(() => { setHighlightedBookingId(null); setIsHighlightFading(false); }, 500);
    }, 3000);
  };

  /* ── Date helpers ──────────────────────────────────────── */
  const getWeekStart = (date) => {
    const d = new Date(date), day = d.getDay();
    d.setHours(0,0,0,0); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  };
  const getWeekEnd = (date) => {
    const end = new Date(getWeekStart(date));
    end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
    return end;
  };
  const getMonthStart = (date) => {
    const s = new Date(date.getFullYear(), date.getMonth(), 1);
    s.setHours(0,0,0,0); return s;
  };
  const getMonthEnd = (date) => {
    const e = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    e.setHours(23,59,59,999); return e;
  };

  const getPeriodRange = (period, specificDate) => {
    const now = new Date();
    if (period === 'All')       return {};
    if (period === 'Today')     return { dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), dateTo: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString() };
    if (period === 'SpecificDay' && specificDate) { const sd = new Date(specificDate); return { dateFrom: new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()).toISOString(), dateTo: new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 23, 59, 59, 999).toISOString() }; }
    if (period === 'ThisWeek')  return { dateFrom: getWeekStart(now).toISOString(),  dateTo: getWeekEnd(now).toISOString() };
    if (period === 'ThisMonth') return { dateFrom: getMonthStart(now).toISOString(), dateTo: getMonthEnd(now).toISOString() };
    if (period === 'NextWeek')  { const nws = new Date(getWeekStart(now)); nws.setDate(nws.getDate() + 7); return { dateFrom: nws.toISOString(), dateTo: getWeekEnd(nws).toISOString() }; }
    return {};
  };

  /* ── API helpers ───────────────────────────────────────── */
  const fetchBookings = async ({ showLoader = true, targetPage = page } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const { dateFrom, dateTo } = getPeriodRange(periodFilter, specificDateFilter);
      const result = await bookingsAPI.getAll({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: searchQuery || undefined,
        status: filterStatus !== 'All' ? filterStatus : undefined,
        dateFrom,
        dateTo,
      });
      setBookings(result.items ?? []);
      setTotalCount(result.totalCount ?? 0);
      setTotalPages(result.totalPages ?? 1);
    } catch { setError(ui.failedLoadBookings); }
    finally { if (showLoader) setLoading(false); }
  };
  const fetchWorkers = async () => {
    try { const data = await authAPI.getWorkers(); setWorkers(data || []); }
    catch { /* non-blocking: workers list can be empty */ }
  };
  const fetchAssignmentMode = async () => {
    try {
      setAssignmentModeLoading(true);
      const data = await bookingsAPI.getAssignmentMode();
      setAutoAssignEnabled(Boolean(data?.autoAssignEnabled));
    } catch { /* non-blocking: keep last known assignment mode */ }
    finally { setAssignmentModeLoading(false); }
  };
  const handleAssignmentModeChange = async (enabled) => {
    try {
      setAssignmentModeSaving(true);
      const data = await bookingsAPI.updateAssignmentMode(enabled);
      setAutoAssignEnabled(Boolean(data?.autoAssignEnabled));
      await fetchBookings({ showLoader: false });
    } catch (err) {
      alert(err?.response?.data?.message || ui.failedUpdateAssignmentMode);
    } finally { setAssignmentModeSaving(false); }
  };

  /* ── Effects ───────────────────────────────────────────── */
  useEffect(() => {
    fetchWorkers(); fetchAssignmentMode();
    const hlId = sessionStorage.getItem('highlightBookingId');
    if (hlId) {
      const bid = parseInt(hlId, 10);
      setPeriodFilter('All');
      triggerRowHighlight(bid);
      sessionStorage.removeItem('highlightBookingId');
    }
    const onHL = (e) => {
      const bid = e?.detail?.bookingId;
      if (Number.isFinite(bid)) { setPeriodFilter('All'); triggerRowHighlight(bid); }
    };
    window.addEventListener('highlight-booking', onHL);
    return () => window.removeEventListener('highlight-booking', onHL);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch whenever filters or page changes
  useEffect(() => {
    fetchBookings({ showLoader: true, targetPage: page });
  }, [page, filterStatus, searchQuery, periodFilter, specificDateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh booking list on any incoming WebSocket notification
  const silentRefresh = useCallback(() => fetchBookings({ showLoader: false }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => subscribeToNotifications(silentRefresh), [silentRefresh]);

  /* ── Worker helpers ────────────────────────────────────── */
  const handleAssignWorker = async (bookingId, workerId) => {
    try {
      const parsed = workerId === '' ? null : Number(workerId);
      if (parsed !== null) {
        const avail = availableWorkersByBooking[bookingId];
        if (avail) {
          const info = avail.find(w => w.workerId === parsed);
          if (info && !info.isAvailable) {
            alert(`${ui.cannotAssignWorker}\n\n${info.note || ui.scheduleConflict}`);
            return;
          }
        }
      }
      await bookingsAPI.assignWorker(bookingId, parsed, false);
      await fetchBookings();
      setAvailableWorkersByBooking(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    } catch (err) {
      alert(err?.response?.data?.message || ui.failedAssignWorker);
    }
  };
  const fetchAvailableWorkersForBooking = async (bookingId) => {
    if (availableWorkersByBooking[bookingId] || loadingAvailableWorkersByBooking[bookingId]) return;
    try {
      setLoadingAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: true }));
      const data = await bookingsAPI.getAvailableWorkers(bookingId);
      setAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: data || [] }));
    } catch { /* non-blocking: availability list remains empty */ }
    finally {
      setLoadingAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: false }));
    }
  };
  const workerLabelById = (workerId) => {
    const w = workers.find(w => w.id === workerId);
    if (!w) return ui.unassigned;
    const label = `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`;
    return w.isActive === false ? `${label} (${ui.inactive})` : label;
  };
  const getWorkerOptionsForBooking = (bookingId) => {
    const avail = availableWorkersByBooking[bookingId];
    if (!avail) return workers.map(w => ({
      workerId: w.id,
      label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`,
      isAvailable: w.isActive !== false,
      note: w.isActive === false ? ui.inactiveWorker : null,
    }));
    return avail.map(w => ({
      workerId: w.workerId,
      label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.workerId}`,
      isAvailable: w.isAvailable,
      note: w.note,
    }));
  };

  /* ── Filtering handled server-side; bookings = current page ── */
  const filteredBookings = bookings;
  const periodSummary = filteredBookings.reduce(
    (acc, b) => ({
      revenue: acc.revenue + (Number(b.totalAmount) || 0),
      cost:    acc.cost    + (Number(b.estimatedCost) || 0),
      profit:  acc.profit  + (Number(b.estimatedProfit) || 0),
    }),
    { revenue: 0, cost: 0, profit: 0 },
  );
  const statuses = ['All', ...new Set(bookings.map(b => b.status))];
  const periods  = ['Today', 'CurrentWeek', 'NextWeek', 'ThisMonth', 'SpecificDay', 'All'];
  const statusLabel = (status) => {
    if (status === 'All') return ui.all;
    return ui.statusLabels?.[status] || status;
  };
  const periodLabel = (period) => {
    if (period === 'Today') return ui.today;
    if (period === 'CurrentWeek') return ui.thisWeek;
    if (period === 'NextWeek') return ui.nextWeek;
    if (period === 'ThisMonth') return ui.thisMonth;
    if (period === 'SpecificDay') return ui.pickDay;
    if (period === 'All') return ui.all;
    return period;
  };

  /* ── Loading ───────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">{ui.loadingBookings}</p>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 text-[var(--text-color)]"
        style={{
          background: `
            radial-gradient(circle at 8% 10%, rgba(200,169,107,0.05) 0%, transparent 40%),
            radial-gradient(circle at 92% 88%, rgba(14,165,160,0.04) 0%, transparent 36%)
          `,
        }}
      >
        <div className="container mx-auto px-4">

          {/* ── Page header ──────────────────────────────── */}
          <div className="mb-10 relative">
            <div className="absolute -top-8 -left-12 w-80 h-64 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.07),rgba(14,165,160,.05),rgba(200,169,107,.07))', filter: 'blur(72px)', animation: 'spectrum-float 22s ease-in-out infinite' }} />
            <div className="flex items-center gap-3 mb-3 relative">
              <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
              <p className="uppercase tracking-[0.26em] text-primary text-[0.62rem] font-semibold">{t('adminPanel')}</p>
              <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>
            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-2 relative">{ui.allBookings}</h1>
            <p className="text-[var(--muted-color)] relative">{ui.subtitle}</p>
            {error && (
              <p className="text-rose-400 text-sm mt-3 relative">{error}</p>
            )}
          </div>

          {/* ── Search ───────────────────────────────────── */}
          <div className="glass-card p-4 mb-5 prism-glass relative overflow-hidden"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
              e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
            }}
          >
            <div className="prism-ray" style={{ left: '72%', width: '12%', animation: 'prism-ray-sweep 18s ease-in-out 5s infinite' }} />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/22 flex items-center justify-center flex-shrink-0">
                <Search size={15} className="text-primary" />
              </div>
              <input
                type="text" value={searchInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchInput(v);
                  clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => { setSearchQuery(v); setPage(1); }, 350);
                }}
                placeholder={ui.searchPlaceholder}
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                  className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5 transition">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2.5 text-xs text-[var(--muted-color)] pl-12">
                {ui.filtersBypassed} ·{' '}
                {totalCount > 0
                  ? `${totalCount} ${totalCount !== 1 ? ui.results : ui.result}`
                  : ui.noResults}
              </p>
            )}
          </div>

          {/* ── Stats strip ──────────────────────────────── */}
          <div className="glass-card relative overflow-hidden mb-5">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 35%, #0ea5a0 65%, transparent)' }} />
            <div className="prism-ray" style={{ left: '55%', width: '18%', animation: 'prism-ray-sweep 15s ease-in-out 2s infinite' }} />
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--border-color)]">
              <StatCard
                label={ui.bookings} colorClass="text-[var(--heading-color)]"
                value={totalCount} sub={`p.${page}/${totalPages}`}
              />
              <StatCard label={ui.revenue} value={formatQAR(periodSummary.revenue)} />
              <StatCard label={ui.cost}    value={formatQAR(periodSummary.cost)}    colorClass="text-rose-400" />
              <StatCard
                label={ui.profit} value={formatQAR(periodSummary.profit)}
                colorClass={periodSummary.profit >= 0 ? 'text-green-400' : 'text-rose-400'}
                sub={`${periodSummary.revenue > 0 ? ((periodSummary.profit / periodSummary.revenue) * 100).toFixed(1) : 0}% ${ui.margin}`}
              />
            </div>
          </div>

          {/* ── Controls row ─────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">

            {/* Assignment mode */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="prism-ray" style={{ left: '74%', width: '10%', animation: 'prism-ray-sweep 24s ease-in-out 7s infinite' }} />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center">
                  <Zap size={14} className="text-primary" />
                </div>
                <h3 className="text-sm font-bold text-[var(--heading-color)]">{ui.assignmentMode}</h3>
              </div>
              <p className="text-xs text-[var(--muted-color)] mb-4 leading-relaxed">
                {ui.assignmentModeDesc}
              </p>
              <div className="flex gap-2">
                {[
                  { label: ui.auto,   value: true  },
                  { label: ui.manual, value: false },
                ].map(({ label, value }) => (
                  <button key={label} type="button"
                    onClick={() => handleAssignmentModeChange(value)}
                    disabled={assignmentModeLoading || assignmentModeSaving}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition disabled:opacity-60 ${
                      autoAssignEnabled === value
                        ? 'bg-primary text-white border-primary'
                        : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted-color)] mt-2.5 text-center">
                {assignmentModeLoading ? ui.loading : assignmentModeSaving ? ui.saving : ui.activeMode(autoAssignEnabled)}
              </p>
            </div>

            {/* Status filter */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="prism-ray" style={{ left: '62%', width: '11%', animation: 'prism-ray-sweep 17s ease-in-out 10s infinite' }} />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center">
                  <Filter size={14} className="text-primary" />
                </div>
                <h3 className="text-sm font-bold text-[var(--heading-color)]">{ui.filterByStatus}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {statuses.map(status => (
                  <FilterPill key={status} active={filterStatus === status} onClick={() => { setFilterStatus(status); setPage(1); }}>
                    {statusLabel(status)}{status === filterStatus ? ` (${totalCount})` : ''}
                  </FilterPill>
                ))}
              </div>
            </div>
          </div>

          {/* ── Period filter ─────────────────────────────── */}
          <div className="glass-card p-6 mb-5 relative overflow-hidden">
            <div className="prism-ray" style={{ left: '42%', width: '14%', animation: 'prism-ray-sweep 20s ease-in-out 0s infinite' }} />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center">
                <Calendar size={14} className="text-primary" />
              </div>
              <h3 className="text-sm font-bold text-[var(--heading-color)]">{ui.period}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {periods.map(p => (
                <FilterPill key={p} active={periodFilter === p} onClick={() => { setPeriodFilter(p); setPage(1); }}>
                  {periodLabel(p)}
                </FilterPill>
              ))}
            </div>
            {periodFilter === 'SpecificDay' && (
              <div className="mt-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">{ui.chooseDate}</label>
                <input type="date" value={specificDateFilter}
                  onChange={(e) => setSpecificDateFilter(e.target.value)}
                  className="px-3 py-2 border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}
          </div>

          {/* ── Unassigned alert ──────────────────────────── */}
          {(() => {
            const unassigned = bookings.filter(b =>
              !b.assignedWorkerId && b.status !== 'Cancelled' && b.status !== 'Completed' &&
              new Date(b.scheduledDate) >= new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`)
            ).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
            if (!unassigned.length) return null;
            return (
              <div className="glass-card relative overflow-hidden mb-5" style={{ borderColor: 'rgba(245,158,11,0.28)' }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.65), transparent)' }} />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/28 flex items-center justify-center">
                      <AlertCircle size={14} className="text-amber-400" />
                    </div>
                    <h3 className="text-sm font-bold text-amber-400">{ui.unassignedBookings(unassigned.length)}</h3>
                    <span className="ml-auto text-[11px] text-[var(--muted-color)] hidden sm:block">{ui.needWorkerBeforeDate}</span>
                  </div>
                  <div className="space-y-2">
                    {unassigned.map(b => (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border border-amber-500/18 bg-amber-500/5 px-4 py-2.5">
                        <span className="text-xs font-black text-amber-400 font-mono">{b.bookingNumber}</span>
                        <span className="text-sm font-semibold text-[var(--heading-color)]">{b.customerName}</span>
                        <span className="text-xs text-[var(--muted-color)]">
                          {new Date(b.scheduledDate).toLocaleDateString(getLocale(lang), { timeZone: 'UTC', month: 'short', day: 'numeric' })} · {b.timeSlot}
                        </span>
                        <button type="button"
                          className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition"
                          onClick={() => navigate(`/admin/bookings/${b.id}`, { state: { booking: b } })}>
                          {ui.assign} →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Table ─────────────────────────────────────── */}
          {filteredBookings.length > 0 ? (
            <div className="glass-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {[ui.bookingNumber, ui.customer, ui.dateTime, ui.amount, ui.profit, ui.worker, ''].map(h => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredBookings.map(booking => (
                      <tr
                        key={booking.id}
                        data-booking-id={booking.id}
                        className={`transition-all duration-300 hover:bg-white/[0.02] ${
                          highlightedBookingId === booking.id
                            ? isHighlightFading ? 'highlight-fade-out' : 'highlight-flash'
                            : ''
                        }`}
                      >
                        {/* # */}
                        <td className="px-5 py-4">
                          <p className="font-black text-primary font-mono text-sm">{booking.bookingNumber}</p>
                          <p className="text-[11px] text-[var(--muted-color)] mt-0.5">{new Date(booking.createdAt).toLocaleDateString()}</p>
                          {(() => {
                            const sc = getStatusConfig(booking.status);
                            const Icon = sc.icon;
                            return (
                              <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>
                                <Icon size={9} />{sc.label}
                              </span>
                            );
                          })()}
                          {booking.cancellationRequested && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-rose-500/14 text-rose-400 border border-rose-500/22 px-2 py-0.5 rounded-full">
                              🚫 {ui.cancelReq}
                            </span>
                          )}
                          {booking.rescheduleRequested && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-amber-500/14 text-amber-400 border border-amber-500/22 px-2 py-0.5 rounded-full">
                              📅 {ui.rescheduleReq}
                            </span>
                          )}
                        </td>
                        {/* Customer */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-[var(--heading-color)] text-sm">{booking.customerName}</p>
                          <p className="text-[11px] text-[var(--muted-color)] mt-0.5 flex items-center gap-1"><Mail size={10} />{booking.customerEmail}</p>
                          <p className="text-[11px] text-[var(--muted-color)] flex items-center gap-1"><Phone size={10} />{booking.customerPhone}</p>
                        </td>
                        {/* Date & time */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-[var(--heading-color)] text-sm">
                            {new Date(booking.scheduledDate).toLocaleDateString(getLocale(lang), { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-[var(--muted-color)] mt-0.5 flex items-center gap-1">
                            <Clock size={10} />{formatBookingTimeWindow(booking.timeSlot, booking.estimatedDurationMinutes)}
                          </p>
                        </td>
                        {/* Amount */}
                        <td className="px-5 py-4">
                          <p className="font-black text-primary text-lg">{formatQAR(booking.totalAmount)}</p>
                          <p className="text-[11px] text-[var(--muted-color)]">{ui.cost}: {formatQAR(booking.estimatedCost)}</p>
                        </td>
                        {/* Profit */}
                        <td className="px-5 py-4">
                          <p className={`font-black text-base ${booking.estimatedProfit >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                            {formatQAR(booking.estimatedProfit)}
                          </p>
                          <p className="text-[11px] text-[var(--muted-color)]">
                            {booking.totalAmount > 0 ? ((booking.estimatedProfit / booking.totalAmount) * 100).toFixed(1) : 0}%
                          </p>
                        </td>
                        {/* Worker */}
                        <td className="px-5 py-4">
                          <p className="text-xs text-[var(--muted-color)] mb-2">{workerLabelById(booking.assignedWorkerId)}</p>
                          <select
                            value={booking.assignedWorkerId ?? ''}
                            onChange={(e) => handleAssignWorker(booking.id, e.target.value)}
                            onFocus={() => fetchAvailableWorkersForBooking(booking.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] cursor-pointer min-w-[155px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            <option value="">{ui.unassigned}</option>
                            {getWorkerOptionsForBooking(booking.id).map(w => (
                              <option key={w.workerId} value={w.workerId}>
                                {w.isAvailable ? w.label : `⚠ ${w.label} (${w.note || ui.unavailable})`}
                              </option>
                            ))}
                          </select>
                          {loadingAvailableWorkersByBooking[booking.id] && (
                            <p className="text-[10px] text-[var(--muted-color)] mt-1">{ui.checking}</p>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <button onClick={() => navigate(`/admin/bookings/${booking.id}`, { state: { booking } })}
                            className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 hover:border-primary/55 transition whitespace-nowrap">
                            {ui.details} →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="glass-card p-16 text-center">
              <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mx-auto mb-5">
                <Package size={26} className="text-[var(--muted-color)]" />
              </div>
              <h2 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-2">{ui.noBookingsFound}</h2>
              <p className="text-[var(--muted-color)]">
                {filterStatus === 'All' ? ui.noBookingsForFilters : ui.noStatusBookings(filterStatus)}
              </p>
            </div>
          )}

          {/* ── Pagination ────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-4 px-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--muted-color)] hover:text-[var(--heading-color)] disabled:opacity-30 transition-all"
              >
                &larr; Prev
              </button>
              <span className="text-xs text-[var(--muted-color)]">
                Page {page} of {totalPages} &middot; {totalCount} total
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--muted-color)] hover:text-[var(--heading-color)] disabled:opacity-30 transition-all"
              >
                Next &rarr;
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default AdminBookings;