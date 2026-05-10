import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { offersAPI } from '../../api/offers';
import {
  Plus, Edit2, Trash2, Ticket, AlertCircle, CheckCircle,
  Users, Gift, X, Star, Tag, RefreshCw, ChevronRight,
  Percent, DollarSign, Zap, Search, Clock, TrendingUp,
  ToggleLeft, ToggleRight, Info, ArrowUpDown, Send, ShieldCheck, ShieldX,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import AppModal from '../../components/shared/AppModal';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';
const toAbsoluteImageUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const apiOrigin = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
};

/* ─── Constants ──────────────────────────────────────────────────────────── */
const DISCOUNT_TYPES = ['Percentage', 'FixedAmount', 'FreeBooking'];

const DISCOUNT_META = {
  Percentage:  { color: '#c8a96b', label: 'Percentage', icon: Percent,     hint: 'e.g. 20 = 20% off'       },
  FixedAmount: { color: '#0ea5a0', label: 'Fixed QAR',  icon: DollarSign,  hint: 'e.g. 50 = 50 QAR off'    },
  FreeBooking: { color: '#22c55e', label: 'Free Booking',icon: Gift,        hint: 'Discount value is ignored' },
};

const fmtDiscount = (type, value) => {
  if (type === 'Percentage')  return `${value}% off`;
  if (type === 'FreeBooking') return 'Free booking';
  return `${value} QAR off`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const isExpired = (endsAt) => endsAt && new Date(endsAt) < new Date();
const isExpiringSoon = (endsAt) => {
  if (!endsAt) return false;
  const diff = new Date(endsAt) - new Date();
  return diff > 0 && diff < 7 * 86400000;
};

/* ─── PRISM CSS ──────────────────────────────────────────────────────────── */
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
@keyframes card-enter {
  from { transform: translateY(12px) scale(0.99); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
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
    transparent 0%, rgba(255,55,55,.028) 15%, rgba(255,200,0,.038) 30%,
    rgba(0,255,145,.030) 50%, rgba(0,145,255,.030) 70%,
    rgba(195,0,255,.022) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.09) 0%, rgba(80,255,160,.065) 30%,
    rgba(40,130,255,.065) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.32s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.75) 12%, rgba(255,165,0,.80) 24%,
    rgba(255,255,0,.80) 36%, rgba(0,255,100,.80) 48%,
    rgba(0,150,255,.80) 60%, rgba(150,0,255,.75) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.38;
}
.card-enter { animation: card-enter 0.45s cubic-bezier(0.22,1,0.36,1) both; }
.fi { width:100%; padding:10px 14px; border-radius:12px; border:1px solid var(--border-color);
  background:var(--surface-bg); color:var(--text-color); font-size:.875rem;
  transition:border-color .2s, box-shadow .2s; outline:none; resize:none; }
.fi:focus { border-color:rgba(200,169,107,.65); box-shadow:0 0 0 3px rgba(200,169,107,.12); }
.fi:disabled { opacity:.38; cursor:not-allowed; }
.fl { display:block; font-size:.68rem; font-weight:700; letter-spacing:.20em;
  text-transform:uppercase; color:var(--muted-color); margin-bottom:6px; }
`;

/* ─── Cursor orb ─────────────────────────────────────────────────────────── */
function CursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my, raf;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*.07; cy += (my-cy)*.07;
      el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${(mx/window.innerWidth)*360}deg,rgba(200,169,107,.08),rgba(14,165,160,.06),rgba(200,169,107,.08))`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 460, height: 460, top: '-230px', left: '-230px' }} />;
}

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function FF({ label, hint, children }) {
  return (
    <div>
      <label className="fl">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-[var(--muted-color)] leading-relaxed">{hint}</p>}
    </div>
  );
}

