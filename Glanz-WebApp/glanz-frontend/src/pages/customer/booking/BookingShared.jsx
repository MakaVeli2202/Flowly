import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

/* ── Prismatic CSS injected once by the page ─────────────────────────────── */
export const PRISM_CSS = `
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
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.28; }
  33%      { transform: translate(18px,-24px) rotate(120deg); opacity: 0.55; }
  66%      { transform: translate(-12px,12px) rotate(240deg); opacity: 0.38; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.5),  0 0 28px rgba(255,165,0,.2), 0 0 55px rgba(0,255,100,.15); }
  25%      { box-shadow: 0 0 0 1.5px rgba(255,210,0,.5),  0 0 28px rgba(0,255,150,.2), 0 0 55px rgba(255,0,100,.15); }
  50%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.5),  0 0 28px rgba(160,0,255,.2), 0 0 55px rgba(255,210,0,.15); }
  75%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.5),  0 0 28px rgba(255,0,100,.2), 0 0 55px rgba(255,210,0,.15); }
}
@keyframes prism-card-glow {
  0%,100% { box-shadow: 0 0 0 1px rgba(255,100,80,.4),  0 0 20px rgba(255,165,0,.16), 0 0 44px rgba(0,255,100,.12); }
  33%      { box-shadow: 0 0 0 1px rgba(0,160,255,.4),   0 0 20px rgba(160,0,255,.16), 0 0 44px rgba(255,0,100,.12); }
  66%      { box-shadow: 0 0 0 1px rgba(0,255,150,.4),   0 0 20px rgba(255,255,0,.16), 0 0 44px rgba(0,100,255,.12); }
}
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(85px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.055) 15%, rgba(255,200,0,.08) 30%,
    rgba(0,255,145,.07) 50%, rgba(0,145,255,.07) 70%, rgba(195,0,255,.05) 85%, transparent 100%);
}
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
.pkg-selected-glow { animation: prism-card-glow 4s ease-in-out infinite; }
.cta-prism-glow  { animation: cta-rainbow-glow 5s ease-in-out infinite; }
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
