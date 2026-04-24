import React, { useEffect, useMemo, useState, useRef } from 'react';
import { bookingsAPI } from '../../api/bookings';
import { toDateKey, parseDateKey } from '../../utils/dateUtils';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   PURE DISPLAY HELPERS — all identical to original
══════════════════════════════════════════════════════════════ */
function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function fmtTime(t) { return t || ''; }
function statusColor(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':    return { bg: 'bg-blue-500',   text: 'text-white', border: 'border-blue-600'   };
    case 'confirmed':  return { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' };
    case 'inprogress': return { bg: 'bg-amber-400',  text: 'text-white', border: 'border-amber-500'  };
    case 'completed':  return { bg: 'bg-green-500',  text: 'text-white', border: 'border-green-600'  };
    default:           return { bg: 'bg-gray-400',   text: 'text-white', border: 'border-gray-500'   };
  }
}
const normalizeStatus = (raw) => {
  if (typeof raw === 'string') {
    const k = raw.toLowerCase();
    if (k === 'available' || k === 'medium' || k === 'full') return k;
  }
  if (typeof raw === 'number') return ['available', 'medium', 'full'][raw] || 'full';
  return 'full';
};

/* Day-cell semantic colors — keeping Tailwind classes for contrast clarity */
const DAY_CELL_CLS = {
  available: 'bg-green-100 border-green-200 text-green-900 hover:bg-green-200',
  medium:    'bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200',
  full:      'bg-red-100  border-red-200   text-red-900   cursor-not-allowed',
};

