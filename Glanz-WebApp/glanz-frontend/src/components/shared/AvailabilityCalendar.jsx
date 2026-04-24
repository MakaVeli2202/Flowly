import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bookingsAPI } from '../../api/bookings';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const deriveStatus = ({ freeSlots, totalSlots, utilizationPercent }) => {
  const free  = Number(freeSlots);
  const total = Number(totalSlots);
  const util  = Number(utilizationPercent);
  if (Number.isFinite(free) && free <= 0) return 'full';
  if (Number.isFinite(util) && util >= 70) return 'medium';
  if (Number.isFinite(total) && Number.isFinite(free) && total > 0 && ((total - free) / total) * 100 >= 70) return 'medium';
  return 'available';
};

const normalizeStatus = (raw, metrics) => {
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (['available', 'medium', 'full'].includes(k)) return k;
    if (/^\d+$/.test(k)) return ['available', 'medium', 'full'][Number(k)] || deriveStatus(metrics);
    return deriveStatus(metrics);
  }
  if (typeof raw === 'number') return ['available', 'medium', 'full'][raw] || deriveStatus(metrics);
  return deriveStatus(metrics);
};

const toKey = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function AvailabilityCalendar({ value, onChange, originalDate }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(() => value ? +value.split('-')[0] : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? +value.split('-')[1] - 1 : today.getMonth());
  const [avail,     setAvail]     = useState({});
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = toKey(viewYear, viewMonth, 1);
        const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
        const to   = toKey(viewYear, viewMonth, lastDay);
        const data = await bookingsAPI.getCalendarAvailability(from, to);
        if (cancelled) return;
        const map = {};
        (Array.isArray(data) ? data : []).forEach(day => {
          const raw = day.date ?? day.Date;
          if (!raw) return;
          const k = String(raw).split('T')[0];
          const metrics = {
            freeSlots:          day.freeSlots          ?? day.FreeSlots          ?? 0,
            totalSlots:         day.totalSlots         ?? day.TotalSlots         ?? 0,
            utilizationPercent: day.utilizationPercent ?? day.UtilizationPercent ?? 0,
          };
          map[k] = normalizeStatus(day.status ?? day.Status, metrics);
        });
        setAvail(map);
      } catch { setAvail({}); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [viewYear, viewMonth]);

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDow  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells     = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]"
        style={{ background: 'rgba(255,255,255,0.025)' }}>
        <button type="button" onClick={prev}
          className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
          <ChevronLeft size={14} className="text-[var(--muted-color)]" />
        </button>
        <span className="text-sm font-bold text-[var(--heading-color)]">
          {MONTHS[viewMonth]} {viewYear}
          {loading && <span className="ml-2 text-[10px] text-primary font-normal animate-pulse">updating…</span>}
        </span>
        <button type="button" onClick={next}
          className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
          <ChevronRight size={14} className="text-[var(--muted-color)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ background: 'rgba(255,255,255,0.015)' }}>
        {DAYS.map(d => (
          <div key={d} className="text-[10px] font-bold text-[var(--muted-color)] text-center py-2 tracking-wider">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px p-px" style={{ background: 'var(--border-color)' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-10" style={{ background: 'var(--surface-bg)' }} />;
          const ds     = toKey(viewYear, viewMonth, day);
          const date   = new Date(viewYear, viewMonth, day);
          const past   = date < today;
          const status = avail[ds] || 'available';
          const isFull = status === 'full';
          const isDisabled = past || isFull;
          const isSel  = ds === value;
          const isOrig = ds === originalDate;

          const cellCls = isSel
            ? 'bg-primary text-[var(--ink)] font-bold ring-1 ring-primary/40 ring-inset'
            : isDisabled
              ? 'bg-[var(--surface-bg)] text-[var(--muted-color)] opacity-30 cursor-not-allowed'
              : isOrig
                ? 'bg-amber-500/8 text-amber-300 hover:bg-amber-500/16 cursor-pointer'
                : status === 'medium'
                  ? 'bg-amber-500/6 text-amber-300 hover:bg-amber-500/14 cursor-pointer'
                  : 'bg-[var(--surface-bg)] text-[var(--text-color)] hover:bg-primary/10 hover:text-primary cursor-pointer';

          const dotCls = isSel
            ? 'bg-[var(--ink)]/40'
            : isOrig
              ? 'bg-amber-400'
              : isFull
                ? 'bg-red-500'
                : status === 'medium'
                  ? 'bg-amber-400'
                  : 'bg-green-400';

          return (
            <button key={ds} type="button" disabled={isDisabled}
              onClick={() => !isDisabled && onChange(ds)}
              className={`h-10 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors ${cellCls}`}>
              {day}
              {!past && <span className={`w-1 h-1 rounded-full ${dotCls} opacity-70`} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-t border-[var(--border-color)]"
        style={{ background: 'rgba(255,255,255,0.015)' }}>
        {[
          { dot: 'bg-green-400',  label: 'Open' },
          { dot: 'bg-amber-400',  label: 'Filling up' },
          { dot: 'bg-red-500',    label: 'Full' },
          { dot: 'bg-amber-400 opacity-60', label: 'Current booking' },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] text-[var(--muted-color)]">
            <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}
