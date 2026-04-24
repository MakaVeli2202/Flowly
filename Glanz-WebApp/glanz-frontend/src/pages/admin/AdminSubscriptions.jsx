import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, CheckCircle, Edit2, Plus, Power, Trash2, X, Lock, Repeat } from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { formatQAR } from '../../utils/currency';
import AppModal from '../../components/shared/AppModal';

/* ── Constants ────────────────────────────────────────────── */
const frequencyOptions = [
  { value: 'Weekly',   label: 'Weekly'        },
  { value: 'BiWeekly', label: 'Every 2 Weeks'  },
  { value: 'Monthly',  label: 'Monthly'        },
];

const toDateInputValue = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const frequencyLabelMap = {
  Weekly:   'Weekly',
  BiWeekly: 'Every 2 Weeks',
  Monthly:  'Monthly',
};

/* ── Pure display helpers ─────────────────────────────────── */
const FREQ_STYLES = {
  Weekly:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.28)'  },
  BiWeekly: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.28)'  },
  Monthly:  { color: '#0ea5a0', bg: 'rgba(14,165,160,0.10)', border: 'rgba(14,165,160,0.28)'  },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = toDateInputValue(iso);
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
};

/* ── PRISM CSS ────────────────────────────────────────────── */
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
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.42),  0 0 22px rgba(255,165,0,.15); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.42),  0 0 22px rgba(160,0,255,.15); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.42),  0 0 22px rgba(255,0,100,.15); }
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
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.card-stagger   { animation: card-enter 0.52s cubic-bezier(0.22,1,0.36,1) both; }
.field-input {
  width: 100%; padding: 10px 14px; border-radius: 12px;
  border: 1px solid var(--border-color); background: var(--surface-bg);
  color: var(--text-color); font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s; outline: none; resize: none;
}
.field-input:focus { border-color: rgba(200,169,107,0.65); box-shadow: 0 0 0 3px rgba(200,169,107,0.12); }
.field-input:disabled { opacity: 0.45; cursor: not-allowed; }
.field-label {
  display: block; font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.20em; text-transform: uppercase; color: var(--muted-color); margin-bottom: 7px;
}
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

function FormField({ label, children }) {
  return <div><label className="field-label">{label}</label>{children}</div>;
}

function FormDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-[var(--border-color)]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{label}</p>
      <div className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MANAGE SUBSCRIPTIONS
