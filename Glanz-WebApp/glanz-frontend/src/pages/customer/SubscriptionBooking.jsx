import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, CheckCircle,
  ArrowRight, Package, Clock, AlertCircle, ArrowLeft,
  Loader, Star, RefreshCw,
} from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { packagesAPI } from '../../api/packages';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function StepDot({ n, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
        ${done ? 'bg-green-500 text-white' : active ? 'text-white' : 'text-[var(--muted-color)]'}`}
        style={active ? { background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)' } : done ? {} : { background: 'rgba(255,255,255,.06)', border: '1px solid var(--border-color)' }}>
        {done ? <CheckCircle size={14} /> : n}
      </div>
    </div>
  );
}

export default function SubscriptionBooking() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [step, setStep] = useState(1);
  const [sub, setSub] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [dayColors, setDayColors] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [mySubRes, pkgsRes] = await Promise.all([
          subscriptionsAPI.getMy().catch(() => null),
          packagesAPI.getAll(lang),
        ]);
        setSub(mySubRes ?? null);
        const active = (pkgsRes || []).filter(p => p.isActive);
        setPackages(active);
        if (active.length === 1) setSelectedPkg(active[0]);
      } catch (e) {
        setError('Failed to load subscription data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [lang]);

  useEffect(() => {
    if (step === 2) loadAvailability(calMonth, calYear);
  }, [step, calMonth, calYear]);

  const loadAvailability = async (m, y) => {
    setLoadingAvail(true);
    try {
      const data = await subscriptionsAPI.getAvailability({ month: m + 1, year: y });
      const map = {};
      (data || []).forEach(d => { map[d.date] = d.color; });
      setDayColors(map);
    } catch {
      setDayColors({});
    } finally {
      setLoadingAvail(false);
    }
  };

  const selectDate = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setCalendarError('');
    setLoadingSlots(true);
    try {
      const data = await subscriptionsAPI.getSlots({ date: dateStr });
      setSlots(data || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPkg || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await subscriptionsAPI.createBooking({
        packageId: selectedPkg.id,
        scheduledDate: new Date(selectedDate + 'T00:00:00Z').toISOString(),
        timeSlot: selectedSlot,
        notes,
      });
      setSuccess(result);
      setStep(4);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to create booking. Please try again.';
      const isSlotConflict = /slot|unavailable|conflict|booked/i.test(msg);
      if (isSlotConflict) {
        setCalendarError(msg);
        setSelectedSlot('');
        setStep(2);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const total = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    const days = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= total; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      days.push({ d, dateStr, color: dayColors[dateStr] || 'green', isPast });
    }
    return days;
  })();

  const retryFetch = async () => {
    setError('');
    setLoading(true);
    try {
      const [mySubRes, pkgsRes] = await Promise.all([
        subscriptionsAPI.getMy().catch(() => null),
        packagesAPI.getAll(lang),
      ]);
      setSub(mySubRes ?? null);
      const active = (pkgsRes || []).filter(p => p.isActive);
      setPackages(active);
      if (active.length === 1) setSelectedPkg(active[0]);
    } catch (e) {
      setError('Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen py-16" style={{ background: 'var(--surface-bg)' }}>
      <div className="container mx-auto px-4 max-w-md">
        <Skeleton variant="text" className="w-32 h-8 mx-auto mb-8" />
        <Skeleton variant="card" className="h-80" />
      </div>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title="Failed to load" description={error} actionLabel="Try Again" onAction={retryFetch} />
      </div>
    );
  }

  // ── No subscription ────────────────────────────────────────────────────
  if (!sub) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-10 text-center max-w-sm w-full">
        <AlertCircle size={40} className="mx-auto mb-3 text-amber-400" />
        <h2 className="font-bold text-xl text-[var(--heading-color)] mb-2">No Active Subscription</h2>
        <p className="text-[var(--muted-color)] text-sm mb-6">You need an active subscription to book with a discount.</p>
        <Link to="/plans"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
          Browse Plans <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );

  const colorDot = {
    green:  { bg: '#10b981', label: 'Available' },
    yellow: { bg: '#f59e0b', label: 'Filling up' },
    red:    { bg: '#ef4444', label: 'Nearly full' },
  };

  const discountPct = sub.discountPercent || 0;
  const originalPrice = selectedPkg ? (selectedPkg.price || 0) : 0;
  const discountAmt = Math.round(originalPrice * discountPct / 100 * 100) / 100;
  const finalPrice = originalPrice - discountAmt;

  return (
    <div className="min-h-screen py-14 px-4" style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
      <div className="container mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
            <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Subscription</p>
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
          </div>
          <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-1">Book a Session</h1>
          <p className="text-[var(--muted-color)] text-sm">{sub.planName} Plan · {discountPct}% off every booking</p>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center gap-3 mb-8">
            <StepDot n={1} active={step === 1} done={step > 1} />
            <div className="flex-1 h-px" style={{ background: step > 1 ? 'linear-gradient(90deg,#10b981,#0ea5a0)' : 'var(--border-color)' }} />
            <StepDot n={2} active={step === 2} done={step > 2} />
            <div className="flex-1 h-px" style={{ background: step > 2 ? 'linear-gradient(90deg,#10b981,#0ea5a0)' : 'var(--border-color)' }} />
            <StepDot n={3} active={step === 3} done={step > 3} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
            <AlertCircle size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {/* ── STEP 1: Package ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-[var(--heading-color)] text-lg mb-1">Select a Package</h2>
            <p className="text-[var(--muted-color)] text-sm mb-4">Your {discountPct}% discount will be applied at checkout.</p>
            {packages.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Package size={36} className="mx-auto mb-3 opacity-40 text-[var(--muted-color)]" />
                <p className="text-[var(--muted-color)] text-sm">No packages available at the moment.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {packages.map(pkg => (
                  <button key={pkg.id} onClick={() => setSelectedPkg(pkg)}
                    className={`glass-card p-5 text-left transition-all w-full ${selectedPkg?.id === pkg.id ? 'ring-1' : 'hover:opacity-90'}`}
                    style={selectedPkg?.id === pkg.id ? { ringColor: '#c8a96b', boxShadow: '0 0 0 1.5px #c8a96b44', borderColor: '#c8a96b44' } : {}}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: selectedPkg?.id === pkg.id ? 'rgba(200,169,107,.15)' : 'rgba(255,255,255,.04)', border: '1px solid var(--border-color)' }}>
                          <Star size={15} style={{ color: selectedPkg?.id === pkg.id ? '#c8a96b' : 'var(--muted-color)' }} />
                        </div>
                        <div>
                          <p className="font-bold text-[var(--heading-color)]">{pkg.name}</p>
                          <p className="text-xs text-[var(--muted-color)]">{pkg.vehicleType} · {pkg.durationMinutes ? `${pkg.durationMinutes} min` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs line-through text-[var(--muted-color)]">{formatQAR(pkg.price)}</p>
                        <p className="font-bold text-sm" style={{ color: '#10b981' }}>{formatQAR(pkg.price - Math.round(pkg.price * discountPct / 100 * 100) / 100)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={() => setStep(2)} disabled={!selectedPkg}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
                Next: Choose Date <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Calendar ── */}
        {step === 2 && (
          <div className="space-y-5">
            {calendarError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 flex items-start gap-2">
                <AlertCircle size={15} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-300">{calendarError} Please choose a different date or time.</p>
              </div>
            )}
            <div className="glass-card p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => {
                  const d = new Date(calYear, calMonth - 1);
                  setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
                }} className="p-2 rounded-lg hover:bg-white/5 transition text-[var(--muted-color)]">
                  <ChevronLeft size={18} />
                </button>
                <p className="font-bold text-[var(--heading-color)]">{MONTH_NAMES[calMonth]} {calYear}</p>
                <button onClick={() => {
                  const d = new Date(calYear, calMonth + 1);
                  setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
                }} className="p-2 rounded-lg hover:bg-white/5 transition text-[var(--muted-color)]">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_NAMES.map(d => (
                  <p key={d} className="text-center text-[10px] font-bold text-[var(--muted-color)] uppercase">{d}</p>
                ))}
              </div>

              {/* Calendar grid */}
              {loadingAvail ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader size={24} className="animate-spin text-[var(--muted-color)]" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((day, i) => !day ? (
                    <div key={`empty-${i}`} />
                  ) : (
                    <button
                      key={day.dateStr}
                      disabled={day.isPast}
                      onClick={() => selectDate(day.dateStr)}
                      className={`relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-semibold transition-all
                        ${day.isPast ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}
                        ${selectedDate === day.dateStr ? 'ring-1 ring-[#c8a96b] bg-[rgba(200,169,107,.1)]' : ''}
                      `}
                      style={{ minHeight: '44px' }}>
                      <span className={selectedDate === day.dateStr ? 'text-[#c8a96b] font-bold' : 'text-[var(--text-color)]'}>
                        {day.d}
                      </span>
                      {!day.isPast && (
                        <span className="mt-0.5 w-2 h-2 rounded-full"
                          style={{ background: (colorDot[day.color] || colorDot.green).bg }} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border-color)]">
                {Object.entries(colorDot).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.bg }} />
                    <span className="text-xs text-[var(--muted-color)]">{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={15} style={{ color: '#c8a96b' }} />
                  <p className="font-bold text-[var(--heading-color)] text-sm">
                    Available Slots — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                {loadingSlots ? (
                  <div className="flex justify-center py-6"><Loader size={20} className="animate-spin text-[var(--muted-color)]" /></div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map(s => (
                      <button key={s.slot} disabled={!s.available}
                        onClick={() => setSelectedSlot(s.slot)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all text-center
                          ${!s.available ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}
                          ${selectedSlot === s.slot ? 'ring-1 ring-[#c8a96b]' : ''}`}
                        style={{
                          background: !s.available ? 'rgba(239,68,68,.1)' :
                            selectedSlot === s.slot ? 'rgba(200,169,107,.18)' : 'rgba(255,255,255,.04)',
                          border: '1px solid var(--border-color)',
                          color: !s.available ? '#ef4444' : selectedSlot === s.slot ? '#c8a96b' : 'var(--text-color)',
                        }}>
                        {s.slot.split('-')[0]}
                        {!s.available && <span className="block text-[9px] mt-0.5">Full</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-[var(--muted-color)] hover:text-[var(--text-color)] transition">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedSlot}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
                Next: Confirm <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="glass-card p-6">
              <h2 className="font-bold text-[var(--heading-color)] text-lg mb-5">Booking Summary</h2>
              <div className="space-y-3.5">
                <Row label="Package" value={selectedPkg?.name} />
                <Row label="Plan" value={`${sub.planName} (${discountPct}% off)`} />
                <Row label="Date" value={selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <Row label="Time" value={selectedSlot?.split('-')[0] || '—'} />
                <div className="border-t border-[var(--border-color)] my-2" />
                <Row label="Original Price" value={formatQAR(originalPrice)} />
                {discountPct > 0 && <Row label={`Discount (${discountPct}%)`} value={`-${formatQAR(discountAmt)}`} valueColor="#10b981" />}
                <Row label="You Pay" value={formatQAR(finalPrice)} bold />
              </div>

              {selectedDate && (
                <div className="mt-5 rounded-xl border border-[var(--border-color)] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-color)] mb-3">Upcoming Schedule</p>
                  <div className="space-y-1.5">
                    {[0, 7, 14, 21].map((offset) => {
                      const d = new Date(selectedDate + 'T00:00:00');
                      d.setDate(d.getDate() + offset);
                      return (
                        <div key={offset} className="flex items-center gap-3 text-sm">
                          <span className={`w-16 text-[10px] font-bold uppercase tracking-wide ${offset === 0 ? 'text-primary' : 'text-[var(--muted-color)]'}`}>
                            {offset === 0 ? 'Week 1' : `Week ${offset / 7 + 1}`}
                          </span>
                          <span className={offset === 0 ? 'text-[var(--heading-color)] font-semibold' : 'text-[var(--text-color)]'}>
                            {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-[var(--muted-color)] text-xs">{selectedSlot?.split('-')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <label className="block text-xs text-[var(--muted-color)] mb-1.5">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any special requests?"
                  className="w-full bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-primary resize-none placeholder-[var(--muted-color)]" />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-[var(--muted-color)] hover:text-[var(--text-color)] transition">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleConfirm} disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
                {submitting ? <><Loader size={14} className="animate-spin" /> Booking…</> : <>Confirm Booking <CheckCircle size={14} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Success ── */}
        {step === 4 && success && (
          <div className="glass-card p-10 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)' }}>
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="font-bold text-2xl text-[var(--heading-color)] mb-2">Booking Confirmed!</h2>
            <p className="text-[var(--muted-color)] text-sm mb-1">Booking number</p>
            <p className="font-mono font-bold text-lg text-primary mb-6">{success.bookingNumber}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/my-subscription')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
                My Subscription <ArrowRight size={14} />
              </button>
              <Link to="/my-bookings"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                View All Bookings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, bold }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[var(--muted-color)] text-sm">{label}</p>
      <p className={`text-sm ${bold ? 'font-black text-base text-[var(--heading-color)]' : 'font-semibold text-[var(--text-color)]'}`}
        style={valueColor ? { color: valueColor } : {}}>
        {value || '—'}
      </p>
    </div>
  );
}
