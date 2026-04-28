import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../../api/bookings';
import { authAPI } from '../../api/auth';
import {
  Calendar, Clock, User, Package,
  Filter, Search, AlertCircle,
  X, Zap, Mail, Phone, Check,
} from 'lucide-react';
import { formatQAR } from '../../utils/currency';
import { statusColors as statusConfig, paymentStatusColors as paymentStatusConfig, getStatusConfig } from '../../utils/statusConfig';
import { usePolling } from '../../hooks/usePolling';

const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];

/* ── PRISM CSS ─────────────────────────────────────────────── */
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
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.20; }
  33%      { transform: translate(14px,-18px) rotate(120deg); opacity: 0.36; }
  66%      { transform: translate(-8px,10px)  rotate(240deg); opacity: 0.25; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.45),  0 0 24px rgba(255,165,0,.18); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.45),  0 0 24px rgba(160,0,255,.18); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.45),  0 0 24px rgba(255,0,100,.18); }
}
@keyframes row-highlight {
  0%   { background: rgba(200,169,107,0.20); }
  60%  { background: rgba(200,169,107,0.10); }
  100% { background: transparent; }
}

.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(90px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.04) 15%, rgba(255,200,0,.06) 30%,
    rgba(0,255,145,.05) 50%, rgba(0,145,255,.05) 70%,
    rgba(195,0,255,.04) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.16) 0%, rgba(80,255,160,.10) 30%,
    rgba(40,130,255,.10) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.3s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.80) 12%, rgba(255,165,0,.85) 24%,
    rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.42;
}
.highlight-flash    { animation: row-highlight 3s ease-out forwards; }
.highlight-fade-out { transition: background 0.5s ease; background: transparent !important; }
`;

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
  const navigate = useNavigate();
  const [bookings,       setBookings]       = useState([]);
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
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);
  const [isHighlightFading,    setIsHighlightFading]    = useState(false);
  const [autoAssignEnabled,    setAutoAssignEnabled]    = useState(true);
  const [assignmentModeLoading, setAssignmentModeLoading] = useState(true);
  const [assignmentModeSaving,  setAssignmentModeSaving]  = useState(false);

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

  /* ── API helpers ───────────────────────────────────────── */
  const fetchBookings = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const data = await bookingsAPI.getAll();
      setBookings(data);
    } catch { setError('Failed to load bookings'); }
    finally { if (showLoader) setLoading(false); }
  };
  const fetchWorkers = async () => {
    try { const data = await authAPI.getWorkers(); setWorkers(data || []); } catch {}
  };
  const fetchAssignmentMode = async () => {
    try {
      setAssignmentModeLoading(true);
      const data = await bookingsAPI.getAssignmentMode();
      setAutoAssignEnabled(Boolean(data?.autoAssignEnabled));
    } catch {} finally { setAssignmentModeLoading(false); }
  };
  const handleAssignmentModeChange = async (enabled) => {
    try {
      setAssignmentModeSaving(true);
      const data = await bookingsAPI.updateAssignmentMode(enabled);
      setAutoAssignEnabled(Boolean(data?.autoAssignEnabled));
      await fetchBookings({ showLoader: false });
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update assignment mode');
    } finally { setAssignmentModeSaving(false); }
  };

  /* ── Effects ───────────────────────────────────────────── */
  useEffect(() => {
    fetchBookings(); fetchWorkers(); fetchAssignmentMode();
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
  }, []);

  // Background polling — 30 s silent refresh + re-trigger on focus / visibility
  const silentRefresh = useCallback(() => fetchBookings({ showLoader: false }), []);
  usePolling(silentRefresh, 30_000);

  /* ── Worker helpers ────────────────────────────────────── */
  const handleAssignWorker = async (bookingId, workerId) => {
    try {
      const parsed = workerId === '' ? null : Number(workerId);
      if (parsed !== null) {
        const avail = availableWorkersByBooking[bookingId];
        if (avail) {
          const info = avail.find(w => w.workerId === parsed);
          if (info && !info.isAvailable) {
            alert(`Cannot assign: this worker is not available.\n\n${info.note || 'Schedule conflict at this booking time.'}`);
            return;
          }
        }
      }
      await bookingsAPI.assignWorker(bookingId, parsed, false);
      await fetchBookings();
      setAvailableWorkersByBooking(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to assign worker');
    }
  };
  const fetchAvailableWorkersForBooking = async (bookingId) => {
    if (availableWorkersByBooking[bookingId] || loadingAvailableWorkersByBooking[bookingId]) return;
    try {
      setLoadingAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: true }));
      const data = await bookingsAPI.getAvailableWorkers(bookingId);
      setAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: data || [] }));
    } catch {} finally {
      setLoadingAvailableWorkersByBooking(prev => ({ ...prev, [bookingId]: false }));
    }
  };
  const workerLabelById = (workerId) => {
    const w = workers.find(w => w.id === workerId);
    if (!w) return 'Unassigned';
    const label = `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`;
    return w.isActive === false ? `${label} (Inactive)` : label;
  };
  const getWorkerOptionsForBooking = (bookingId) => {
    const avail = availableWorkersByBooking[bookingId];
    if (!avail) return workers.map(w => ({
      workerId: w.id,
      label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`,
      isAvailable: w.isActive !== false,
      note: w.isActive === false ? 'Inactive worker' : null,
    }));
    return avail.map(w => ({
      workerId: w.workerId,
      label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.workerId}`,
      isAvailable: w.isAvailable,
      note: w.note,
    }));
  };

  /* ── Filtering ─────────────────────────────────────────── */
  const periodFilteredBookings = bookings.filter(b => {
    if (periodFilter === 'All') return true;
    const d = new Date(b.scheduledDate);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (periodFilter === 'Today')       return d.toDateString() === now.toDateString();
    if (periodFilter === 'SpecificDay') {
      if (!specificDateFilter) return true;
      const sd = new Date(specificDateFilter);
      return !isNaN(sd.getTime()) && d.toDateString() === sd.toDateString();
    }
    if (periodFilter === 'ThisMonth')   return d >= getMonthStart(now) && d <= getMonthEnd(now);
    if (periodFilter === 'NextWeek') {
      const nws = new Date(getWeekStart(now)); nws.setDate(nws.getDate() + 7);
      return d >= nws && d <= getWeekEnd(nws);
    }
    return d >= getWeekStart(now) && d <= getWeekEnd(now);
  });
  const statusFilteredBookings = filterStatus === 'All'
    ? periodFilteredBookings
    : periodFilteredBookings.filter(b => b.status === filterStatus);
  const filteredBookings = searchQuery.trim()
    ? bookings.filter(b => {
        const q = searchQuery.trim().toLowerCase();
        return (
          String(b.id) === q.replace('#', '') ||
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerEmail?.toLowerCase().includes(q)
        );
      })
    : statusFilteredBookings;
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

  /* ── Loading ───────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading bookings…</p>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{PRISM_CSS}</style>
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
              <p className="uppercase tracking-[0.26em] text-primary text-[0.62rem] font-semibold">Admin Panel</p>
              <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>
            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-2 relative">All Bookings</h1>
            <p className="text-[var(--muted-color)] relative">Manage customer appointments in real time</p>
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
                type="text" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by booking #, name or email…"
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}
                  className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5 transition">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2.5 text-xs text-[var(--muted-color)] pl-12">
                Period & status filters bypassed ·{' '}
                {filteredBookings.length > 0
                  ? `${filteredBookings.length} result${filteredBookings.length !== 1 ? 's' : ''}`
                  : 'No results'}
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
                label="Bookings" colorClass="text-[var(--heading-color)]"
                value={filteredBookings.length} sub={`of ${bookings.length} total`}
              />
              <StatCard label="Revenue" value={formatQAR(periodSummary.revenue)} />
              <StatCard label="Cost"    value={formatQAR(periodSummary.cost)}    colorClass="text-rose-400" />
              <StatCard
                label="Profit" value={formatQAR(periodSummary.profit)}
                colorClass={periodSummary.profit >= 0 ? 'text-green-400' : 'text-rose-400'}
                sub={`${periodSummary.revenue > 0 ? ((periodSummary.profit / periodSummary.revenue) * 100).toFixed(1) : 0}% margin`}
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
                <h3 className="text-sm font-bold text-[var(--heading-color)]">Assignment Mode</h3>
              </div>
              <p className="text-xs text-[var(--muted-color)] mb-4 leading-relaxed">
                Auto assigns a detailer on booking. Manual keeps them unassigned but still checks capacity.
              </p>
              <div className="flex gap-2">
                {[
                  { label: 'Auto',   value: true  },
                  { label: 'Manual', value: false },
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
                {assignmentModeLoading ? 'Loading…' : assignmentModeSaving ? 'Saving…'
                  : `Active: ${autoAssignEnabled ? 'Auto Assign' : 'Manual Assignment'}`}
              </p>
            </div>

            {/* Status filter */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="prism-ray" style={{ left: '62%', width: '11%', animation: 'prism-ray-sweep 17s ease-in-out 10s infinite' }} />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center">
                  <Filter size={14} className="text-primary" />
                </div>
                <h3 className="text-sm font-bold text-[var(--heading-color)]">Filter by Status</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {statuses.map(status => (
                  <FilterPill key={status} active={filterStatus === status} onClick={() => setFilterStatus(status)}>
                    {status} ({status === 'All' ? bookings.length : bookings.filter(b => b.status === status).length})
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
              <h3 className="text-sm font-bold text-[var(--heading-color)]">Period</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {periods.map(p => (
                <FilterPill key={p} active={periodFilter === p} onClick={() => setPeriodFilter(p)}>
                  {p === 'CurrentWeek' ? 'This Week' : p === 'NextWeek' ? 'Next Week' : p === 'ThisMonth' ? 'This Month' : p === 'SpecificDay' ? 'Pick Day' : p}
                </FilterPill>
              ))}
            </div>
            {periodFilter === 'SpecificDay' && (
              <div className="mt-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Choose Date</label>
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
                    <h3 className="text-sm font-bold text-amber-400">Unassigned Bookings ({unassigned.length})</h3>
                    <span className="ml-auto text-[11px] text-[var(--muted-color)] hidden sm:block">Need a worker before scheduled date</span>
                  </div>
                  <div className="space-y-2">
                    {unassigned.map(b => (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border border-amber-500/18 bg-amber-500/5 px-4 py-2.5">
                        <span className="text-xs font-black text-amber-400 font-mono">{b.bookingNumber}</span>
                        <span className="text-sm font-semibold text-[var(--heading-color)]">{b.customerName}</span>
                        <span className="text-xs text-[var(--muted-color)]">
                          {new Date(b.scheduledDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} · {b.timeSlot}
                        </span>
                        <button type="button"
                          className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition"
                          onClick={() => navigate(`/admin/bookings/${b.id}`, { state: { booking: b } })}>
                          Assign →
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
                      {['Booking #', 'Customer', 'Date & Time', 'Amount', 'Profit', 'Worker', ''].map(h => (
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
                              🚫 Cancel req.
                            </span>
                          )}
                          {booking.rescheduleRequested && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-amber-500/14 text-amber-400 border border-amber-500/22 px-2 py-0.5 rounded-full">
                              📅 Reschedule req.
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
                            {new Date(booking.scheduledDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-[var(--muted-color)] mt-0.5 flex items-center gap-1">
                            <Clock size={10} />{formatBookingTimeWindow(booking.timeSlot, booking.estimatedDurationMinutes)}
                          </p>
                        </td>
                        {/* Amount */}
                        <td className="px-5 py-4">
                          <p className="font-black text-primary text-lg">{formatQAR(booking.totalAmount)}</p>
                          <p className="text-[11px] text-[var(--muted-color)]">Cost: {formatQAR(booking.estimatedCost)}</p>
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
                            <option value="">Unassigned</option>
                            {getWorkerOptionsForBooking(booking.id).map(w => (
                              <option key={w.workerId} value={w.workerId}>
                                {w.isAvailable ? w.label : `⚠ ${w.label} (${w.note || 'Unavailable'})`}
                              </option>
                            ))}
                          </select>
                          {loadingAvailableWorkersByBooking[booking.id] && (
                            <p className="text-[10px] text-[var(--muted-color)] mt-1">Checking…</p>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <button onClick={() => navigate(`/admin/bookings/${booking.id}`, { state: { booking } })}
                            className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 hover:border-primary/55 transition whitespace-nowrap">
                            Details →
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
              <h2 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-2">No Bookings Found</h2>
              <p className="text-[var(--muted-color)]">
                {filterStatus === 'All' ? 'No bookings match your current filters.' : `No ${filterStatus.toLowerCase()} bookings.`}
              </p>
            </div>
          )}

          {/* Booking detail lives at /admin/bookings/:id */}
          {null && (
              <div className="fixed inset-0 bg-black/65 backdrop-blur-sm overflow-y-auto z-50">
                <div className="flex min-h-full items-start justify-center p-4 py-8">
                  <div className="glass-card max-w-2xl w-full relative">
                  {/* Left accent bar — colour reflects booking status */}
                  {(() => {
                    const statusBarColors = {
                      Pending: '#FBBF24', Confirmed: '#60A5FA', InProgress: '#A78BFA',
                      Completed: '#34D399', Cancelled: '#F87171',
                    };
                    const c = statusBarColors[selectedBooking.status] || '#c8a96b';
                    return (
                      <div className="absolute top-0 left-0 w-[3px] h-full"
                        style={{ background: `linear-gradient(180deg, ${c} 0%, ${c}66 60%, transparent 100%)` }} />
                    );
                  })()}
                  {/* Prism rays */}
                  <div className="prism-ray" style={{ left: '66%', width: '14%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
                  <div className="prism-ray" style={{ left: '26%', width: '8%',  animation: 'prism-ray-sweep 22s ease-in-out 8s infinite' }} />

                  {/* Modal header */}
                  <div className="px-8 pt-7 pb-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                          <p className="text-[0.58rem] font-bold uppercase tracking-[0.26em] text-[var(--muted-color)]">Booking Details</p>
                          <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
                        </div>
                        <h2 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-1">{selectedBooking.customerName}</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-primary font-mono font-black text-sm tracking-wide">{selectedBooking.bookingNumber}</p>
                          {(() => {
                            const sc = getStatusConfig(selectedBooking.status);
                            const Icon = sc.icon;
                            return (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>
                                <Icon size={9} />{sc.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!editMode && selectedBooking.status !== 'Completed' && selectedBooking.status !== 'Cancelled' && (
                          <button type="button" onClick={() => openEditMode(selectedBooking)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/35 text-primary text-xs font-bold hover:bg-primary/10 transition">
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                        {editMode && (
                          <button type="button" onClick={() => { setEditMode(false); setEditError(''); setEditConfirm(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-[var(--muted-color)] text-xs font-bold hover:bg-white/5 transition">
                            <X size={12} /> Cancel Edit
                          </button>
                        )}
                        <button type="button" onClick={() => setSelectedBooking(null)}
                          className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5 transition">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Spectrum separator */}
                  <div className="mx-8 mb-6"><div className="spectrum-line" /></div>

                  <div className="px-8 pb-8 space-y-5">

                    {/* ── Edit form ────────────────────────── */}
                    {editMode && (
                      <div className="rounded-xl border-2 border-primary/35 bg-primary/5 p-5">
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/28 flex items-center justify-center">
                            <Edit2 size={13} className="text-primary" />
                          </div>
                          <h3 className="text-sm font-bold text-primary">Edit Booking</h3>
                        </div>
                        {editError && (
                          <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 p-3">
                            <AlertCircle size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
                            <p className="text-rose-300 text-sm">{editError}</p>
                          </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Date */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Scheduled Date</label>
                            <input type="date" value={editForm.scheduledDate}
                              min={new Date().toISOString().split('T')[0]}
                              onChange={(e) => handleEditDateChange(e.target.value)}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* Time slot */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">
                              Time Slot {editSlotsLoading && <span className="opacity-60">(loading…)</span>}
                            </label>
                            <select value={editForm.timeSlot}
                              onChange={(e) => setEditForm(p => ({ ...p, timeSlot: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] rounded-xl text-sm bg-[var(--card-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              <option value="">Select time slot</option>
                              {Array.from(new Set([selectedBooking.timeSlot, ...editSlots].filter(Boolean))).map(slot => (
                                <option key={slot} value={slot}>{slot}{editSlots.includes(slot) ? '' : ' (current — may be full)'}</option>
                              ))}
                            </select>
                          </div>
                          {/* Make */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Make</label>
                            <input type="text" value={editForm.vehicleMake} placeholder="e.g. Toyota"
                              onChange={(e) => setEditForm(p => ({ ...p, vehicleMake: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* Model */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Model</label>
                            <input type="text" value={editForm.vehicleModel} placeholder="e.g. Camry"
                              onChange={(e) => setEditForm(p => ({ ...p, vehicleModel: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* Year */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Year</label>
                            <input type="text" value={editForm.vehicleYear} placeholder="e.g. 2022" maxLength={4}
                              onChange={(e) => setEditForm(p => ({ ...p, vehicleYear: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* Type */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Type</label>
                            <select value={editForm.vehicleType}
                              onChange={(e) => setEditForm(p => ({ ...p, vehicleType: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] rounded-xl text-sm bg-[var(--card-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          {/* Address */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Service Address</label>
                            <input type="text" value={editForm.customerAddress} placeholder="Street / Area"
                              onChange={(e) => setEditForm(p => ({ ...p, customerAddress: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* House number */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">House / Building No.</label>
                            <input type="text" value={editForm.houseNumber} placeholder="e.g. Villa 12"
                              onChange={(e) => setEditForm(p => ({ ...p, houseNumber: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          {/* Address type */}
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Address Type</label>
                            <div className="flex gap-2">
                              {['Home', 'Work', 'Other'].map(t => (
                                <button key={t} type="button" onClick={() => setEditForm(p => ({ ...p, addressType: t }))}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${editForm.addressType === t ? 'bg-primary text-white border-primary' : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'}`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Instructions */}
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Special Instructions</label>
                            <textarea value={editForm.specialInstructions} rows={2} placeholder="Notes for the detailer…"
                              onChange={(e) => setEditForm(p => ({ ...p, specialInstructions: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        </div>

                        {/* Package selection */}
                        {allPackages.length > 0 && (
                          <div className="mt-5">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">Package</label>
                            <div className="space-y-2">
                              {allPackages.map(pkg => {
                                const selected = (editForm.packages || []).some(p => p.packageId === pkg.id);
                                return (
                                  <div key={pkg.id} onClick={() => handlePackageToggle(pkg.id)}
                                    className={`rounded-xl border-2 p-3.5 cursor-pointer transition ${selected ? 'border-primary bg-primary/8' : 'border-[var(--border-color)] hover:border-primary/38'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-primary bg-primary' : 'border-[var(--border-color)]'}`}>
                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                      <div className="flex-1">
                                        <span className="font-bold text-[var(--heading-color)] text-sm">{pkg.name}</span>
                                        {pkg.tier && <span className="ml-2 text-[10px] text-[var(--muted-color)] uppercase tracking-wider">({pkg.tier})</span>}
                                        {pkg.estimatedDurationMinutes && <span className="ml-2 text-xs text-[var(--muted-color)]">{pkg.estimatedDurationMinutes}min</span>}
                                      </div>
                                      <span className="text-sm font-black text-primary">{formatQAR(pkg.price)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {(editForm.packages || []).length === 0 && (
                              <p className="text-xs text-amber-400 mt-2">At least one package must be selected.</p>
                            )}
                          </div>
                        )}

                        {/* Slot-blocked warning */}
                        {editPackageSlotWarning && (
                          <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/8 p-4">
                            <p className="text-sm font-bold text-amber-400 mb-1">Slot unavailable after package change</p>
                            <p className="text-xs text-[var(--muted-color)]">{editPackageSlotWarning.message}</p>
                            {editPackageSlotWarning.altSlots?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Available slots:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {editPackageSlotWarning.altSlots.map(slot => (
                                    <button key={slot} type="button"
                                      onClick={() => { setEditForm(p => ({ ...p, timeSlot: slot })); setEditPackageSlotWarning(null); }}
                                      className="px-3 py-1 text-xs font-bold rounded-lg border border-primary text-primary hover:bg-primary/12 transition">
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(!editPackageSlotWarning.altSlots || !editPackageSlotWarning.altSlots.length) && (
                              <p className="text-xs text-amber-400 mt-2">No slots available on this date — please pick a different date.</p>
                            )}
                          </div>
                        )}

                        {/* Confirm step */}
                        {editConfirm ? (
                          <div className="mt-5 rounded-xl border border-primary/28 bg-[var(--card-bg)] p-5">
                            <p className="text-sm font-bold text-[var(--heading-color)] mb-3">Confirm changes to {selectedBooking.bookingNumber}?</p>
                            <ul className="text-xs text-[var(--muted-color)] space-y-1 mb-4">
                              {editForm.scheduledDate && <li>• Date: {editForm.scheduledDate}</li>}
                              {editForm.timeSlot && <li>• Time: {editForm.timeSlot}</li>}
                              {editForm.vehicleMake && <li>• Vehicle: {editForm.vehicleYear} {editForm.vehicleMake} {editForm.vehicleModel}</li>}
                              {editForm.customerAddress && <li>• Address: {editForm.customerAddress}</li>}
                              {editForm.specialInstructions !== undefined && editForm.specialInstructions !== (selectedBooking.specialInstructions || '') && (
                                <li>• Special instructions updated</li>
                              )}
                              {editForm.packages?.length > 0 && (
                                <li>• Packages: {editForm.packages.map(p => {
                                  const pkg = allPackages.find(x => x.id === p.packageId);
                                  return `${pkg?.name || `#${p.packageId}`}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`;
                                }).join(', ')}</li>
                              )}
                            </ul>
                            <div className="flex gap-3">
                              <button type="button" onClick={handleSaveEdit} disabled={editSaving}
                                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-60">
                                <Check size={14} />{editSaving ? 'Saving…' : 'Yes, save changes'}
                              </button>
                              <button type="button" onClick={() => setEditConfirm(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                                Go back
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 mt-5">
                            <button type="button" onClick={() => setEditConfirm(true)}
                              disabled={editForm.packages !== undefined && editForm.packages.length === 0}
                              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                              <Check size={14} /> Review & Save
                            </button>
                            <button type="button" onClick={() => { setEditMode(false); setEditError(''); setEditConfirm(false); }}
                              className="px-5 py-2.5 rounded-xl font-bold text-sm border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Customer & Vehicle ───────────────── */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SectionCard title="Customer" icon={User} accent="#c8a96b">
                        <div className="space-y-3.5">
                          <InfoRow icon={User}  label="Name"  value={selectedBooking.customerName}  />
                          <InfoRow icon={Mail}  label="Email" value={selectedBooking.customerEmail} />
                          <InfoRow icon={Phone} label="Phone" value={selectedBooking.customerPhone} />
                        </div>
                      </SectionCard>
                      <SectionCard title="Vehicle" icon={Car} accent="#0ea5a0">
                        <InfoRow icon={Car} label="Vehicle"
                          value={`${selectedBooking.vehicleYear || ''} ${selectedBooking.vehicleMake || ''} ${selectedBooking.vehicleModel || ''}`.trim() || 'Not specified'}
                        />
                        {selectedBooking.vehicleType && (
                          <div className="mt-3.5">
                            <InfoRow icon={Car} label="Type" value={selectedBooking.vehicleType} />
                          </div>
                        )}
                        {selectedBooking.customerAddress && (
                          <div className="mt-3.5">
                            <InfoRow icon={Car} label={`${selectedBooking.addressType || 'Service'} Address`} value={selectedBooking.customerAddress} />
                          </div>
                        )}
                      </SectionCard>
                    </div>

                    {/* ── Schedule ─────────────────────────── */}
                    <SectionCard title="Schedule & Duration" icon={Calendar} accent="#c8a96b">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <InfoRow icon={Calendar} label="Scheduled Date"
                          value={new Date(selectedBooking.scheduledDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}
                        />
                        <InfoRow icon={Clock} label="Time Window"
                          value={formatBookingTimeWindow(selectedBooking.timeSlot, selectedBooking.estimatedDurationMinutes)}
                        />
                        <InfoRow icon={Clock} label="Est. Duration" value={`${selectedBooking.estimatedDurationMinutes} minutes`} />
                        {selectedBooking.status === 'Completed' && (
                          <InfoRow icon={CheckCircle} label="Actual Duration" value={formatDuration(selectedBooking.workDurationSeconds) || 'N/A'} />
                        )}
                      </div>
                    </SectionCard>

                    {/* ── Booking controls ─────────────────── */}
                    <SectionCard title="Booking Controls" icon={Wrench} accent="#0ea5a0">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Status</p>
                          <select value={selectedBooking.status}
                            onChange={(e) => handleStatusUpdate(selectedBooking.id, e.target.value)}
                            className={`${statusConfig[selectedBooking.status]} w-full px-3 py-2.5 rounded-xl text-sm font-bold border-0 cursor-pointer focus:outline-none`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="InProgress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Payment</p>
                          <select value={selectedBooking.paymentStatus}
                            onChange={(e) => handlePaymentStatusUpdate(selectedBooking.id, e.target.value)}
                            className={`${paymentStatusConfig[selectedBooking.paymentStatus]} w-full px-3 py-2.5 rounded-xl text-sm font-bold border-0 cursor-pointer focus:outline-none`}
                          >
                            <option value="PreAuthorized">Pre-Auth</option>
                            <option value="Paid">Paid</option>
                            <option value="Failed">Failed</option>
                            <option value="Refunded">Refunded</option>
                          </select>
                        </div>
                      </div>

                      {selectedBooking.status !== 'Completed' && selectedBooking.status !== 'Cancelled' ? (
                        <div className="mt-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Assigned Worker</p>
                          <select
                            value={selectedBooking.assignedWorkerId ?? ''}
                            onChange={(e) => handleAssignWorker(selectedBooking.id, e.target.value)}
                            onFocus={() => fetchAvailableWorkersForBooking(selectedBooking.id)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">— Unassigned —</option>
                            {getWorkerOptionsForBooking(selectedBooking.id).map(w => (
                              <option key={w.workerId} value={w.workerId}>
                                {w.isAvailable ? w.label : `⚠ ${w.label} (${w.note || 'Unavailable'})`}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-[var(--muted-color)] mt-1.5">
                            {loadingAvailableWorkersByBooking[selectedBooking.id]
                              ? 'Checking worker availability…'
                              : !availableWorkersByBooking[selectedBooking.id]
                                ? 'Open dropdown to check live availability.'
                                : null}
                          </p>
                        </div>
                      ) : (
                        selectedBooking.assignedWorkerId && (
                          <div className="mt-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Assigned Worker</p>
                            <p className="text-sm font-bold text-[var(--heading-color)]">{workerLabelById(selectedBooking.assignedWorkerId)}</p>
                          </div>
                        )
                      )}
                    </SectionCard>

                    {/* ── Completion card ──────────────────── */}
                    {selectedBooking.status === 'Completed' && (
                      <div className="rounded-xl border border-green-500/28 bg-green-500/5 p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle size={14} className="text-green-400" />
                          <h3 className="text-sm font-bold text-green-400">Actual Completion Time</h3>
                        </div>
                        <p className="text-2xl font-black text-green-400">{formatDuration(selectedBooking.workDurationSeconds) || 'Not available'}</p>
                        {selectedBooking.workStartedAt && selectedBooking.workCompletedAt && (
                          <p className="text-xs text-green-300/65 mt-2">
                            Started: {new Date(selectedBooking.workStartedAt).toLocaleString()} · Finished: {new Date(selectedBooking.workCompletedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Package & add-ons ────────────────── */}
                    <SectionCard title="Package & Add-Ons" icon={Package} accent="#c8a96b">
                      {/* Base */}
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Base Package</p>
                        {breakdown.baseItems.length === 0 ? (
                          <p className="text-sm text-[var(--muted-color)]">No base package found.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {breakdown.baseItems.map((item, i) => (
                              <div key={`base-${i}`} className="flex items-center justify-between text-sm">
                                <span className="text-[var(--heading-color)] font-semibold">• {item.packageName} <span className="text-[var(--muted-color)] font-normal">×{item.quantity || 1}</span></span>
                                <span className="text-primary font-bold">{formatQAR(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Add-ons */}
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Add-Ons</p>
                        {breakdown.addonItems.length === 0 ? (
                          <p className="text-sm text-[var(--muted-color)]">No add-ons selected.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {breakdown.addonItems.map((item, i) => (
                              <div key={`addon-${i}`} className="flex items-center justify-between text-sm">
                                <span className="text-[var(--heading-color)] font-semibold">• {item.packageName} <span className="text-[var(--muted-color)] font-normal">×{item.quantity || 1}</span></span>
                                <span className="text-primary font-bold">{formatQAR(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Services chosen */}
                      {breakdown.selectedServices.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Services Chosen</p>
                          <p className="text-sm text-[var(--heading-color)]">{breakdown.selectedServices.join(', ')}</p>
                        </div>
                      )}
                      {/* Totals */}
                      <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--muted-color)]">Before Add-Ons</span>
                          <span className="font-bold text-[var(--heading-color)]">{formatQAR(breakdown.baseTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--muted-color)]">Add-Ons</span>
                          <span className="font-bold text-[var(--heading-color)]">+ {formatQAR(breakdown.addonsTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3 mt-1">
                          <span className="text-sm font-bold text-emerald-400">Total</span>
                          <span className="text-2xl font-black text-primary">{formatQAR(breakdown.finalTotal)}</span>
                        </div>
                      </div>
                    </SectionCard>

                    {/* ── Checklist ────────────────────────── */}
                    {(selectedBooking.checklistItems || []).length > 0 && (
                      <SectionCard title="Detailer Checklist" icon={CheckCircle} accent="#0ea5a0">
                        <div className="space-y-2">
                          {selectedBooking.checklistItems
                            .slice().sort((a, b) => a.displayOrder - b.displayOrder)
                            .map(item => (
                              <div key={item.id}
                                className={`flex items-start gap-3 rounded-xl border p-3.5 ${item.isCompleted ? 'border-green-500/22 bg-green-500/5' : 'border-[var(--border-color)]'}`}
                              >
                                <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.isCompleted ? 'bg-green-500 border-green-500' : 'border-[var(--border-color)]'}`}>
                                  {item.isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-semibold ${item.isCompleted ? 'text-green-400 line-through opacity-65' : 'text-[var(--heading-color)]'}`}>
                                    {item.label}
                                  </p>
                                  {item.completedAt && (
                                    <p className="text-[11px] text-green-400/65 mt-0.5">Completed: {new Date(item.completedAt).toLocaleString()}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </SectionCard>
                    )}

                    {/* ── Finance strip ────────────────────── */}
                    <div className="glass-card relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
                      <div className="prism-ray" style={{ left: '50%', width: '18%', animation: 'prism-ray-sweep 12s ease-in-out 1s infinite' }} />
                      <div className="grid grid-cols-3 divide-x divide-[var(--border-color)]">
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Revenue</p>
                          <p className="text-2xl font-black text-primary">{formatQAR(selectedBooking.totalAmount)}</p>
                        </div>
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Cost</p>
                          <p className="text-2xl font-black text-rose-400">{formatQAR(selectedBooking.estimatedCost)}</p>
                        </div>
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Profit</p>
                          <p className={`text-2xl font-black ${selectedBooking.estimatedProfit >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                            {formatQAR(selectedBooking.estimatedProfit)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ── Cancel & Refund ──────────────────── */}
                    {selectedBooking.status !== 'Completed' && selectedBooking.status !== 'Cancelled' && (
                      <div className="rounded-xl border border-rose-500/28 overflow-hidden">
                        <button type="button"
                          onClick={() => showCancelPanel ? setShowCancelPanel(false) : openCancelPanel(selectedBooking.id)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-rose-500/5 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-rose-500/14 border border-rose-500/22 flex items-center justify-center">
                              <X size={13} className="text-rose-400" />
                            </div>
                            <span className="text-sm font-bold text-rose-400">Cancel Booking &amp; Issue Refund</span>
                          </div>
                          <span className={`text-rose-400 text-xs transition-transform ${showCancelPanel ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showCancelPanel && (
                          <div className="border-t border-rose-500/18 px-5 pb-6 pt-5 space-y-4">
                            {cancelRefundResult ? (
                              <div className="rounded-xl border border-green-500/28 bg-green-500/8 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle size={13} className="text-green-400" />
                                  <p className="text-sm font-bold text-green-400">Done</p>
                                </div>
                                <p className="text-sm text-[var(--heading-color)]">{cancelRefundResult.message}</p>
                                {cancelRefundResult.stripeRefundId && (
                                  <p className="text-xs text-[var(--muted-color)]">Stripe Refund ID: {cancelRefundResult.stripeRefundId}</p>
                                )}
                                <p className="text-xs text-[var(--muted-color)]">
                                  Status: {cancelRefundResult.bookingStatus} · Payment: {cancelRefundResult.paymentStatus}
                                </p>
                              </div>
                            ) : (
                              <>
                                {/* Reason toggle */}
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Cancellation Reason</p>
                                  <div className="flex gap-2">
                                    {[
                                      { key: 'customer', label: 'Customer Request' },
                                      { key: 'ourfault', label: 'Our Fault / No-show' },
                                    ].map(({ key, label }) => (
                                      <button key={key} type="button" onClick={() => handleCancelReasonChange(key)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                                          cancelReason === key
                                            ? key === 'customer'
                                              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                              : 'bg-blue-500/20 border-blue-500 text-blue-400'
                                            : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {cancelReason === 'ourfault' && (
                                    <p className="text-xs text-blue-400 mt-1.5">Full refund — no cancellation fee applied.</p>
                                  )}
                                </div>

                                {feeInfoLoading && <p className="text-sm text-[var(--muted-color)]">Loading fee info…</p>}

                                {!feeInfoLoading && feeInfo && (
                                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-2.5 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-[var(--muted-color)]">Booking total</span>
                                      <span className="font-bold text-[var(--heading-color)]">{formatQAR(feeInfo.bookingTotal)}</span>
                                    </div>
                                    {feeInfo.feeEnabled && !feeInfo.withinFreeWindow && feeInfo.calculatedFee > 0 ? (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-[var(--muted-color)]">
                                            Fee ({feeInfo.feeType === 'Percent' ? `${feeInfo.feeAmount}%` : formatQAR(feeInfo.feeAmount)}, {Math.round(feeInfo.hoursUntilAppointment)}h until appt)
                                          </span>
                                          <span className="font-bold text-rose-400">− {formatQAR(feeInfo.calculatedFee)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-[var(--border-color)] pt-2.5">
                                          <span className="font-bold text-[var(--heading-color)]">Auto refund</span>
                                          <span className="font-black text-green-400">{formatQAR(Math.max(0, feeInfo.bookingTotal - feeInfo.calculatedFee))}</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex justify-between border-t border-[var(--border-color)] pt-2.5">
                                        <span className="text-xs text-green-400">
                                          {feeInfo.withinFreeWindow
                                            ? `Free window (${Math.round(feeInfo.hoursUntilAppointment)}h until, free: ${feeInfo.freeWindowHours}h)`
                                            : 'No cancellation fee configured'}
                                        </span>
                                        <span className="font-black text-green-400">Full refund</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!feeInfoLoading && !selectedBooking.stripePaymentIntentId?.startsWith('pi_') && (
                                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/22 bg-amber-500/8 px-4 py-3">
                                    <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-400">No Stripe payment on file — booking will be cancelled but no Stripe refund will be processed automatically.</p>
                                  </div>
                                )}

                                {!feeInfoLoading && selectedBooking.paymentStatus === 'Paid' && selectedBooking.stripePaymentIntentId?.startsWith('pi_') && (
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">
                                      Override Refund Amount (QAR 0 – {Number(feeInfo?.bookingTotal ?? selectedBooking.totalAmount).toFixed(2)})
                                    </label>
                                    <input type="number" min="0" step="0.01"
                                      max={feeInfo?.bookingTotal ?? selectedBooking.totalAmount}
                                      value={refundOverride}
                                      onChange={(e) => setRefundOverride(e.target.value)}
                                      className="w-full px-3 py-2.5 rounded-xl text-sm border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                  </div>
                                )}

                                {cancelRefundError && (
                                  <p className="text-sm text-rose-400 font-semibold">{cancelRefundError}</p>
                                )}

                                <div className="flex gap-3 pt-1">
                                  <div className="flex-1 cta-prism-glow rounded-xl">
                                    <button type="button"
                                      onClick={() => handleAdminCancelRefund(selectedBooking.id)}
                                      disabled={cancelRefundLoading || feeInfoLoading}
                                      className="w-full py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-60"
                                    >
                                      {cancelRefundLoading
                                        ? 'Processing…'
                                        : `Confirm Cancel${selectedBooking.stripePaymentIntentId?.startsWith('pi_') ? ' & Refund' : ''}`}
                                    </button>
                                  </div>
                                  <button type="button" onClick={() => setShowCancelPanel(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                                    Never mind
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Close */}
                    <button onClick={() => setSelectedBooking(null)}
                      className="w-full border border-[var(--border-color)] rounded-xl py-3 text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                      Close
                    </button>

                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default AdminBookings;