════════════════════════════════════════════════════════════ */
function ManageSubscriptions() {
  /* ── State & logic: identical to original ────────────────── */
  const [loading,              setLoading]              = useState(true);
  const [saving,               setSaving]               = useState(false);
  const [modal,                setModal]                = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
  const [subscriptions,        setSubscriptions]        = useState([]);
  const [options,              setOptions]              = useState({ customers: [], packages: [] });
  const [error,                setError]                = useState('');
  const [success,              setSuccess]              = useState('');
  const [showForm,             setShowForm]             = useState(false);
  const [editingSubscription,  setEditingSubscription]  = useState(null);

  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open: true, title, message, variant, onConfirm });
  const closeModal = () => setModal((m) => ({ ...m, open: false, onConfirm: null }));

  const [formData, setFormData] = useState({
    userId: '', packageId: '', frequency: 'Weekly',
    startDate: toDateInputValue(new Date().toISOString()),
    endDate: '', pricePerCycle: '', notes: '', isActive: true,
  });

  useEffect(() => { fetchData(); }, []);

  const packageById = useMemo(() => {
    const map = new Map();
    (options.packages || []).forEach((pkg) => map.set(Number(pkg.id), pkg));
    return map;
  }, [options.packages]);

  const fetchData = async () => {
    setLoading(true); setError('');
    const [subscriptionsResult, optionsResult] = await Promise.allSettled([
      subscriptionsAPI.getAll(),
      subscriptionsAPI.getOptions(),
    ]);
    if (subscriptionsResult.status === 'fulfilled') {
      setSubscriptions(subscriptionsResult.value || []);
    } else { setSubscriptions([]); }
    if (optionsResult.status === 'fulfilled') {
      setOptions(optionsResult.value || { customers: [], packages: [] });
    } else { setOptions({ customers: [], packages: [] }); }
    if (subscriptionsResult.status === 'rejected' && optionsResult.status === 'rejected') {
      const subError = subscriptionsResult.reason?.response?.data?.message || subscriptionsResult.reason?.message;
      const optError = optionsResult.reason?.response?.data?.message || optionsResult.reason?.message;
      setError(subError || optError || 'Failed to load subscriptions data. Please refresh or try again later.');
    } else if (subscriptionsResult.status === 'rejected') {
      setError(subscriptionsResult.reason?.response?.data?.message || subscriptionsResult.reason?.message || 'Subscriptions list failed to load.');
    } else if (optionsResult.status === 'rejected') {
      setError(optionsResult.reason?.response?.data?.message || optionsResult.reason?.message || 'Form options failed to load. Please refresh.');
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      userId: '', packageId: '', frequency: 'Weekly',
      startDate: toDateInputValue(new Date().toISOString()),
      endDate: '', pricePerCycle: '', notes: '', isActive: true,
    });
    setEditingSubscription(null); setShowForm(false);
  };

  const handlePackageChange = (packageIdValue) => {
    const packageId = Number(packageIdValue);
    const selectedPackage = packageById.get(packageId);
    setFormData((prev) => ({
      ...prev, packageId: packageIdValue,
      pricePerCycle: selectedPackage ? String(selectedPackage.price) : prev.pricePerCycle,
    }));
  };

  const handleEdit = (subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      userId: String(subscription.userId),
      packageId: String(subscription.packageId),
      frequency: subscription.frequency,
      startDate: toDateInputValue(subscription.startDate),
      endDate: toDateInputValue(subscription.endDate),
      pricePerCycle: String(subscription.pricePerCycle ?? ''),
      notes: subscription.notes || '',
      isActive: !!subscription.isActive,
    });
    setShowForm(true); setError(''); setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setSuccess('');
    if (!editingSubscription && !formData.userId) { setError('Please select a customer.'); return; }
    if (!formData.packageId || !formData.startDate || !formData.frequency) {
      setError('Please fill package, frequency, and start date.'); return;
    }
    const pricePerCycle = Number(formData.pricePerCycle);
    if (!Number.isFinite(pricePerCycle) || pricePerCycle < 0) {
      setError('Price per cycle must be a valid number.'); return;
    }
    const payload = {
      packageId: Number(formData.packageId), frequency: formData.frequency,
      startDate: `${formData.startDate}T00:00:00.000Z`,
      endDate: formData.endDate ? `${formData.endDate}T00:00:00.000Z` : null,
      pricePerCycle, notes: formData.notes?.trim() || null, isActive: !!formData.isActive,
    };
    try {
      setSaving(true);
      if (editingSubscription) {
        await subscriptionsAPI.update(editingSubscription.id, payload);
        setSuccess('Subscription updated successfully.');
      } else {
        await subscriptionsAPI.create({ ...payload, userId: Number(formData.userId) });
        setSuccess('Subscription created successfully.');
      }
      resetForm(); await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save subscription.');
    } finally { setSaving(false); }
  };

  const handleDelete = (id, code) => {
    showConfirm('Delete Subscription',
      `Are you sure you want to delete subscription "${code}"? This cannot be undone.`, 'danger',
      async () => {
        closeModal();
        try {
          setError(''); setSuccess('');
          await subscriptionsAPI.delete(id);
          setSuccess('Subscription deleted successfully.');
          await fetchData();
        } catch (err) { setError(err.response?.data?.message || 'Failed to delete subscription.'); }
      }
    );
  };

  const handleToggleActive = (subscription) => {
    const action = subscription.isActive ? 'deactivate' : 'activate';
    showConfirm(
      `${subscription.isActive ? 'Deactivate' : 'Activate'} Subscription`,
      `Are you sure you want to ${action} subscription "${subscription.code}"?`,
      subscription.isActive ? 'warning' : 'info',
      async () => {
        closeModal();
        try {
          setError(''); setSuccess('');
          if (subscription.isActive) {
            await subscriptionsAPI.deactivate(subscription.id);
            setSuccess('Subscription deactivated successfully.');
          } else {
            await subscriptionsAPI.activate(subscription.id);
            setSuccess('Subscription activated successfully.');
          }
          await fetchData();
        } catch (err) { setError(err.response?.data?.message || 'Failed to update subscription status.'); }
      }
    );
  };

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-[var(--muted-color)] text-sm">Loading subscriptions…</p>
      </div>
    </>
  );

  const formAccent = editingSubscription ? '#0ea5a0' : '#c8a96b';
  const inp = 'field-input';

  /* ── RENDER ──────────────────────────────────────────────── */
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
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Header ─────────────────────────────── */}
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
                  <Repeat size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Manage Subscriptions</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Create and manage recurring weekly, biweekly and monthly plans</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button"
                onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? 'Close Form' : 'Add Subscription'}
              </button>
            </div>
          </div>

          {/* ── Alerts ─────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300"><X size={14} /></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-4">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm font-semibold">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300"><X size={14} /></button>
            </div>
          )}

          {/* ── Form ───────────────────────────────── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
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
                        {editingSubscription ? 'Edit Mode' : 'New Subscription'}
                      </p>
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, ${formAccent}, transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editingSubscription ? `Editing: ${editingSubscription.code}` : 'Create Subscription'}
                    </h2>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 transition">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-5"><div className="spectrum-line" /></div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <FormDivider label="Customer & Package" />

                  <div className="grid md:grid-cols-2 gap-5">
                    {/* Customer */}
                    <div>
                      <FormField label="Customer *">
                        <select
                          value={formData.userId}
                          onChange={(e) => setFormData((prev) => ({ ...prev, userId: e.target.value }))}
                          required disabled={!!editingSubscription}
                          className={inp}
                        >
                          <option value="">Select customer</option>
                          {(options.customers || []).map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name} ({customer.email})
                            </option>
                          ))}
                        </select>
                      </FormField>
                      {editingSubscription && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Lock size={11} className="text-[var(--muted-color)]" />
                          <p className="text-[11px] text-[var(--muted-color)]">Customer cannot be changed for existing subscriptions.</p>
                        </div>
                      )}
                    </div>

                    {/* Package */}
                    <FormField label="Package *">
                      <select
                        value={formData.packageId}
                        onChange={(e) => handlePackageChange(e.target.value)}
                        required className={inp}
                      >
                        <option value="">Select package</option>
                        {(options.packages || []).map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} ({formatQAR(pkg.price)})
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <FormDivider label="Schedule & Pricing" />

                  <div className="grid md:grid-cols-2 gap-5">
                    {/* Frequency */}
                    <FormField label="Frequency *">
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData((prev) => ({ ...prev, frequency: e.target.value }))}
                        required className={inp}
                      >
                        {frequencyOptions.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </FormField>

                    {/* Price Per Cycle */}
                    <FormField label="Price Per Cycle (QAR) *">
                      <input type="number" step="0.01" min="0"
                        value={formData.pricePerCycle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pricePerCycle: e.target.value }))}
                        required className={inp} placeholder="0.00" />
                    </FormField>

                    {/* Start Date */}
                    <FormField label="Start Date *">
                      <input type="date" value={formData.startDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                        required className={inp} />
                    </FormField>

                    {/* End Date */}
                    <FormField label="End Date (Optional)">
                      <input type="date" value={formData.endDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                        className={inp} />
                    </FormField>
                  </div>

                  <FormDivider label="Details" />

                  {/* Notes */}
                  <FormField label="Notes">
                    <textarea rows={3} value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      className={inp} placeholder="Any internal notes for this subscription…" />
                  </FormField>

                  {/* isActive toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)]"
                    style={{ background: formData.isActive ? 'rgba(14,165,160,0.04)' : 'transparent', borderColor: formData.isActive ? 'rgba(14,165,160,0.28)' : undefined }}>
                    <div>
                      <p className="text-sm font-bold text-[var(--heading-color)]">Subscription Active</p>
                      <p className="text-xs text-[var(--muted-color)] mt-0.5">When enabled, recurring bookings will be generated automatically.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, isActive: !p.isActive }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${formData.isActive ? 'bg-primary' : 'bg-[var(--border-color)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Submit / Cancel */}
                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit" disabled={saving}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60">
                        <CheckCircle size={14} />
                        {saving ? 'Saving…' : (editingSubscription ? 'Update Subscription' : 'Create Subscription')}
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

          {/* ── Subscriptions table ─────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.06s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #c8a96b44 60%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '62%', width: '13%', animation: 'prism-ray-sweep 22s ease-in-out 5s infinite' }} />

            <div className="px-7 pt-6 pb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Subscriptions</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)', color: '#c8a96b' }}>
                  {subscriptions.length} plan{subscriptions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="mb-4"><div className="spectrum-line" /></div>
            </div>

            <div className="overflow-x-auto pb-2">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {['Code', 'Customer', 'Package', 'Frequency', 'Cycle Price', 'Start Date', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-14">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)' }}>
                            <Repeat size={24} style={{ color: '#c8a96b' }} />
                          </div>
                          <p className="text-sm font-bold text-[var(--heading-color)]">No subscriptions yet</p>
                          <p className="text-xs text-[var(--muted-color)]">Create your first recurring plan using the form above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((subscription) => {
                      const fs = FREQ_STYLES[subscription.frequency] || FREQ_STYLES.Monthly;
                      return (
                        <tr key={subscription.id} className="hover:bg-white/[0.015] transition">
                          {/* Code */}
                          <td className="px-5 py-4">
                            <span className="text-[11px] font-black font-mono px-2.5 py-1 rounded-lg"
                              style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)', color: '#c8a96b' }}>
                              {subscription.code}
                            </span>
                          </td>
                          {/* Customer */}
                          <td className="px-5 py-4">
                            <p className="font-bold text-sm text-[var(--heading-color)]">{subscription.customerName}</p>
                            <p className="text-[11px] text-[var(--muted-color)] mt-0.5">{subscription.customerEmail}</p>
                          </td>
                          {/* Package */}
                          <td className="px-5 py-4 text-sm font-semibold text-[var(--text-color)]">{subscription.packageName}</td>
                          {/* Frequency */}
                          <td className="px-5 py-4">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: fs.bg, border: `1px solid ${fs.border}`, color: fs.color }}>
                              {frequencyLabelMap[subscription.frequency] || subscription.frequency}
                            </span>
                          </td>
                          {/* Cycle Price */}
                          <td className="px-5 py-4">
                            <span className="text-sm font-black text-primary">{formatQAR(subscription.pricePerCycle)}</span>
                          </td>
                          {/* Start Date */}
                          <td className="px-5 py-4 text-sm text-[var(--muted-color)]">{fmtDate(subscription.startDate)}</td>
                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              subscription.isActive
                                ? 'bg-green-500/10 border border-green-400/30 text-green-400'
                                : 'bg-[var(--border-color)]/20 border border-[var(--border-color)] text-[var(--muted-color)]'
                            }`}>
                              {subscription.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => handleEdit(subscription)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition"
                                title="Edit">
                                <Edit2 size={11} /> Edit
                              </button>
                              <button type="button" onClick={() => handleToggleActive(subscription)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                                  subscription.isActive
                                    ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/8'
                                    : 'border-green-500/30 text-green-400 hover:bg-green-500/8'
                                }`}
                                title={subscription.isActive ? 'Deactivate' : 'Activate'}>
                                <Power size={11} />
                                {subscription.isActive ? 'Pause' : 'Activate'}
                              </button>
                              <button type="button" onClick={() => handleDelete(subscription.id, subscription.code)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition"
                                title="Delete">
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <AppModal
        isOpen={modal.open} title={modal.title} message={modal.message}
        variant={modal.variant} confirmLabel="Confirm"
        onConfirm={modal.onConfirm} onClose={closeModal}
      />
    </>
  );
}

export default ManageSubscriptions;