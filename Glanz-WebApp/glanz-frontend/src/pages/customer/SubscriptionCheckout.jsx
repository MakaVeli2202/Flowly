import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscriptionsAPI } from '../../api/subscriptions';
import {
  ChevronLeft, AlertCircle, CheckCircle, Calendar, Clock,
  Car, Crown, Tag, ChevronRight, Loader,
} from 'lucide-react';
import AddressAutocompleteInput from '../../components/shared/AddressAutocompleteInput';
import SEO from '../../components/shared/SEO';
import { formatQAR } from '../../utils/currency';
import LoadingCircle from '../../components/shared/LoadingCircle';

/* ── helpers ─────────────────────────────────────────────── */
const toDateKey = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};
const smartDates = (count) => {
  const dates = [];
  const base = new Date();
  base.setDate(base.getDate() + 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    dates.push(toDateKey(d));
  }
  return dates;
};
const deriveStatus = ({ freeSlots, totalSlots, utilizationPercent }) => {
  const free = Number(freeSlots), total = Number(totalSlots), util = Number(utilizationPercent);
  if (Number.isFinite(free) && free <= 0) return 'full';
  if (Number.isFinite(util) && util >= 70) return 'medium';
  if (Number.isFinite(total) && Number.isFinite(free) && total > 0 && ((total - free) / total) * 100 >= 70) return 'medium';
  return 'available';
};
const _normalizeStatus = (raw, metrics = {}) => {
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (['available','medium','full'].includes(k)) return k;
    return deriveStatus(metrics);
  }
  if (typeof raw === 'number') return ['available','medium','full'][raw] || deriveStatus(metrics);
  return deriveStatus(metrics);
};
const VEHICLE_MULTIPLIERS = { Motorcycle: 0.8, Sedan: 1.0, SUV: 1.25, Pickup: 1.5 };
const VEHICLE_OPTIONS = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];

/* ── Section heading ─────────────────────────────────────── */
function SectionHeading({ icon: Icon, children, step }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {step !== undefined && (
        <span className="text-[0.58rem] font-bold tracking-[0.2em] flex-shrink-0" style={{ color: 'var(--muted-color)', opacity: 0.45 }}>
          {String(step).padStart(2, '0')}
        </span>
      )}
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      )}
      <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">{children}</h2>
      <span className="flex-1 h-px ml-1 hidden sm:block" style={{ background: 'linear-gradient(90deg,rgba(200,169,107,0.18),transparent)' }} />
    </div>
  );
}

