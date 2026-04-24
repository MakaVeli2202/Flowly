import React, { useEffect, useMemo, useRef, useState } from 'react';
import { offersAPI } from '../../api/offers';
import {
  Plus, Edit2, Trash2, Ticket, AlertCircle, CheckCircle,
  Users, Gift, X, Star,
} from 'lucide-react';
import AppModal from '../../components/shared/AppModal';

const DISCOUNT_TYPES = ['Percentage', 'FixedAmount', 'FreeBooking'];

const DISCOUNT_BADGE = {
  Percentage:  { color: '#c8a96b', label: 'Percent' },
  FixedAmount: { color: '#0ea5a0', label: 'Fixed'   },
  FreeBooking: { color: '#22c55e', label: 'Free'    },
};

const fmtValue = (type, value) => {
  if (type === 'Percentage')  return `${value}%`;
  if (type === 'FreeBooking') return 'Free booking';
  return `${value} QAR`;
};

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
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.18; }
  33%      { transform: translate(12px,-14px) rotate(120deg); opacity: 0.30; }
  66%      { transform: translate(-7px,8px)   rotate(240deg); opacity: 0.22; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.42),  0 0 22px rgba(255,165,0,.15); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.42),  0 0 22px rgba(160,0,255,.15); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.42),  0 0 22px rgba(255,0,100,.15); }
}
@keyframes card-enter {
  from { transform: translateY(14px) scale(0.988); opacity: 0; }
  to   { transform: translateY(0)    scale(1);     opacity: 1; }
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
    transparent 0%, rgba(255,55,55,.030) 15%, rgba(255,200,0,.042) 30%,
    rgba(0,255,145,.034) 50%, rgba(0,145,255,.034) 70%,
    rgba(195,0,255,.026) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.10) 0%, rgba(80,255,160,.07) 30%,
    rgba(40,130,255,.07) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.32s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.80) 12%, rgba(255,165,0,.85) 24%,
    rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.40;
}
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.card-stagger   { animation: card-enter 0.52s cubic-bezier(0.22,1,0.36,1) both; }

.field-input {
  width: 100%; padding: 10px 14px; border-radius: 12px;
  border: 1px solid var(--border-color); background: var(--surface-bg);
  color: var(--text-color); font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none; resize: none;
}
.field-input:focus {
  border-color: rgba(200,169,107,0.65);
  box-shadow: 0 0 0 3px rgba(200,169,107,0.12);
}
.field-input:disabled { opacity: 0.40; cursor: not-allowed; }
.field-label {
  display: block; font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.20em; text-transform: uppercase;
  color: var(--muted-color); margin-bottom: 7px;
}
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
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 480, height: 480, top: '-240px', left: '-240px' }} />;
}

/* ── FormField ───────────────────────────────────────────────── */
function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-[var(--muted-color)] leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ── FormDivider ─────────────────────────────────────────────── */
function FormDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-[var(--border-color)]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{label}</p>
      <div className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}

/* ── Toggle ──────────────────────────────────────────────────── */
function Toggle({ name, checked, onChange, label, disabled = false }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer group'}`}>
      <div className="relative flex-shrink-0">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`w-10 h-[22px] rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-[var(--border-color)]'}`} />
        <div className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm font-bold text-[var(--text-color)] select-none">{label}</span>
    </label>
  );
}