/* ══════════════════════════════════════════════════════════════
   PRISM CSS
══════════════════════════════════════════════════════════════ */
const PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; } 90% { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg); opacity: 0.18; }
  33%      { transform: translate(12px,-14px) rotate(120deg); opacity: 0.30; }
  66%      { transform: translate(-7px,8px) rotate(240deg); opacity: 0.22; }
}
@keyframes card-enter {
  from { transform: translateY(14px) scale(0.988); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(90px); mix-blend-mode: screen; will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none; transform: skewX(-18deg);
  background: linear-gradient(90deg, transparent 0%, rgba(255,55,55,.030) 15%,
    rgba(255,200,0,.042) 30%, rgba(0,255,145,.034) 50%, rgba(0,145,255,.034) 70%,
    rgba(195,0,255,.026) 85%, transparent 100%);
}
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,0,100,.80) 12%,
    rgba(255,165,0,.85) 24%, rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%; animation: holo-sweep 5s linear infinite; opacity: 0.40;
}
.card-stagger { animation: card-enter 0.52s cubic-bezier(0.22,1,0.36,1) both; }
`;

function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 480, height: 480, top: '-240px', left: '-240px' }} />;
}

/* ══════════════════════════════════════════════════════════════
   PRISM CARD
   Decorations live in their own overflow-hidden layer so that
   children (e.g. BookingBlock tooltips) can escape the card.
══════════════════════════════════════════════════════════════ */
function PrismCard({ children, accentColor = '#c8a96b', secondaryColor = '#0ea5a0', rayDelay = '3s', style, className = '' }) {
  return (
    <div className={`glass-card relative card-stagger ${className}`} style={style}>
      {/* Decoration layer — self-contained overflow-hidden */}
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor} 38%, ${secondaryColor} 62%, transparent)` }} />
        <div className="absolute top-0 left-0 w-[3px] h-full"
          style={{ background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}44 60%, transparent 100%)` }} />
        <div className="prism-ray"
          style={{ left: '65%', width: '13%', animation: `prism-ray-sweep 20s ease-in-out ${rayDelay} infinite` }} />
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOOKING BLOCK — identical positioning math, refined tooltip
══════════════════════════════════════════════════════════════ */
function BookingBlock({ booking, dayStartMins, totalMins }) {
  const [tip, setTip] = useState(false);
  const startMins = timeToMins(booking.startTime);
  const leftPct   = ((startMins - dayStartMins) / totalMins) * 100;
  const widthPct  = Math.max((booking.estimatedDurationMinutes / totalMins) * 100, 1.5);
  const { bg, text, border } = statusColor(booking.status);
  const endMins = startMins + booking.estimatedDurationMinutes;
  const endStr  = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

  return (
    <div
      className={`absolute top-1 bottom-1 ${bg} ${border} border rounded-md cursor-pointer overflow-hidden transition-transform hover:scale-y-110 hover:z-20`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      <div className={`${text} px-1.5 h-full flex flex-col justify-center`}>
        {widthPct > 8  && <span className="text-[10px] font-bold leading-tight truncate">{booking.startTime}–{endStr}</span>}
        {widthPct > 14 && <span className="text-[9px] leading-tight truncate opacity-90">{booking.customerName}</span>}
      </div>

      {tip && (
        <div className="absolute z-30 left-0 top-full mt-1.5 min-w-[190px] max-w-[270px] pointer-events-none"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.30)',
            padding: '12px',
          }}>
          {/* Mini spectrum divider */}
          <div style={{
            height: '1.5px', marginBottom: '10px', borderRadius: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.80) 40%, rgba(14,165,160,0.80) 60%, transparent)',
          }} />
          <p className="font-bold text-[var(--heading-color)] text-[11px] mb-1">{booking.bookingNumber}</p>
          <p className="text-[var(--text-color)] text-[11px]">
            {booking.startTime} – {endStr}
            <span className="text-[var(--muted-color)]"> ({booking.estimatedDurationMinutes} min)</span>
          </p>
          <p className="text-[var(--text-color)] text-[11px] mt-1">{booking.customerName}</p>
          <p className="text-[var(--muted-color)] text-[10px]">{booking.vehicleType}</p>
          {booking.packagesSummary && (
            <p className="text-[var(--muted-color)] text-[10px] mt-0.5 leading-snug">{booking.packagesSummary}</p>
          )}
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold ${bg} ${text}`}>
            {booking.status}
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WORKER ROW — identical math, gold shift band, refined day-off
══════════════════════════════════════════════════════════════ */
function WorkerRow({ worker, dayStartMins, dayEndMins }) {
  const totalMins      = dayEndMins - dayStartMins;
  const shiftStartMins = timeToMins(worker.shiftStart);
  const shiftEndMins   = timeToMins(worker.shiftEnd);
  const shiftLeftPct   = ((Math.max(shiftStartMins, dayStartMins) - dayStartMins) / totalMins) * 100;
  const shiftWidthPct  = ((Math.min(shiftEndMins, dayEndMins) - Math.max(shiftStartMins, dayStartMins)) / totalMins) * 100;

  if (!worker.worksOnDay) {
    return (
      <div className="flex items-center gap-3 h-10">
        <div className="w-28 shrink-0 text-right pr-2">
          <p className="text-[11px] font-semibold text-[var(--muted-color)] truncate">{worker.firstName} {worker.lastName}</p>
        </div>
        <div className="flex-1 h-8 rounded-lg flex items-center px-3"
          style={{
            border: '1px dashed var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(128,128,128,0.05) 4px, rgba(128,128,128,0.05) 8px)',
          }}>
          <span className="text-[10px] text-[var(--muted-color)] italic font-medium">Day off</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-3 min-h-[2.75rem]">
      {/* Worker label */}
      <div className="w-28 shrink-0 flex items-center justify-end pr-2">
        <div className="text-right">
          <p className="text-xs font-bold text-[var(--heading-color)] leading-tight">{worker.firstName}</p>
          <p className="text-[10px] text-[var(--muted-color)]">{fmtTime(worker.shiftStart)}–{fmtTime(worker.shiftEnd)}</p>
        </div>
      </div>

      {/* Timeline track */}
      <div className="flex-1 relative rounded-lg overflow-visible"
        style={{ minHeight: '2.75rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        {/* Shift band — gold tint */}
        {shiftWidthPct > 0 && (
          <div className="absolute top-0 bottom-0 rounded-lg"
            style={{
              left: `${shiftLeftPct}%`, width: `${shiftWidthPct}%`,
              background: 'rgba(200,169,107,0.08)',
              borderLeft:  '1.5px solid rgba(200,169,107,0.22)',
              borderRight: '1.5px solid rgba(200,169,107,0.22)',
            }}
          />
        )}
        {/* Booking blocks */}
        {worker.bookings.map(b => (
          <BookingBlock key={b.bookingId} booking={b} dayStartMins={dayStartMins} totalMins={totalMins} />
        ))}
        {worker.bookings.length === 0 && (
          <div className="absolute inset-0 flex items-center px-3">
            <span className="text-[10px] text-[var(--muted-color)] italic">No bookings</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOUR GRID — identical logic, slightly bolder labels
══════════════════════════════════════════════════════════════ */
function HourGrid({ dayStartMins, dayEndMins }) {
  const totalMins = dayEndMins - dayStartMins;
  const hours = [];
  for (let m = dayStartMins; m <= dayEndMins; m += 60) {
    const h = Math.floor(m / 60);
    hours.push({ label: `${String(h).padStart(2, '0')}:00`, pct: ((m - dayStartMins) / totalMins) * 100 });
  }
  return (
    <div className="flex items-end gap-3 mb-1 select-none">
      <div className="w-28 shrink-0" />
      <div className="flex-1 relative h-4">
        {hours.map(({ label, pct }) => (
          <span key={label} className="absolute text-[9px] font-semibold text-[var(--muted-color)] -translate-x-1/2"
            style={{ left: `${pct}%` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WORKER SCHEDULE — MAIN
══════════════════════════════════════════════════════════════ */
function WorkerSchedule() {
  /* ── State & logic — all identical to original ─────────────── */
  const [monthDate,       setMonthDate]       = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [days,            setDays]            = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [constraints,     setConstraints]     = useState(null);
  const [timeline,        setTimeline]        = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    bookingsAPI.getConstraints().then(setConstraints).catch(() => setConstraints(null));
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const from = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
        const to   = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
        const data = await bookingsAPI.getWorkersSchedule(from, to);
        setDays(data || []);
        if ((data || []).length > 0) {
          const todayKey = toDateKey(new Date());
          const hasToday = (data || []).some(d => String(d.date).split('T')[0] === todayKey);
          setSelectedDateKey(prev => prev || (hasToday ? todayKey : String(data[0].date).split('T')[0]));
        }
      } finally { setLoading(false); }
    };
    fetch();
  }, [monthDate]);

  useEffect(() => {
    if (!selectedDateKey) return;
    const fetch = async () => {
      setTimelineLoading(true);
      try {
        const data = await bookingsAPI.getWorkersDayTimeline(selectedDateKey);
        setTimeline(data || []);
      } catch { setTimeline([]); }
      finally  { setTimelineLoading(false); }
    };
    fetch();
  }, [selectedDateKey]);

  const daysByKey = useMemo(() => {
    const map = {};
    for (const day of days) map[String(day.date).split('T')[0]] = day;
    return map;
  }, [days]);

  const selectedDay = selectedDateKey ? daysByKey[selectedDateKey] : null;

  const calendarCells = useMemo(() => {
    const year  = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const count = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthDate]);

  const dayStartMins = timeToMins(constraints?.businessHoursStart || '09:00');
  const dayEndMins   = timeToMins(constraints?.businessHoursEnd   || '18:00');

  const selectedDateLabel = selectedDateKey
    ? new Date(selectedDateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const scheduledCount = timeline.filter(w => w.worksOnDay).length;
  const bookingCount   = timeline.reduce((s, w) => s + w.bookings.length, 0);
  const todayKey       = toDateKey(new Date());

  /* Utilization color — pure display helper */
  const utilColor = selectedDay
    ? selectedDay.utilizationPercent >= 80 ? '#ef4444'
    : selectedDay.utilizationPercent >= 50 ? '#f59e0b'
    : '#22c55e'
    : '#22c55e';

  const statusLegend = [
    { label: 'Pending',     color: 'bg-blue-500'   },
    { label: 'Confirmed',   color: 'bg-indigo-500'  },
    { label: 'In Progress', color: 'bg-amber-400'   },
    { label: 'Completed',   color: 'bg-green-500'   },
  ];

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 7% 6%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 93% 92%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        {/* Background orb */}
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Page header ──────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
              <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">Admin Panel</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                <CalendarDays size={16} style={{ color: '#c8a96b' }} />
              </div>
              <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Detailer Schedule</h1>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">
              Click a day to view the timeline · <span className="text-green-600 font-semibold">green</span> = good · <span className="text-amber-500 font-semibold">yellow</span> = medium · <span className="text-red-500 font-semibold">red</span> = full
            </p>
          </div>

          {/* ── Two-column layout ─────────────────────────── */}
          <div className="grid gap-6 xl:grid-cols-[340px,1fr]">

            {/* ════════════════════════════════
                CALENDAR PANEL
                ════════════════════════════════ */}
            <PrismCard accentColor="#c8a96b" secondaryColor="#0ea5a0" rayDelay="2s">
              <div className="p-5">

                {/* Month nav */}
                <div className="flex items-center justify-between mb-5">
                  <button type="button"
                    onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--heading-color)] hover:bg-white/5 transition">
                    <ChevronLeft size={14} />
                  </button>
                  <div className="text-center">
                    <h2 className="premium-heading text-base font-bold text-[var(--heading-color)]">
                      {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    {loading && (
                      <p className="text-[10px] text-[var(--muted-color)] mt-0.5 animate-pulse">Loading…</p>
                    )}
                  </div>
                  <button type="button"
                    onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--heading-color)] hover:bg-white/5 transition">
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(n => (
                    <div key={n} className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-color)] py-1">{n}</div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((date, idx) => {
                    if (!date) return <div key={`b-${idx}`} className="h-10" />;
                    const key      = toDateKey(date);
                    const day      = daysByKey[key];
                    const status   = normalizeStatus(day?.status);
                    const selected = key === selectedDateKey;
                    const isToday  = key === todayKey;
                    return (
                      <button key={key} type="button"
                        onClick={() => setSelectedDateKey(key)}
                        title={day ? `Available: ${day.availableStarts}/${day.totalStartsCapacity}` : 'No data'}
                        className={`relative h-10 rounded-lg border text-xs font-bold transition
                          ${DAY_CELL_CLS[status]}
                          ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}
                        `}>
                        {date.getDate()}
                        {isToday && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Spectrum divider */}
                <div className="mt-5 mb-3"><div className="spectrum-line" /></div>

                {/* Capacity legend */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[
                    { label: 'Good capacity', cls: 'bg-green-100 border-green-200 text-green-800' },
                    { label: 'Medium load',   cls: 'bg-amber-100 border-amber-200 text-amber-800' },
                    { label: 'Almost full',   cls: 'bg-red-100   border-red-200   text-red-800'   },
                  ].map(({ label, cls }) => (
                    <span key={label} className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>{label}</span>
                  ))}
                </div>

                {/* Selected day stats */}
                {selectedDay && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(200,169,107,0.08)', border: '1px solid rgba(200,169,107,0.24)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Available</p>
                      <p className="text-2xl font-black" style={{ color: '#c8a96b' }}>{selectedDay.availableStarts}</p>
                      <p className="text-[9px] text-[var(--muted-color)] mt-0.5">of {selectedDay.totalStartsCapacity} slots</p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: `${utilColor}10`, border: `1px solid ${utilColor}30` }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Utilization</p>
                      <p className="text-2xl font-black" style={{ color: utilColor }}>{selectedDay.utilizationPercent}%</p>
                      <p className="text-[9px] text-[var(--muted-color)] mt-0.5">capacity used</p>
                    </div>
                  </div>
                )}
              </div>
            </PrismCard>

            {/* ════════════════════════════════
                TIMELINE PANEL
                overflow: visible so BookingBlock
                tooltips can escape the card boundary
                ════════════════════════════════ */}
            <PrismCard
              accentColor="#0ea5a0" secondaryColor="#c8a96b" rayDelay="7s"
              style={{ animationDelay: '0.08s', overflow: 'visible' }}
            >
              <div className="p-5">

                {/* Timeline header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={12} style={{ color: '#0ea5a0' }} />
                      <p className="text-[0.58rem] font-bold uppercase tracking-[0.22em]" style={{ color: '#0ea5a0' }}>Timeline</p>
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {selectedDateLabel || 'Select a day'}
                    </h2>
                    {!timelineLoading && timeline.length > 0 && (
                      <p className="text-xs text-[var(--muted-color)] mt-0.5">
                        {scheduledCount} detailer{scheduledCount !== 1 ? 's' : ''} scheduled
                        · {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Status legend */}
                  <div className="flex flex-wrap gap-3">
                    {statusLegend.map(({ label, color }) => (
                      <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--muted-color)]">
                        <span className={`w-2.5 h-2.5 rounded-sm ${color} flex-shrink-0`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4"><div className="spectrum-line" /></div>

                {/* ── States ── */}
                {timelineLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <p className="text-xs text-[var(--muted-color)]">Loading timeline…</p>
                  </div>
                )}

                {!timelineLoading && !selectedDateKey && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(14,165,160,0.10)', border: '1px solid rgba(14,165,160,0.22)' }}>
                      <CalendarDays size={24} style={{ color: '#0ea5a0' }} />
                    </div>
                    <p className="text-sm text-[var(--muted-color)] text-center max-w-xs">Click a day on the calendar to view the detailed schedule.</p>
                  </div>
                )}

                {!timelineLoading && selectedDateKey && timeline.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(14,165,160,0.10)', border: '1px solid rgba(14,165,160,0.22)' }}>
                      <Users size={24} style={{ color: '#0ea5a0' }} />
                    </div>
                    <p className="text-sm text-[var(--muted-color)]">No workers found for this day.</p>
                  </div>
                )}

                {!timelineLoading && timeline.length > 0 && (
                  /* overflowY: visible keeps tooltips unclipped; overflowX: auto enables scroll */
                  <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <div className="space-y-1.5" style={{ minWidth: '480px' }}>
                      <HourGrid dayStartMins={dayStartMins} dayEndMins={dayEndMins} />
                      <div className="flex gap-3 mb-1">
                        <div className="w-28 shrink-0" />
                        <div className="flex-1 border-t border-dashed border-[var(--border-color)]" />
                      </div>
                      {timeline.map(worker => (
                        <WorkerRow
                          key={worker.workerId}
                          worker={worker}
                          dayStartMins={dayStartMins}
                          dayEndMins={dayEndMins}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PrismCard>

          </div>
        </div>
      </div>
    </>
  );
}

export default WorkerSchedule;