/* ── Mini calendar per package ───────────────────────────── */
function PackageCalendar({ pkgId, selectedDate, onSelectDate, calMonth, onChangeMonth }) {
  const [avail, setAvail] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    subscriptionsAPI.getAvailability({ month: calMonth.getMonth() + 1, year: calMonth.getFullYear(), packageId: pkgId })
      .then((data) => {
        const map = {};
        (data || []).forEach((day) => {
          const dateKey = String(day.date ?? day.Date ?? '').split('T')[0];
          if (!dateKey) return;
          // SubBookingDayAvailabilityDto uses "color" (green/yellow/red) + availableSlots
          const color = day.color ?? day.Color;
          const avSlots = day.availableSlots ?? day.AvailableSlots ?? 1;
          let status;
          if (color === 'red' || avSlots <= 0) status = 'full';
          else if (color === 'yellow') status = 'medium';
          else status = 'available';
          map[dateKey] = status;
        });
        setAvail(map);
      })
      .catch(() => setAvail({}))
      .finally(() => setLoading(false));
  }, [pkgId, calMonth]);

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const cells = [];
  const firstDay = new Date(year, month, 1);
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = toDateKey(new Date());
  const minDate = addDays(today, 1);

  return (
    <div className="rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-color)]">
        <button type="button" onClick={() => { const d = new Date(year, month - 1, 1); onChangeMonth(d); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-[var(--muted-color)] transition">
          <ChevronLeft size={13} />
        </button>
        <p className="text-sm font-bold text-[var(--heading-color)]">
          {calMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          {loading && <span className="ml-2 inline-block w-3 h-3 border border-t-primary rounded-full animate-spin align-middle" />}
        </p>
        <button type="button" onClick={() => { const d = new Date(year, month + 1, 1); onChangeMonth(d); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-[var(--muted-color)] transition">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 mb-1">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-[var(--muted-color)] py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-day empty" />;
            const key = toDateKey(d);
            const isPast = key < minDate;
            const status = avail[key] || 'available';
            const isSelected = selectedDate === key;
            const cls = isPast ? 'cal-day past' : status === 'full' ? 'cal-day full' : `cal-day ${status}${isSelected ? ' selected' : ''}`;
            return (
              <button key={i} type="button" className={cls}
                onClick={() => !isPast && status !== 'full' && onSelectDate(key)}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 px-1">
          {[['#22c55e','Available'],['#eab308','Busy'],['rgba(255,255,255,0.25)','Full']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
              <span className="text-[10px] text-[var(--muted-color)]">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Time slot picker per package ────────────────────────── */
function PackageSlots({ pkgId, date, selectedSlot, onSelectSlot }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) { setSlots([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setLoading(true);
    subscriptionsAPI.getSlots({ date, packageId: pkgId })
      .then((data) => setSlots(data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [pkgId, date]);

  if (!date) return <p className="text-xs text-[var(--muted-color)] italic py-2">Select a date first.</p>;
  if (loading) return <LoadingCircle label="Loading slots..." className="py-2 justify-start" sizeClass="h-4 w-4" />;
  if (slots.length === 0) return <p className="text-xs text-amber-400 py-2">No slots available for this date.</p>;

  // API returns SubBookingSlotDto objects: { slot, available, bookingCount, maxBookings }
  const normalizedSlots = slots.map((s) => typeof s === 'string' ? { slot: s, available: true } : s);
  const availableSlots = normalizedSlots.filter((s) => s.available);

  if (availableSlots.length === 0) return <p className="text-xs text-amber-400 py-2">No available slots for this date.</p>;

  const fmtSlot = (s) => {
    const part = String(s).split('-')[0].trim();
    const [h, m] = part.split(':').map(Number);
    if (!Number.isFinite(h)) return s;
    const period = h >= 12 ? 'PM' : 'AM';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${String(m ?? 0).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {availableSlots.map(({ slot }) => (
        <button key={slot} type="button"
          onClick={() => onSelectSlot(slot)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
          style={{
            background: selectedSlot === slot ? 'rgba(200,169,107,0.18)' : 'transparent',
            color: selectedSlot === slot ? '#c8a96b' : 'var(--muted-color)',
            border: selectedSlot === slot ? '1px solid rgba(200,169,107,0.45)' : '1px solid var(--border-color)',
          }}>
          {fmtSlot(slot)}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function SubscriptionCheckout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const plan = location.state?.plan ?? null;

  useEffect(() => {
    if (!plan) navigate('/plans', { replace: true });
  }, [plan, navigate]);

  const packages = plan?.planPackages?.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];

  /* ── per-package state ──────────────────────────────────── */
  const suggested = smartDates(packages.length);
  const [selections, setSelections] = useState(() =>
    packages.map((pp, i) => ({
      packageId:  pp.packageId,
      date:       suggested[i] || '',
      timeSlot:   '',
      calMonth:   new Date(),
    }))
  );

  /* ── vehicle + address state ─────────────────────────────── */
  const [vehicleType,  setVehicleType]  = useState(user?.vehicleType  || 'Sedan');
  const [vehicleMake,  setVehicleMake]  = useState(user?.vehicleMake  || '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel || '');
  const [vehicleYear,  setVehicleYear]  = useState(user?.vehicleYear  || '');
  const [serviceAddress, setServiceAddress] = useState(user?.homeAddress || '');
  const [notes, setNotes] = useState('');

  /* ── form status ─────────────────────────────────────────── */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  /* ── pricing ─────────────────────────────────────────────── */
  const multiplier  = VEHICLE_MULTIPLIERS[vehicleType] ?? 1;
  const baseTotal   = packages.reduce((sum, pp) => sum + (pp.packagePrice || 0) * multiplier, 0);
  const discountPct = plan?.discountPercent ?? 0;
  const discount    = Math.round(baseTotal * discountPct / 100 * 100) / 100;
  const finalTotal  = Math.round((baseTotal - discount) * 100) / 100;

  /* ── update helpers ──────────────────────────────────────── */
  const updateSel = (idx, patch) =>
    setSelections((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  /* ── submit ──────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    for (let i = 0; i < selections.length; i++) {
      if (!selections[i].date)     { setError(`Please select a date for package ${i + 1}.`); return; }
      if (!selections[i].timeSlot) { setError(`Please select a time slot for package ${i + 1}.`); return; }
    }
    if (!vehicleType) { setError('Please select a vehicle type.'); return; }
    if (!serviceAddress.trim()) { setError('Please enter a service address.'); return; }

    setSubmitting(true);
    try {
      await subscriptionsAPI.subscribe({ planId: plan.id });

      await subscriptionsAPI.createBookings({
        items: selections.map((s) => ({
          packageId:     s.packageId,
          scheduledDate: `${s.date}T12:00:00.000Z`,
          timeSlot:      s.timeSlot,
          notes:         notes || null,
        })),
        vehicleType,
        vehicleMake:    vehicleMake  || null,
        vehicleModel:   vehicleModel || null,
        vehicleYear:    vehicleYear  || null,
        serviceAddress: serviceAddress || null,
      });

      setSuccess('Subscription activated! Your service bookings are confirmed.');
      setTimeout(() => navigate('/my-subscription'), 2200);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!plan) {
    return <LoadingCircle fullScreen label="Loading checkout..." />;
  }

  const billingLabel = plan.billingCycle === 'Quarterly' ? '/qtr' : '/mo';

  return (
    <>
      <SEO title={`Subscribe — ${plan.name}`} />

      <div className="min-h-screen py-10 md:py-14"
        style={{ background: 'radial-gradient(circle at 12% 15%,rgba(200,169,107,0.06) 0%,transparent 38%),radial-gradient(circle at 88% 8%,rgba(14,165,160,0.05) 0%,transparent 32%)' }}>
        <div className="container mx-auto px-4 max-w-6xl">

          {/* ── Back ── */}
          <button type="button" onClick={() => navigate('/plans')}
            className="flex items-center gap-2 text-sm text-[var(--muted-color)] hover:text-primary transition mb-8">
            <ChevronLeft size={16} /> Back to Plans
          </button>

          {/* ── Page header ── */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="h-px w-10" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="uppercase tracking-[0.28em] text-primary text-[0.68rem] font-semibold">Subscription Checkout</p>
              <span className="h-px w-10" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-1">{plan.name}</h1>
            <p className="text-[var(--muted-color)] text-sm">Schedule your {packages.length} service{packages.length !== 1 ? 's' : ''} · apply dates &amp; times below</p>
          </div>

          {/* ── Status banners ── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-4 mb-6">
              <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/8 p-4 mb-6">
              <CheckCircle size={15} className="text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-green-400">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* ── LEFT COLUMN ─────────────────────────────── */}
              <div className="space-y-6">

                {/* ── Vehicle details ── */}
                <div className="glass-card p-6">
                  <SectionHeading icon={Car} step={1}>Vehicle Details</SectionHeading>
                  <div className="space-y-5">
                    <div>
                      <label className="sub-label">Vehicle Type *</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {VEHICLE_OPTIONS.map(v => (
                          <button key={v} type="button" onClick={() => setVehicleType(v)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            style={{
                              background: vehicleType === v ? 'rgba(200,169,107,0.15)' : 'transparent',
                              color:      vehicleType === v ? '#c8a96b' : 'var(--muted-color)',
                              border:     vehicleType === v ? '1px solid rgba(200,169,107,0.4)' : '1px solid var(--border-color)',
                            }}>
                            {v} {vehicleType === v && multiplier !== 1 ? `(×${VEHICLE_MULTIPLIERS[v]})` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="sub-label">Make</label>
                        <input type="text" className="sub-input" placeholder="Toyota" value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} />
                      </div>
                      <div>
                        <label className="sub-label">Model</label>
                        <input type="text" className="sub-input" placeholder="Camry" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} />
                      </div>
                      <div>
                        <label className="sub-label">Year</label>
                        <input type="text" className="sub-input" placeholder="2022" maxLength={4} value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="sub-label">Service Address *</label>
                      <AddressAutocompleteInput
                        value={serviceAddress}
                        onChange={setServiceAddress}
                        placeholder="Enter your address"
                        className="sub-input"
                      />
                    </div>
                    <div>
                      <label className="sub-label">Notes <span className="normal-case font-normal">(optional)</span></label>
                      <textarea rows={2} className="sub-input resize-none" placeholder="Gate code, parking instructions…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* ── Package schedules ── */}
                {packages.map((pp, idx) => (
                  <div key={`${pp.packageId}-${idx}`} className="glass-card p-6">
                    <SectionHeading icon={Calendar} step={idx + 2}>
                      Service {idx + 1}: {pp.packageName}
                    </SectionHeading>
                    <p className="text-xs text-[var(--muted-color)] -mt-3 mb-4 ml-12">
                      {formatQAR(pp.packagePrice * multiplier)}
                      {multiplier !== 1 && <span className="ml-1 opacity-70">({pp.packagePrice} × {multiplier})</span>}
                    </p>

                    <div className="grid md:grid-cols-[1fr_auto] gap-6">
                      <PackageCalendar
                        pkgId={pp.packageId}
                        selectedDate={selections[idx]?.date}
                        onSelectDate={(d) => updateSel(idx, { date: d, timeSlot: '' })}
                        calMonth={selections[idx]?.calMonth ?? new Date()}
                        onChangeMonth={(m) => updateSel(idx, { calMonth: m })}
                      />
                      <div className="min-w-0 md:w-56">
                        <label className="sub-label flex items-center gap-1.5"><Clock size={11} /> Time Slot</label>
                        <PackageSlots
                          pkgId={pp.packageId}
                          date={selections[idx]?.date}
                          selectedSlot={selections[idx]?.timeSlot}
                          onSelectSlot={(s) => updateSel(idx, { timeSlot: s })}
                        />
                      </div>
                    </div>

                    {selections[idx]?.date && selections[idx]?.timeSlot && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle size={14} />
                        <span className="font-medium">
                          {new Date(selections[idx].date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {selections[idx].timeSlot}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

              </div>

              {/* ── RIGHT SIDEBAR ────────────────────────────── */}
              <div className="lg:sticky lg:top-24 space-y-4">
                <div className="glass-card p-6">
                  {/* Plan badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)' }}>
                      <Crown size={16} style={{ color: '#c8a96b' }} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--heading-color)] text-base leading-tight">{plan.name}</p>
                      <p className="text-xs text-[var(--muted-color)]">{plan.vehicleType} · {plan.billingCycle}</p>
                    </div>
                  </div>
                  <div className="spectrum-line mb-4" />

                  {/* Package list */}
                  <div className="space-y-2 mb-4">
                    {packages.map((pp, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-[var(--muted-color)] mt-0.5 flex-shrink-0">{idx + 1}.</span>
                          <span className="text-[var(--text-color)] text-xs truncate">{pp.packageName}</span>
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-color)] flex-shrink-0">
                          {formatQAR(pp.packagePrice * multiplier)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing breakdown */}
                  <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-color)]">Subtotal</span>
                      <span className="text-[var(--text-color)] font-semibold">{formatQAR(baseTotal)}</span>
                    </div>
                    {discountPct > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1 text-green-400"><Tag size={11} /> {discountPct}% discount</span>
                        <span className="text-green-400 font-semibold">−{formatQAR(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--border-color)]">
                      <span className="text-[var(--heading-color)]">Total</span>
                      <span style={{ color: '#c8a96b' }}>{formatQAR(finalTotal)}<span className="text-xs font-semibold text-[var(--muted-color)]">{billingLabel}</span></span>
                    </div>
                    <p className="text-[10px] text-[var(--muted-color)] leading-relaxed">
                      Plan fee {formatQAR(plan.price)}{billingLabel} + {packages.length} scheduled service{packages.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Scheduling status */}
                  <div className="mt-4 space-y-1.5">
                    {packages.map((pp, idx) => {
                      const sel = selections[idx];
                      const done = sel?.date && sel?.timeSlot;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500/20' : 'bg-[var(--border-color)]'}`}>
                            {done
                              ? <CheckCircle size={10} className="text-green-400" />
                              : <span className="text-[8px] font-bold text-[var(--muted-color)]">{idx + 1}</span>}
                          </span>
                          <span className={done ? 'text-green-400' : 'text-[var(--muted-color)]'}>
                            {pp.packageName}: {done
                              ? `${new Date(sel.date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${sel.timeSlot}`
                              : 'Not scheduled'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <div className="cta-glow rounded-2xl">
                  <button type="submit" disabled={submitting || !!success}
                    className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                    {submitting
                      ? <><Loader size={16} className="animate-spin" /> Activating…</>
                      : 'Confirm Subscription'}
                  </button>
                </div>
                <p className="text-center text-[10px] text-[var(--muted-color)]">
                  You will be charged {formatQAR(plan.price)}{billingLabel}. Cancel anytime from your subscription page.
                </p>
              </div>

            </div>
          </form>
        </div>
      </div>
    </>
  );
}