/* ── DiscountBadge ───────────────────────────────────────────── */
function DiscountBadge({ type }) {
  const style = DISCOUNT_BADGE[type] || { color: '#94a3b8', label: type };
  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full"
      style={{ background: `${style.color}18`, border: `1px solid ${style.color}30`, color: style.color }}>
      {style.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   MANAGE OFFERS
════════════════════════════════════════════════════════════ */
function ManageOffers() {
  const [offers,         setOffers]         = useState([]);
  const [userCoupons,    setUserCoupons]    = useState([]);
  const [loyaltyProgress, setLoyaltyProgress] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editingOffer,   setEditingOffer]   = useState(null);
  const [modal, setModal] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });

  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open: true, title, message, variant, onConfirm });
  const closeModal = () => setModal((m) => ({ ...m, open: false, onConfirm: null }));

  const [assigningOfferId, setAssigningOfferId] = useState('');
  const [assigningUserId,  setAssigningUserId]  = useState('');

  const [formData, setFormData] = useState({
    name: '', code: '', description: '',
    discountType: 'Percentage', discountValue: '10',
    minBookingAmount: '0', isLoyaltyProgram: false,
    triggerCompletedBookings: '3', couponValidityDays: '90',
    maxUsesPerUser: '', startsAt: '', endsAt: '', isActive: true,
  });

  const customerOptions = useMemo(() =>
    loyaltyProgress.map((user) => ({ id: user.userId, label: `${user.userName} (${user.userEmail})` })),
    [loyaltyProgress]
  );

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [offersData, couponsData, progressData] = await Promise.all([
        offersAPI.getAll(),
        offersAPI.getUserCoupons(),
        offersAPI.getLoyaltyProgress(),
      ]);
      setOffers(offersData);
      setUserCoupons(couponsData);
      setLoyaltyProgress(progressData);
    } catch { setError('Failed to load offers data.'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({
      name: '', code: '', description: '',
      discountType: 'Percentage', discountValue: '10',
      minBookingAmount: '0', isLoyaltyProgram: false,
      triggerCompletedBookings: '3', couponValidityDays: '90',
      maxUsesPerUser: '', startsAt: '', endsAt: '', isActive: true,
    });
    setEditingOffer(null);
    setShowForm(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = {
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue || 0),
        minBookingAmount: Number(formData.minBookingAmount || 0),
        isLoyaltyProgram: formData.isLoyaltyProgram,
        triggerCompletedBookings: formData.isLoyaltyProgram ? Number(formData.triggerCompletedBookings || 0) : null,
        couponValidityDays: Number(formData.couponValidityDays || 90),
        maxUsesPerUser: formData.maxUsesPerUser ? Number(formData.maxUsesPerUser) : null,
        startsAt: formData.startsAt || null,
        endsAt: formData.endsAt || null,
        isActive: formData.isActive,
      };
      if (editingOffer) {
        await offersAPI.update(editingOffer.id, payload);
        setSuccess('Offer updated successfully.');
      } else {
        await offersAPI.create(payload);
        setSuccess('Offer created successfully.');
      }
      resetForm(); fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save offer.');
    }
  };

  const handleEdit = (offer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name, code: offer.code || '',
      description: offer.description || '',
      discountType: offer.discountType,
      discountValue: String(offer.discountValue ?? 0),
      minBookingAmount: String(offer.minBookingAmount ?? 0),
      isLoyaltyProgram: offer.isLoyaltyProgram,
      triggerCompletedBookings: String(offer.triggerCompletedBookings ?? 3),
      couponValidityDays: String(offer.couponValidityDays ?? 90),
      maxUsesPerUser: offer.maxUsesPerUser ? String(offer.maxUsesPerUser) : '',
      startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : '',
      endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : '',
      isActive: offer.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    showConfirm(
      'Remove Offer',
      `Are you sure you want to remove "${name}"? This cannot be undone.`,
      'danger',
      async () => {
        closeModal();
        try {
          await offersAPI.delete(id);
          setSuccess('Offer deactivated successfully.');
          fetchAll();
        } catch { setError('Failed to deactivate offer.'); }
      }
    );
  };

  const handleAssignCoupon = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!assigningOfferId || !assigningUserId) {
      setError('Choose both offer and user to assign coupon.');
      return;
    }
    try {
      const res = await offersAPI.assignToUser(assigningOfferId, assigningUserId);
      setSuccess(`Coupon assigned. Code: ${res.code}`);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign coupon.');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading offers data…</p>
    </div>
  );

  const formAccent = editingOffer ? '#0ea5a0' : '#c8a96b';
  const inp = 'field-input';

  /* ── RENDER ────────────────────────────────────────────────── */
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
        {/* Backdrop orb */}
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Page header ──────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">Admin Panel</p>
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                  <Ticket size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Offers &amp; Loyalty</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Create discount campaigns and user-specific coupons.</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button" onClick={() => setShowForm((prev) => !prev)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? 'Close Form' : 'Add Offer'}
              </button>
            </div>
          </div>

          {/* ── Alerts ───────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300 transition">
                <X size={14} />
              </button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-4">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm font-semibold">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300 transition">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Create / Edit form ───────────────────────── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
              {/* Left accent bar */}
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: `linear-gradient(180deg, ${formAccent} 0%, ${formAccent}44 60%, transparent 100%)` }} />
              <div className="prism-ray" style={{ left: '70%', width: '12%', animation: 'prism-ray-sweep 18s ease-in-out 3s infinite' }} />

              <div className="p-7">
                {/* Form header */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, transparent, ${formAccent})` }} />
                      <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em]" style={{ color: formAccent }}>
                        {editingOffer ? 'Edit Mode' : 'New Offer'}
                      </p>
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, ${formAccent}, transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editingOffer ? `Editing: ${editingOffer.name}` : 'Create Offer'}
                    </h2>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 hover:text-[var(--text-color)] transition">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-5"><div className="spectrum-line" /></div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Basic */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <FormField label="Name *">
                      <input name="name" required value={formData.name} onChange={handleChange} className={inp} />
                    </FormField>
                    <FormField label="Coupon Code"
                      hint={formData.isLoyaltyProgram ? 'Auto-generated for loyalty programs.' : 'e.g. WELCOME10'}>
                      <input name="code" value={formData.code} onChange={handleChange}
                        disabled={formData.isLoyaltyProgram} className={inp} placeholder="WELCOME10 or LOYAL" />
                    </FormField>
                  </div>
                  <FormField label="Description">
                    <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={inp} />
                  </FormField>

                  <FormDivider label="Pricing" />
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
                    <FormField label="Discount Type *">
                      <select name="discountType" value={formData.discountType} onChange={handleChange} className={inp}>
                        {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Discount Value *">
                      <input name="discountValue" type="number" step="0.01" value={formData.discountValue} onChange={handleChange} className={inp} />
                    </FormField>
                    <FormField label="Min Booking Amount">
                      <input name="minBookingAmount" type="number" step="0.01" value={formData.minBookingAmount} onChange={handleChange} className={inp} />
                    </FormField>
                    <FormField label="Max Uses / User">
                      <input name="maxUsesPerUser" type="number" value={formData.maxUsesPerUser} onChange={handleChange} className={inp} placeholder="Unlimited" />
                    </FormField>
                  </div>

                  <FormDivider label="Loyalty Program" />
                  <div className="grid sm:grid-cols-3 gap-5 items-end">
                    <div className="flex flex-col justify-end pb-1">
                      <Toggle name="isLoyaltyProgram" checked={formData.isLoyaltyProgram} onChange={handleChange}
                        label="Is Loyalty Program" />
                      {formData.isLoyaltyProgram && (
                        <p className="text-[11px] text-amber-400 mt-2 leading-relaxed">
                          Coupons auto-generated when trigger count is reached.
                        </p>
                      )}
                    </div>
                    <FormField label="Trigger Completed Bookings"
                      hint={!formData.isLoyaltyProgram ? 'Enable loyalty to configure.' : undefined}>
                      <input name="triggerCompletedBookings" type="number"
                        value={formData.triggerCompletedBookings} onChange={handleChange}
                        disabled={!formData.isLoyaltyProgram} className={inp} />
                    </FormField>
                    <FormField label="Coupon Validity (days)">
                      <input name="couponValidityDays" type="number" value={formData.couponValidityDays} onChange={handleChange} className={inp} />
                    </FormField>
                  </div>

                  <FormDivider label="Schedule" />
                  <div className="grid sm:grid-cols-3 gap-5 items-end">
                    <FormField label="Starts At">
                      <input type="datetime-local" name="startsAt" value={formData.startsAt} onChange={handleChange} className={inp} />
                    </FormField>
                    <FormField label="Ends At">
                      <input type="datetime-local" name="endsAt" value={formData.endsAt} onChange={handleChange} className={inp} />
                    </FormField>
                    <div className="flex flex-col justify-end pb-1">
                      <Toggle name="isActive" checked={formData.isActive} onChange={handleChange} label="Active" />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit"
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition">
                        <CheckCircle size={14} />
                        {editingOffer ? 'Update Offer' : 'Create Offer'}
                      </button>
                    </div>
                    <button type="button" onClick={resetForm}
                      className="px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Offers table ─────────────────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.06s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #c8a96b44 60%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '62%', width: '13%', animation: 'prism-ray-sweep 22s ease-in-out 5s infinite' }} />

            <div className="px-7 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-5" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em] text-primary">Catalog</p>
                <span className="h-px w-5" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Offers</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)', color: '#c8a96b' }}>
                  {offers.length} total · {offers.filter(o => o.isActive).length} active
                </span>
              </div>
              <div className="mb-4"><div className="spectrum-line" /></div>
            </div>

            {offers.length === 0 ? (
              <div className="px-7 pb-10 text-center">
                <Ticket size={32} className="mx-auto mb-3 text-[var(--muted-color)]" />
                <p className="text-sm text-[var(--muted-color)]">No offers yet. Create your first offer above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Name', 'Code', 'Type', 'Value', 'Loyalty', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {offers.map((offer) => (
                      <tr key={offer.id} className="hover:bg-white/[0.015] transition">
                        {/* Name */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-[var(--heading-color)] text-sm">{offer.name}</p>
                          {offer.description && (
                            <p className="text-[11px] text-[var(--muted-color)] mt-0.5 max-w-[180px] truncate">{offer.description}</p>
                          )}
                        </td>
                        {/* Code */}
                        <td className="px-6 py-4">
                          {offer.code ? (
                            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg"
                              style={{ background: 'rgba(200,169,107,0.10)', color: '#c8a96b', border: '1px solid rgba(200,169,107,0.22)' }}>
                              {offer.code}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-color)]">—</span>
                          )}
                        </td>
                        {/* Type */}
                        <td className="px-6 py-4">
                          <DiscountBadge type={offer.discountType} />
                        </td>
                        {/* Value */}
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-primary">{fmtValue(offer.discountType, offer.discountValue)}</span>
                        </td>
                        {/* Loyalty */}
                        <td className="px-6 py-4">
                          {offer.isLoyaltyProgram ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold"
                              style={{ color: '#f59e0b' }}>
                              <Star size={11} fill="#f59e0b" stroke="none" />
                              Every {offer.triggerCompletedBookings}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-color)]">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            offer.isActive
                              ? 'text-green-400 border border-green-500/28 bg-green-500/8'
                              : 'text-[var(--muted-color)] border border-[var(--border-color)]'
                          }`}>
                            {offer.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(offer)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                              <Edit2 size={11} /> Edit
                            </button>
                            <button onClick={() => handleDelete(offer.id, offer.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition">
                              <Trash2 size={11} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Assign coupon ─────────────────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.12s' }}>
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #3b82f644 60%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '76%', width: '10%', animation: 'prism-ray-sweep 19s ease-in-out 8s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.24)' }}>
                  <Gift size={14} style={{ color: '#3b82f6' }} />
                </div>
                <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">Assign Coupon to User</h2>
              </div>
              <div className="mb-5"><div className="spectrum-line" /></div>

              <form onSubmit={handleAssignCoupon} className="grid md:grid-cols-3 gap-5 items-end">
                <FormField label="Offer">
                  <select value={assigningOfferId} onChange={(e) => setAssigningOfferId(e.target.value)} className={inp}>
                    <option value="">Select active offer</option>
                    {offers.filter((o) => o.isActive).map((offer) => (
                      <option key={offer.id} value={offer.id}>{offer.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Customer">
                  <select value={assigningUserId} onChange={(e) => setAssigningUserId(e.target.value)} className={inp}>
                    <option value="">Select customer</option>
                    {customerOptions.map((user) => (
                      <option key={user.id} value={user.id}>{user.label}</option>
                    ))}
                  </select>
                </FormField>
                <div>
                  <button type="submit"
                    className="w-full py-[10px] rounded-xl text-sm font-bold transition"
                    style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.30)', color: '#3b82f6' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.24)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; }}
                  >
                    Assign Coupon
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ── Loyalty progress + User coupons ──────────── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Loyalty Progress */}
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.18s' }}>
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #f59e0b 0%, #f59e0b44 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '68%', width: '11%', animation: 'prism-ray-sweep 17s ease-in-out 6s infinite' }} />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.24)' }}>
                    <Users size={14} style={{ color: '#f59e0b' }} />
                  </div>
                  <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">Loyalty Progress</h2>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>

                {loyaltyProgress.length === 0 ? (
                  <div className="py-8 text-center">
                    <Star size={28} className="mx-auto mb-2" style={{ color: '#f59e0b' }} />
                    <p className="text-sm text-[var(--muted-color)]">No loyalty progress data yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {loyaltyProgress.map((row) => (
                      <div key={row.userId}
                        className="flex items-center justify-between rounded-xl border border-[var(--border-color)] px-4 py-3.5 hover:border-amber-500/28 transition">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--heading-color)] truncate">{row.userName}</p>
                          <p className="text-[11px] text-[var(--muted-color)] truncate">{row.userEmail}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-xs text-[var(--muted-color)] mb-0.5">Completed</p>
                          <p className="text-lg font-black" style={{ color: '#f59e0b' }}>{row.completedBookingsCount}</p>
                          <p className="text-[11px] text-[var(--muted-color)]">
                            {row.availableCouponsCount} coupon{row.availableCouponsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User Coupons */}
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.24s' }}>
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #8b5cf6 0%, #8b5cf644 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '65%', width: '12%', animation: 'prism-ray-sweep 21s ease-in-out 10s infinite' }} />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.24)' }}>
                    <Ticket size={14} style={{ color: '#8b5cf6' }} />
                  </div>
                  <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">User Coupons</h2>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>

                {userCoupons.length === 0 ? (
                  <div className="py-8 text-center">
                    <Ticket size={28} className="mx-auto mb-2" style={{ color: '#8b5cf6' }} />
                    <p className="text-sm text-[var(--muted-color)]">No coupons issued yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {userCoupons.map((coupon) => (
                      <div key={coupon.id}
                        className={`rounded-xl border px-4 py-3.5 transition ${
                          coupon.isRedeemed
                            ? 'border-[var(--border-color)] opacity-55'
                            : 'border-purple-500/22 bg-purple-500/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <span className="font-mono text-sm font-black text-[var(--heading-color)]">{coupon.personalCode}</span>
                          <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            coupon.isRedeemed
                              ? 'border border-[var(--border-color)] text-[var(--muted-color)]'
                              : 'border border-green-500/25 bg-green-500/10 text-green-400'
                          }`}>
                            {coupon.isRedeemed ? 'Redeemed' : 'Available'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-color)]">{coupon.offerName} · {coupon.userName}</p>
                        <p className="text-[11px] text-[var(--muted-color)] mt-1.5">
                          {coupon.isRedeemed
                            ? `Redeemed ${new Date(coupon.redeemedAt).toLocaleString()}`
                            : `Expires: ${coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'No expiry'}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <AppModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        confirmLabel="Confirm"
        onConfirm={modal.onConfirm}
        onClose={closeModal}
      />
    </>
  );
}

export default ManageOffers;