function Toggle({ name, checked, onChange, label, disabled = false }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}>
      <div className="relative flex-shrink-0">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`w-10 h-[22px] rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-[var(--border-color)]'}`} />
        <div className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`} />
      </div>
      <span className="text-sm font-bold text-[var(--text-color)] select-none">{label}</span>
    </label>
  );
}

function Stat({ value, label, color = '#c8a96b', sub }) {
  return (
    <div className="glass-card p-4 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      <p className="text-2xl font-black mb-0.5" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold text-[var(--heading-color)]">{label}</p>
      {sub && <p className="text-[11px] text-[var(--muted-color)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Shared form save helper ────────────────────────────────────────────── */
async function saveOffer(payload, editing) {
  if (editing) return offersAPI.update(editing.id, payload);
  return offersAPI.create(payload);
}

function SaveRow({ saving, editing, onCancel, label }) {
  return (
    <div className="flex gap-3 pt-4 border-t border-[var(--border-color)]">
      <button type="submit" disabled={saving}
        className="flex items-center gap-2 bg-primary text-[var(--ink)] px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition disabled:opacity-55">
        {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><CheckCircle size={13} /> {editing ? 'Save Changes' : label}</>}
      </button>
      <button type="button" onClick={onCancel}
        className="px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
        Cancel
      </button>
    </div>
  );
}

/* ─── PromoForm — locked to isLoyaltyProgram=false ───────────────────────── */
function PromoForm({ editing, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name:             editing?.name             ?? '',
    code:             editing?.code             ?? '',
    description:      editing?.description      ?? '',
    discountType:     editing?.discountType     ?? 'Percentage',
    discountValue:    String(editing?.discountValue  ?? 10),
    minBookingAmount: String(editing?.minBookingAmount ?? 0),
    maxUsesPerUser:   editing?.maxUsesPerUser    ? String(editing.maxUsesPerUser) : '',
    startsAt:         editing?.startsAt          ? editing.startsAt.slice(0, 16) : '',
    endsAt:           editing?.endsAt            ? editing.endsAt.slice(0, 16)   : '',
    isActive:         editing?.isActive          ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const ch = e => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault(); setErr('');
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    try {
      await saveOffer({
        name:             form.name.trim(),
        code:             form.code.trim().toUpperCase() || null,
        description:      form.description.trim() || null,
        discountType:     form.discountType,
        discountValue:    Number(form.discountValue || 0),
        minBookingAmount: Number(form.minBookingAmount || 0),
        isLoyaltyProgram: false,
        triggerCompletedBookings: null,
        couponValidityDays: 90,
        maxUsesPerUser:   form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
        startsAt:         form.startsAt || null,
        endsAt:           form.endsAt   || null,
        isActive:         form.isActive,
      }, editing);
      onSave(editing ? 'Promo code updated.' : 'Promo code created.');
    } catch (ex) { setErr(ex.response?.data?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const TypeIcon = DISCOUNT_META[form.discountType]?.icon || Tag;

  return (
    <div className="glass-card card-enter relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[3px] h-full"
        style={{ background: 'linear-gradient(180deg, #c8a96b, #c8a96b44 60%, transparent)' }} />
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.5), transparent)' }} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)' }}>
              <Tag size={15} style={{ color: '#c8a96b' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c8a96b' }}>Promo Code</p>
              <h3 className="premium-heading text-lg font-bold text-[var(--heading-color)] leading-tight">
                {editing ? editing.name : 'New Promo Code'}
              </h3>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 transition">
            <X size={14} />
          </button>
        </div>

        {err && (
          <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertCircle size={14} /> {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <FF label="Name *">
              <input name="name" required value={form.name} onChange={ch} className="fi" placeholder="e.g. Welcome Discount" />
            </FF>
            <FF label="Coupon Code" hint="Leave blank to auto-generate. e.g. WELCOME20">
              <input name="code" value={form.code} onChange={ch} className="fi"
                placeholder="WELCOME20" style={{ textTransform: 'uppercase' }} />
            </FF>
          </div>

          <FF label="Description (optional)">
            <textarea name="description" value={form.description} onChange={ch} rows={2} className="fi"
              placeholder="Shown to customers — e.g. 20% off your first booking." />
          </FF>

          <div className="grid sm:grid-cols-3 gap-4">
            <FF label="Discount Type">
              <select name="discountType" value={form.discountType} onChange={ch} className="fi">
                {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{DISCOUNT_META[t].label}</option>)}
              </select>
            </FF>
            <FF label="Value" hint={DISCOUNT_META[form.discountType]?.hint}>
              <div className="relative">
                <TypeIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] pointer-events-none" />
                <input name="discountValue" type="number" step="0.01" min="0"
                  value={form.discountValue} onChange={ch}
                  disabled={form.discountType === 'FreeBooking'} className="fi pl-9" />
              </div>
            </FF>
            <FF label="Min Booking Amount (QAR)" hint="0 = no minimum">
              <input name="minBookingAmount" type="number" step="0.01" min="0"
                value={form.minBookingAmount} onChange={ch} className="fi" />
            </FF>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <FF label="Max Uses per Customer" hint="Leave blank = unlimited">
              <input name="maxUsesPerUser" type="number" min="1"
                value={form.maxUsesPerUser} onChange={ch} className="fi" placeholder="Unlimited" />
            </FF>
            <FF label="Starts At (optional)">
              <input type="datetime-local" name="startsAt" value={form.startsAt} onChange={ch} className="fi" />
            </FF>
            <FF label="Ends At (optional)">
              <input type="datetime-local" name="endsAt" value={form.endsAt} onChange={ch} className="fi" />
            </FF>
          </div>

          <Toggle name="isActive" checked={form.isActive} onChange={ch} label="Active — customers can use this code" />
          <SaveRow saving={saving} editing={editing} onCancel={onCancel} label="Create Promo Code" />
        </form>
      </div>
    </div>
  );
}

/* ─── LoyaltyForm — locked to isLoyaltyProgram=true ─────────────────────── */
function LoyaltyForm({ editing, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name:                    editing?.name                    ?? '',
    description:             editing?.description             ?? '',
    discountType:            editing?.discountType            ?? 'Percentage',
    discountValue:           String(editing?.discountValue    ?? 10),
    triggerCompletedBookings: String(editing?.triggerCompletedBookings ?? 3),
    couponValidityDays:      String(editing?.couponValidityDays ?? 90),
    isActive:                editing?.isActive                ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const ch = e => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault(); setErr('');
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (Number(form.triggerCompletedBookings) < 1) { setErr('Trigger must be at least 1.'); return; }
    setSaving(true);
    try {
      await saveOffer({
        name:                    form.name.trim(),
        code:                    null,
        description:             form.description.trim() || null,
        discountType:            form.discountType,
        discountValue:           Number(form.discountValue || 0),
        minBookingAmount:        0,
        isLoyaltyProgram:        true,
        triggerCompletedBookings: Number(form.triggerCompletedBookings),
        couponValidityDays:      Number(form.couponValidityDays || 90),
        maxUsesPerUser:          null,
        startsAt:                null,
        endsAt:                  null,
        isActive:                form.isActive,
      }, editing);
      onSave(editing ? 'Loyalty program updated.' : 'Loyalty program created.');
    } catch (ex) { setErr(ex.response?.data?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const TypeIcon = DISCOUNT_META[form.discountType]?.icon || Tag;
  const trigger  = Number(form.triggerCompletedBookings) || 0;

  return (
    <div className="glass-card card-enter relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[3px] h-full"
        style={{ background: 'linear-gradient(180deg, #f59e0b, #f59e0b44 60%, transparent)' }} />
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)' }} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Star size={15} style={{ color: '#f59e0b' }} fill="#f59e0b" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Loyalty Program</p>
              <h3 className="premium-heading text-lg font-bold text-[var(--heading-color)] leading-tight">
                {editing ? editing.name : 'New Loyalty Program'}
              </h3>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 transition">
            <X size={14} />
          </button>
        </div>

        {/* Live preview */}
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 leading-relaxed">
          <Star size={11} className="inline mr-1.5 mb-0.5" fill="currentColor" />
          After a customer completes{' '}
          <strong>{trigger > 0 ? trigger : '?'} booking{trigger !== 1 ? 's' : ''}</strong>,
          they automatically receive a personal coupon for{' '}
          <strong>
            {form.discountType === 'FreeBooking' ? 'a free booking'
              : form.discountType === 'Percentage' ? `${form.discountValue || '?'}% off`
              : `${form.discountValue || '?'} QAR off`}
          </strong>
          {' '}valid for <strong>{form.couponValidityDays || '?'} days</strong>.
          No code entry needed — it appears in their rewards automatically.
        </div>

        {err && (
          <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertCircle size={14} /> {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FF label="Program Name *">
            <input name="name" required value={form.name} onChange={ch} className="fi"
              placeholder="e.g. 3-Wash Reward" />
          </FF>

          <FF label="Description (optional)">
            <textarea name="description" value={form.description} onChange={ch} rows={2} className="fi"
              placeholder="Shown to customers in their rewards section." />
          </FF>

          <div className="grid sm:grid-cols-2 gap-4">
            <FF label="Trigger — Bookings to Complete" hint="Customer earns the reward after this many completed bookings.">
              <input name="triggerCompletedBookings" type="number" min="1" max="50" required
                value={form.triggerCompletedBookings} onChange={ch} className="fi" />
            </FF>
            <FF label="Coupon Valid For (days)" hint="How long the issued coupon stays valid.">
              <input name="couponValidityDays" type="number" min="1"
                value={form.couponValidityDays} onChange={ch} className="fi" />
            </FF>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FF label="Reward Type">
              <select name="discountType" value={form.discountType} onChange={ch} className="fi">
                {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{DISCOUNT_META[t].label}</option>)}
              </select>
            </FF>
            <FF label="Reward Value" hint={DISCOUNT_META[form.discountType]?.hint}>
              <div className="relative">
                <TypeIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] pointer-events-none" />
                <input name="discountValue" type="number" step="0.01" min="0"
                  value={form.discountValue} onChange={ch}
                  disabled={form.discountType === 'FreeBooking'} className="fi pl-9" />
              </div>
            </FF>
          </div>

          <Toggle name="isActive" checked={form.isActive} onChange={ch} label="Active — counting customer bookings now" />
          <SaveRow saving={saving} editing={editing} onCancel={onCancel} label="Create Loyalty Program" />
        </form>
      </div>
    </div>
  );
}

/* ─── Offer card ─────────────────────────────────────────────────────────── */
function OfferCard({ offer, onEdit, onDelete }) {
  const meta = DISCOUNT_META[offer.discountType] || DISCOUNT_META.Percentage;
  const expired = isExpired(offer.endsAt);
  const expiring = isExpiringSoon(offer.endsAt);

  return (
    <div className="glass-card prism-glass relative overflow-hidden"
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--px', `${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);
        e.currentTarget.style.setProperty('--py', `${((e.clientY-r.top)/r.height*100).toFixed(1)}%`);
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}55, transparent)` }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
              {offer.isLoyaltyProgram
                ? <Star size={15} style={{ color: '#f59e0b' }} fill="#f59e0b" />
                : <Tag size={15} style={{ color: meta.color }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="font-bold text-[var(--heading-color)] text-sm truncate">{offer.name}</p>
                {offer.isLoyaltyProgram && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                    Loyalty
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  expired
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : offer.isActive
                      ? 'border-green-500/28 bg-green-500/8 text-green-400'
                      : 'border-[var(--border-color)] text-[var(--muted-color)]'
                }`}>
                  {expired ? 'Expired' : offer.isActive ? 'Active' : 'Inactive'}
                </span>
                {expiring && !expired && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/8 text-amber-400">
                    Expiring soon
                  </span>
                )}
              </div>
              {offer.description && (
                <p className="text-xs text-[var(--muted-color)] leading-relaxed line-clamp-2">{offer.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Key details row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg bg-white/3 border border-[var(--border-color)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted-color)] font-semibold uppercase tracking-wide mb-0.5">Discount</p>
            <p className="text-sm font-black" style={{ color: meta.color }}>{fmtDiscount(offer.discountType, offer.discountValue)}</p>
          </div>
          <div className="rounded-lg bg-white/3 border border-[var(--border-color)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted-color)] font-semibold uppercase tracking-wide mb-0.5">
              {offer.isLoyaltyProgram ? 'Trigger' : 'Code'}
            </p>
            {offer.isLoyaltyProgram ? (
              <p className="text-sm font-black text-amber-400">Every {offer.triggerCompletedBookings} washes</p>
            ) : offer.code ? (
              <code className="text-xs font-black text-primary tracking-wider">{offer.code}</code>
            ) : (
              <p className="text-xs text-[var(--muted-color)]">No code</p>
            )}
          </div>
          <div className="rounded-lg bg-white/3 border border-[var(--border-color)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted-color)] font-semibold uppercase tracking-wide mb-0.5">Min Amount</p>
            <p className="text-sm font-black text-[var(--heading-color)]">
              {offer.minBookingAmount > 0 ? `${offer.minBookingAmount} QAR` : 'None'}
            </p>
          </div>
          <div className="rounded-lg bg-white/3 border border-[var(--border-color)] px-3 py-2">
            <p className="text-[10px] text-[var(--muted-color)] font-semibold uppercase tracking-wide mb-0.5">Expires</p>
            <p className="text-sm font-black text-[var(--heading-color)]">
              {offer.endsAt ? fmtDate(offer.endsAt) : 'Never'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-[var(--border-color)]">
          <button onClick={() => onEdit(offer)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
            <Edit2 size={11} /> Edit
          </button>
          <button onClick={() => onDelete(offer.id, offer.name)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/8 transition">
            <Trash2 size={11} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Loyalty progress row ───────────────────────────────────────────────── */
function LoyaltyRow({ row, loyaltyOffers, onAssign }) {
  const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div className={`rounded-xl border p-4 transition ${row.isActivated ? 'border-[var(--border-color)] bg-white/[0.018]' : 'border-amber-500/20 bg-amber-500/4'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[var(--heading-color)] truncate">{row.userName}</p>
            {row.isActivated
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">✓ Verified</span>
              : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">Pending review</span>
            }
          </div>
          <p className="text-xs text-[var(--muted-color)] truncate">{row.userEmail}</p>
          {row.isActivated && row.activatedAt && (
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(200,169,107,0.65)' }}>
              Counter started {fmtShort(row.activatedAt)}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {row.isActivated ? (
            <>
              <p className="text-xl font-black text-amber-400">{row.eligibleBookingsCount}</p>
              <p className="text-[10px] text-[var(--muted-color)]">since approval</p>
              {row.completedBookingsCount !== row.eligibleBookingsCount && (
                <p className="text-[10px] text-[var(--muted-color)]">{row.completedBookingsCount} total</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xl font-black text-[var(--muted-color)]">{row.completedBookingsCount}</p>
              <p className="text-[10px] text-[var(--muted-color)]">total washes</p>
            </>
          )}
        </div>
      </div>

      {/* Progress bars — only meaningful after activation */}
      {row.isActivated && loyaltyOffers.length > 0 && (
        <div className="space-y-2 mb-3">
          {loyaltyOffers.map(lo => {
            const trigger = lo.triggerCompletedBookings || 1;
            const eligible = row.eligibleBookingsCount;
            const positionInCycle = eligible % trigger;
            const pct = positionInCycle === 0 && eligible > 0
              ? 100
              : Math.min((positionInCycle / trigger) * 100, 100);
            const milestoneReached = eligible > 0 && positionInCycle === 0;
            return (
              <div key={lo.id}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--muted-color)]">{lo.name}</span>
                  <span style={{ color: milestoneReached ? '#22c55e' : '#f59e0b' }}>
                    {milestoneReached ? '✓ Reward issued' : `${positionInCycle} / ${trigger}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: milestoneReached ? 'rgba(34,197,94,0.7)' : 'linear-gradient(90deg, rgba(200,169,107,0.8), rgba(245,158,11,0.8))' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!row.isActivated && (
        <p className="text-[11px] text-amber-400/70 mb-2">
          Waiting for Google review verification — counter has not started yet.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--muted-color)]">
          {row.availableCouponsCount > 0
            ? <span className="text-green-400 font-semibold">{row.availableCouponsCount} unused coupon{row.availableCouponsCount > 1 ? 's' : ''}</span>
            : 'No coupons available'}
        </span>
      </div>
    </div>
  );
}

/* ─── Coupon row ─────────────────────────────────────────────────────────── */
function CouponRow({ coupon }) {
  const expiring = isExpiringSoon(coupon.expiresAt);
  const expired = isExpired(coupon.expiresAt);
  return (
    <div className={`rounded-xl border px-4 py-3.5 transition ${
      coupon.isRedeemed ? 'border-[var(--border-color)] opacity-55' :
      expired ? 'border-red-500/20 bg-red-500/4' :
      expiring ? 'border-amber-500/25 bg-amber-500/5' :
      'border-[var(--border-color)] bg-white/[0.018]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <code className="text-sm font-black text-[var(--heading-color)] tracking-wider">{coupon.personalCode}</code>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${
          coupon.isRedeemed ? 'border-[var(--border-color)] text-[var(--muted-color)]' :
          expired ? 'border-red-500/30 text-red-400' :
          expiring ? 'border-amber-500/30 text-amber-400' :
          'border-green-500/25 bg-green-500/8 text-green-400'
        }`}>
          {coupon.isRedeemed ? 'Used' : expired ? 'Expired' : expiring ? 'Expiring' : 'Available'}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-color)]">
        <span className="font-semibold text-[var(--text-color)]">{coupon.userName}</span>
        {' · '}{coupon.offerName}
      </p>
      <p className="text-[11px] text-[var(--muted-color)] mt-1">
        {coupon.isRedeemed
          ? `Used ${fmtDate(coupon.redeemedAt)}`
          : coupon.expiresAt ? `Expires ${fmtDate(coupon.expiresAt)}` : 'No expiry'}
      </p>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'offers',   label: 'Promo Codes',       icon: Tag,   desc: 'Codes customers enter at checkout' },
  { id: 'loyalty',  label: 'Loyalty Programs',  icon: Star,  desc: 'Auto-rewards after N bookings'     },
  { id: 'coupons',  label: 'Issued Coupons',    icon: Ticket,desc: 'All coupons issued to customers'   },
  { id: 'give',     label: 'Give Reward',        icon: Send,  desc: 'Assign coupons to customers now'   },
];

export default function AdminOffers() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'offers';
  const [offers,          setOffers]         = useState([]);
  const [userCoupons,     setUserCoupons]    = useState([]);
  const [loyaltyProgress,  setLoyaltyProgress]  = useState([]);
  const [pendingReviews,   setPendingReviews]   = useState([]);
  const [reviewWorking,    setReviewWorking]    = useState(null); // userId being acted on
  const [loading,         setLoading]        = useState(true);
  const [toast,           setToast]          = useState('');
  const [toastErr,        setToastErr]       = useState('');
  const [tab,             setTab]            = useState(initialTab);
  const [formType,        setFormType]       = useState(null); // null | 'promo' | 'loyalty'
  const [editingOffer,    setEditingOffer]   = useState(null);
  const [search,          setSearch]         = useState('');
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  // Give Reward tab state
  const [giveSort,      setGiveSort]      = useState('bookings'); // 'bookings' | 'memberSince'
  const [selected,      setSelected]      = useState(new Set());
  const [giveOfferId,   setGiveOfferId]   = useState('');
  const [giving,        setGiving]        = useState(false);
  const [giveSearch,    setGiveSearch]    = useState('');

  const showToast = useCallback((msg, isErr = false) => {
    if (isErr) setToastErr(msg); else setToast(msg);
    setTimeout(() => { if (isErr) setToastErr(''); else setToast(''); }, 4000);
  }, []);

  const showConfirm = (title, message, onConfirm) =>
    setModal({ open: true, title, message, onConfirm });
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const fetchAll = useCallback(async () => {
    try {
      const [o, c, p, r] = await Promise.all([
        offersAPI.getAll(),
        offersAPI.getUserCoupons(),
        offersAPI.getLoyaltyProgress(),
        offersAPI.getPendingReviews(),
      ]);
      setOffers(Array.isArray(o) ? o : []);
      setUserCoupons(Array.isArray(c) ? c : []);
      setLoyaltyProgress(Array.isArray(p) ? p : []);
      setPendingReviews(Array.isArray(r) ? r : []);
    } catch { showToast('Failed to load data.', true); }
    finally { setLoading(false); }
  }, [showToast]);

  const handleApproveReview = async (userId, userName) => {
    setReviewWorking(userId);
    try {
      await offersAPI.approveReview(userId);
      showToast(`Loyalty activated for ${userName}.`);
      fetchAll();
    } catch { showToast('Failed to approve review.', true); }
    finally { setReviewWorking(null); }
  };

  const handleRejectReview = (userId, userName) => {
    showConfirm(
      'Reject Review Request',
      `Reject the Google review claim from ${userName}? They will need to re-submit.`,
      async () => {
        closeModal();
        setReviewWorking(userId);
        try {
          await offersAPI.rejectReview(userId);
          showToast(`Review request rejected for ${userName}.`);
          fetchAll();
        } catch { showToast('Failed to reject review.', true); }
        finally { setReviewWorking(null); }
      }
    );
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('refresh-offers-data', handler);
    return () => window.removeEventListener('refresh-offers-data', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== 'offers') params.set('tab', tab);
    setSearchParams(params, { replace: true });
  }, [tab, setSearchParams]);

  const promoCodes   = useMemo(() => offers.filter(o => !o.isLoyaltyProgram), [offers]);
  const loyaltyOffers = useMemo(() => offers.filter(o => o.isLoyaltyProgram), [offers]);

  const filteredCoupons = useMemo(() => {
    if (!search.trim()) return userCoupons;
    const q = search.toLowerCase();
    return userCoupons.filter(c =>
      c.personalCode?.toLowerCase().includes(q) ||
      c.userName?.toLowerCase().includes(q) ||
      c.offerName?.toLowerCase().includes(q)
    );
  }, [userCoupons, search]);

  const availableCoupons = useMemo(() => userCoupons.filter(c => !c.isRedeemed && !isExpired(c.expiresAt)), [userCoupons]);
  const redeemedCoupons  = useMemo(() => userCoupons.filter(c => c.isRedeemed), [userCoupons]);

   const sortedProgress = useMemo(() => {
     let arr = [...loyaltyProgress];
     if (giveSearch.trim()) {
       const q = giveSearch.toLowerCase();
       arr = arr.filter(u =>
         u.userName?.toLowerCase().includes(q) ||
         u.userEmail?.toLowerCase().includes(q)
       );
     }
     if (giveSort === 'bookings')    return arr.sort((a, b) => b.completedBookingsCount - a.completedBookingsCount);
     if (giveSort === 'memberSince') return arr.sort((a, b) => new Date(a.memberSince) - new Date(b.memberSince));
     return arr;
   }, [loyaltyProgress, giveSort, giveSearch]);

  const handleDelete = (id, name) => {
    showConfirm(
      'Remove Offer',
      `Remove "${name}"? Existing issued coupons are not affected.`,
      async () => {
        closeModal();
        try { await offersAPI.delete(id); showToast('Offer removed.'); fetchAll(); }
        catch { showToast('Failed to remove.', true); }
      }
    );
  };

  const handleEdit = offer => {
    setEditingOffer(offer);
    setFormType(offer.isLoyaltyProgram ? 'loyalty' : 'promo');
    setTab(offer.isLoyaltyProgram ? 'loyalty' : 'offers');
  };

  const closeForm = () => { setFormType(null); setEditingOffer(null); };

  const handleFormSave = msg => {
    closeForm();
    showToast(msg);
    fetchAll();
  };

  const handleGiveReward = async () => {
    if (!giveOfferId) return showToast('Pick an offer first.', true);
    if (selected.size === 0) return showToast('Select at least one customer.', true);
    try {
      setGiving(true);
      const res = await offersAPI.assignBulk(parseInt(giveOfferId), [...selected]);
      setSelected(new Set());
      showToast(res.message || `Done — ${res.assigned} assigned, ${res.skipped} skipped.`);
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign rewards.', true);
    } finally { setGiving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--border-color)] border-t-primary animate-spin" />
      <p className="text-[var(--muted-color)] text-sm">Loading…</p>
    </div>
  );

  return (
    <>
      <style>{PRISM_CSS}</style>
      <CursorOrb />

      {/* Toast */}
      {(toast || toastErr) && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold card-enter ${
          toastErr
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-green-500/12 border-green-500/25 text-green-300'
        }`}>
          {toastErr ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toastErr || toast}
        </div>
      )}

      <div className="min-h-screen py-10 relative"
        style={{ background: 'radial-gradient(circle at 7% 6%, rgba(200,169,107,0.06), transparent 38%), radial-gradient(circle at 93% 92%, rgba(14,165,160,0.04), transparent 32%), var(--surface-bg)' }}>
        <div className="container mx-auto px-4 max-w-5xl relative z-10 space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)' }}>
                  <Gift size={18} style={{ color: '#c8a96b' }} />
                </div>
                <div>
                  <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)]">Offers &amp; Loyalty</h1>
                  <p className="text-xs text-[var(--muted-color)] mt-0.5">Promo codes, loyalty rewards, and issued coupons</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingOffer(null); setFormType('promo'); setTab('offers'); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-primary/40 text-primary hover:bg-primary/10 transition">
                <Tag size={14} /> Promo Code
              </button>
              <button onClick={() => { setEditingOffer(null); setFormType('loyalty'); setTab('loyalty'); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400 text-sm font-bold hover:bg-amber-500/25 transition">
                <Star size={14} /> Loyalty Program
              </button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat value={offers.filter(o => o.isActive).length} label="Active Offers" color="#c8a96b"
              sub={`${offers.length} total`} />
            <Stat value={loyaltyOffers.filter(o => o.isActive).length} label="Loyalty Programs" color="#f59e0b"
              sub={`${loyaltyProgress.length} members`} />
            <Stat value={availableCoupons.length} label="Unused Coupons" color="#0ea5a0"
              sub="waiting to be redeemed" />
            <Stat value={redeemedCoupons.length} label="Redeemed" color="#22c55e"
              sub={`${userCoupons.length} total issued`} />
          </div>

          {/* ── Secondary stats ── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Promo Codes',      value: promoCodes.length,    color: '#c8a96b' },
              { label: 'Loyalty Programs', value: loyaltyOffers.length, color: '#f59e0b' },
              { label: 'Issued Coupons',   value: userCoupons.length,   color: '#a855f7' },
            ].map(s => (
              <div key={s.label} className="glass-card px-4 py-3 flex items-center gap-3">
                <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-[var(--muted-color)] font-semibold leading-tight">{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Forms (type-locked) ── */}
          {formType === 'promo' && (
            <PromoForm editing={editingOffer} onSave={handleFormSave} onCancel={closeForm} />
          )}
          {formType === 'loyalty' && (
            <LoyaltyForm editing={editingOffer} onSave={handleFormSave} onCancel={closeForm} />
          )}

          {/* ── How it works callout ── */}
          <div className="glass-card p-4 flex flex-wrap gap-6 text-xs text-[var(--muted-color)]">
            <div className="flex items-start gap-2 flex-1 min-w-[160px]">
              <div className="w-6 h-6 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Tag size={12} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-[var(--text-color)] mb-0.5">Promo Code</p>
                Customer types a code at checkout → gets the discount immediately.
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1 min-w-[160px]">
              <div className="w-6 h-6 rounded-lg bg-amber-500/12 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star size={12} className="text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-[var(--text-color)] mb-0.5">Loyalty Program</p>
                After N completed bookings, a personal coupon is auto-issued to the customer.
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1 min-w-[160px]">
              <div className="w-6 h-6 rounded-lg bg-purple-500/12 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Ticket size={12} className="text-purple-400" />
              </div>
              <div>
                <p className="font-bold text-[var(--text-color)] mb-0.5">Coupon</p>
                A personal one-time code. Can be auto-generated by loyalty or manually given here.
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="glass-card p-1.5 flex gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  tab === t.id
                    ? 'bg-primary text-[var(--ink)]'
                    : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5'
                }`}>
                <t.icon size={14} />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
                {t.id === 'offers' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/25 text-[var(--ink)]' : 'bg-white/8 text-[var(--muted-color)]'}`}>
                    {promoCodes.length}
                  </span>
                )}
                {t.id === 'loyalty' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/25 text-[var(--ink)]' : 'bg-white/8 text-[var(--muted-color)]'}`}>
                    {loyaltyOffers.length}
                  </span>
                )}
                {t.id === 'loyalty' && pendingReviews.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-400">
                    {pendingReviews.length} pending
                  </span>
                )}
                {t.id === 'coupons' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/25 text-[var(--ink)]' : 'bg-amber-500/20 text-amber-400'}`}>
                    {availableCoupons.length}
                  </span>
                )}
                {t.id === 'give' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/25 text-[var(--ink)]' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {loyaltyProgress.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ══ TAB: Promo Codes ══ */}
          {tab === 'offers' && (
            <div className="space-y-3 card-enter">
              {promoCodes.length === 0 ? (
                <div className="glass-card p-14 text-center">
                  <Tag size={28} className="mx-auto mb-3 text-[var(--muted-color)]" />
                  <p className="text-sm font-semibold text-[var(--heading-color)] mb-1">No promo codes yet</p>
                  <p className="text-xs text-[var(--muted-color)] mb-4">Create a code customers can enter at checkout for a discount.</p>
                  <button onClick={() => { setEditingOffer(null); setFormType('promo'); }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-[var(--ink)] text-sm font-bold hover:bg-primary/90 transition">
                    <Plus size={14} /> Create First Code
                  </button>
                </div>
              ) : (
                promoCodes.map(o => (
                  <OfferCard key={o.id} offer={o} onEdit={handleEdit} onDelete={handleDelete} />
                ))
              )}
            </div>
          )}

          {/* ══ TAB: Loyalty Programs ══ */}
          {tab === 'loyalty' && (
            <div className="space-y-5 card-enter">
              {/* Programs */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">Programs</p>
                {loyaltyOffers.length === 0 ? (
                  <div className="glass-card p-10 text-center">
                    <Star size={28} className="mx-auto mb-3 text-amber-400" />
                    <p className="text-sm font-semibold text-[var(--heading-color)] mb-1">No loyalty programs</p>
                    <p className="text-xs text-[var(--muted-color)] mb-4">Create a program that auto-rewards customers after N completed bookings.</p>
                    <button onClick={() => { setEditingOffer(null); setFormType('loyalty'); }}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400 text-sm font-bold hover:bg-amber-500/25 transition">
                      <Plus size={14} /> Create Program
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loyaltyOffers.map(o => (
                      <OfferCard key={o.id} offer={o} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Pending Review Approvals ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)]">
                    Pending Review Verifications
                  </p>
                  {pendingReviews.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      {pendingReviews.length}
                    </span>
                  )}
                </div>

                {pendingReviews.length === 0 ? (
                  <div className="glass-card px-5 py-4 flex items-center gap-3">
                    <ShieldCheck size={16} style={{ color: 'rgba(200,169,107,0.5)' }} />
                    <span className="text-xs text-[var(--muted-color)]">No pending review requests.</span>
                  </div>
                 ) : (
                   <div className="space-y-2">
                     {pendingReviews.map(r => (
                       <div key={r.userId} className="glass-card px-4 py-3">
                         <div className="flex items-center gap-3 mb-3">
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-semibold text-[var(--heading-color)] truncate">{r.userName}</p>
                             <p className="text-xs text-[var(--muted-color)] truncate">{r.userEmail}</p>
                             <p className="text-[10px] mt-0.5" style={{ color: 'rgba(200,169,107,0.65)' }}>
                               {r.completedBookings} completed wash{r.completedBookings !== 1 ? 'es' : ''} · submitted {new Date(r.pendingAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                             </p>
                           </div>
                         </div>

                          {/* Screenshot preview */}
                          {r.screenshotUrl && (
                            <div className="mb-3 rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(200,169,107,0.2)' }}>
                              <img src={toAbsoluteImageUrl(r.screenshotUrl)} alt="Review screenshot" className="w-full max-h-48 object-contain bg-black/20" />
                            </div>
                          )}

                         <div className="flex items-center gap-2 shrink-0">
                           <button
                             onClick={() => handleApproveReview(r.userId, r.userName)}
                             disabled={reviewWorking === r.userId}
                             title="Approve — activate loyalty counter"
                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                             style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                             {reviewWorking === r.userId
                               ? <RefreshCw size={12} className="animate-spin" />
                               : <ShieldCheck size={12} />}
                             Approve
                           </button>
                           <button
                             onClick={() => handleRejectReview(r.userId, r.userName)}
                             disabled={reviewWorking === r.userId}
                             title="Reject — reset the request"
                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                             style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                             <ShieldX size={12} />
                             Reject
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              {/* Customer progress */}
              {loyaltyProgress.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">
                    Customer Progress — {loyaltyProgress.length} member{loyaltyProgress.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {loyaltyProgress.map(row => (
                      <LoyaltyRow key={row.userId} row={row} loyaltyOffers={loyaltyOffers} onAssign={fetchAll} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: Give Reward ══ */}
          {tab === 'give' && (
            <div className="space-y-4 card-enter">
              {/* Controls */}
              <div className="glass-card p-4 flex flex-wrap items-end gap-4">
                {/* Offer picker */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Offer to Give</p>
                  <select
                    value={giveOfferId}
                    onChange={e => setGiveOfferId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition">
                    <option value="">— pick an offer —</option>
                    {offers.filter(o => o.isActive).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.isLoyaltyProgram ? '⭐ ' : '🏷️ '}{o.name}{o.code ? ` (${o.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                  {/* Search */}
                  <div className="min-w-[200px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Search by Name or Email</p>
                    <input
                      value={giveSearch}
                      onChange={e => setGiveSearch(e.target.value)}
                      placeholder="Type to filter customers..."
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                  </div>

                 {/* Sort */}
                 <div className="min-w-[160px]">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Sort By</p>
                   <div className="flex rounded-xl border border-[var(--border-color)] overflow-hidden text-xs font-semibold">
                     <button
                       onClick={() => setGiveSort('bookings')}
                       className={`flex-1 px-3 py-2.5 flex items-center justify-center gap-1.5 transition ${giveSort === 'bookings' ? 'bg-primary text-[var(--ink)]' : 'text-[var(--muted-color)] hover:bg-white/5'}`}>
                       <TrendingUp size={12} /> Washes
                     </button>
                     <button
                       onClick={() => setGiveSort('memberSince')}
                       className={`flex-1 px-3 py-2.5 flex items-center justify-center gap-1.5 transition ${giveSort === 'memberSince' ? 'bg-primary text-[var(--ink)]' : 'text-[var(--muted-color)] hover:bg-white/5'}`}>
                       <Clock size={12} /> Oldest
                     </button>
                   </div>
                 </div>

                {/* Select all / none */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(new Set(sortedProgress.map(u => u.userId)))}
                    className="px-3 py-2.5 rounded-xl border border-[var(--border-color)] text-xs font-semibold text-[var(--text-color)] hover:bg-white/5 transition">
                    Select All
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="px-3 py-2.5 rounded-xl border border-[var(--border-color)] text-xs font-semibold text-[var(--muted-color)] hover:bg-white/5 transition">
                    None
                  </button>
                </div>

                {/* Give button */}
                <button
                  onClick={handleGiveReward}
                  disabled={giving || selected.size === 0 || !giveOfferId}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: selected.size > 0 && giveOfferId ? 'rgba(200,169,107,0.9)' : undefined, color: selected.size > 0 && giveOfferId ? '#0a0a0a' : undefined, border: !(selected.size > 0 && giveOfferId) ? '1px solid var(--border-color)' : undefined }}>
                  {giving
                    ? <><RefreshCw size={14} className="animate-spin" /> Sending…</>
                    : <><Send size={14} /> Give to {selected.size > 0 ? selected.size : '…'} Selected</>}
                </button>
              </div>

              {/* Customer table */}
              {sortedProgress.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Users size={28} className="mx-auto mb-3 text-[var(--muted-color)]" />
                  <p className="text-sm text-[var(--muted-color)]">No customers yet.</p>
                </div>
              ) : (
                <div className="glass-card overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-x-4 px-4 py-3 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">
                    <span />
                    <span>Customer</span>
                    <span>Email</span>
                    <span className="text-right">Completed Washes</span>
                    <span className="text-right">Member Since</span>
                  </div>
                  <div className="divide-y divide-[var(--border-color)]">
                    {sortedProgress.map((u, idx) => {
                      const checked = selected.has(u.userId);
                      return (
                        <label key={u.userId}
                          className={`grid grid-cols-[auto_1fr_1fr_auto_auto] gap-x-4 px-4 py-3 items-center cursor-pointer transition ${checked ? 'bg-primary/6' : 'hover:bg-white/3'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={e => {
                              const next = new Set(selected);
                              e.target.checked ? next.add(u.userId) : next.delete(u.userId);
                              setSelected(next);
                            }}
                            className="w-4 h-4 rounded accent-primary" />
                          <span className="text-sm font-semibold text-[var(--heading-color)] truncate">{u.userName}</span>
                          <span className="text-xs text-[var(--muted-color)] truncate">{u.userEmail}</span>
                          <span className="text-sm font-bold text-right" style={{ color: u.completedBookingsCount > 0 ? '#c8a96b' : undefined }}>
                            {u.completedBookingsCount}
                          </span>
                          <span className="text-xs text-[var(--muted-color)] text-right whitespace-nowrap">
                            {u.memberSince ? new Date(u.memberSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    <p className="text-xs text-[var(--muted-color)]">{sortedProgress.length} customers · only completed bookings count toward loyalty</p>
                    <p className="text-xs font-semibold text-[var(--heading-color)]">{selected.size} selected</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: Issued Coupons ══ */}
          {tab === 'coupons' && (
            <div className="space-y-4 card-enter">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by code, customer name, or offer…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>

              {filteredCoupons.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Ticket size={28} className="mx-auto mb-3 text-[var(--muted-color)]" />
                  <p className="text-sm text-[var(--muted-color)]">
                    {search ? 'No coupons match your search.' : 'No coupons issued yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCoupons.map(c => <CouponRow key={c.id} coupon={c} />)}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <AppModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={modal.onConfirm}
        onClose={closeModal}
      />
    </>
  );
}
