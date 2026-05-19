import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

/* ── Prismatic cursor orb ─────────────────────────────────────────────────── */
export function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY, rafId;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const tick = () => {
      curX += (mouseX - curX) * 0.09; curY += (mouseY - curY) * 0.09;
      const hue = (mouseX / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${curX}px,${curY}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.23),rgba(255,160,0,.21),rgba(255,255,0,.18),rgba(0,255,100,.21),rgba(0,160,255,.23),rgba(160,0,255,.21),rgba(255,0,80,.23))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}

/* ── Section heading ─────────────────────────────────────────────────── */
export function SectionHeading({ icon: Icon, children, step }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {step !== undefined && (
        <span
          className="text-[0.58rem] font-bold tracking-[0.2em] flex-shrink-0"
          style={{ color: 'var(--muted-color)', opacity: 0.45 }}
        >
          {String(step).padStart(2, '0')}
        </span>
      )}
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      )}
      <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">{children}</h2>
      <span
        className="flex-1 h-px ml-1 hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.18), transparent)' }}
      />
    </div>
  );
}

/* ── Status banner ─────────────────────────────────────────────────── */
export function StatusBanner({ type, message }) {
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

/* ── Calendar availability colour map ────────────────────────────────────── */
export const DAY_CELL_CLS = {
  available: 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20',
  medium:    'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
  full:      'bg-red-500/10  border-red-500/30   text-red-400   cursor-not-allowed opacity-50',
};

/* ── Availability helpers ───────────────────────────────────────────── */
export const deriveStatusFromCapacity = ({ freeSlots, totalSlots, utilizationPercent }) => {
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

export const normalizeStatusKey = (rawStatus, fallbackMetrics = {}) => {
  // Handle null/undefined
  if (rawStatus === null || rawStatus === undefined) return deriveStatusFromCapacity(fallbackMetrics);
  // Handle number (0=available, 1=medium, 2=full)
  if (typeof rawStatus === 'number') {
    return ['available', 'medium', 'full'][rawStatus] || deriveStatusFromCapacity(fallbackMetrics);
  }
  // Handle string
  if (typeof rawStatus === 'string') {
    const key = rawStatus.trim().toLowerCase();
    // Direct match (already normalized)
    if (['available', 'medium', 'full'].includes(key)) return key;
    // Handle numeric strings ("0", "1", "2")
    if (/^\d+$/.test(key)) {
      return ['available', 'medium', 'full'][Number(key)] || deriveStatusFromCapacity(fallbackMetrics);
    }
    // Handle PascalCase from backend ("Available", "Medium", "Full")
    const mapped = { available: 'available', medium: 'medium', full: 'full' }[key];
    if (mapped) return mapped;
  }
  // Fallback to capacity calculation
  return deriveStatusFromCapacity(fallbackMetrics);
};

/* ── Time / duration helpers ──────────────────────────────────────── */
export function formatDuration(minutes) {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function extractSlotStart(slotValue) {
  if (!slotValue || typeof slotValue !== 'string') return '';
  const t = slotValue.trim();
  if (t.includes('-')) return t.split('-')[0].trim();
  if (/^\d{1,2}$/.test(t)) return `${t.padStart(2, '0')}:00`;
  return t;
}

export function calculateEndTimeFromSlot(slotValue, durationMinutes) {
  const start = extractSlotStart(slotValue);
  const parts = start.split(':');
  if (parts.length !== 2) return '';
  const [h, m] = parts.map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = h * 60 + m + Math.max(0, Number(durationMinutes) || 0);
  const endH  = Math.floor(total / 60) % 24;
  const endM  = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function formatSlotStartHour(slotValue) {
  const start  = extractSlotStart(slotValue);
  const [h, m] = start.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return slotValue;
  const norm   = ((h % 24) + 24) % 24;
  const period = norm >= 12 ? 'PM' : 'AM';
  const twelve = norm % 12 === 0 ? 12 : norm % 12;
  return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatTimeToAmPm(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return timeValue;
  const [h, m] = timeValue.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeValue;
  const norm   = ((h % 24) + 24) % 24;
  const period = norm >= 12 ? 'PM' : 'AM';
  const twelve = norm % 12 === 0 ? 12 : norm % 12;
  return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
}

export function getCalendarCells(calendarMonth) {
  const year     = calendarMonth.getFullYear();
  const month    = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const cells    = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
