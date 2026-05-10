import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle, Edit2, Plus, Power, Trash2, X,
  Zap, Star, Crown, ChevronDown, ChevronUp, GripVertical,
} from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { useLanguage } from '../../context/LanguageContext';
import { packagesAPI } from '../../api/packages';
import { formatQAR } from '../../utils/currency';
import AppModal from '../../components/shared/AppModal';

/* ── Constants ──────────────────────────────────────────────── */
const VEHICLE_OPTIONS = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];
const BILLING_OPTIONS = ['Monthly', 'Quarterly'];

const VEHICLE_META = {
  Motorcycle: { label: 'Motorcycle', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.28)', Icon: Zap },
  Sedan:      { label: 'Sedan',      color: '#c8a96b', bg: 'rgba(200,169,107,0.12)', border: 'rgba(200,169,107,0.28)', Icon: Star },
  SUV:        { label: 'SUV',        color: '#0ea5a0', bg: 'rgba(14,165,160,0.12)',  border: 'rgba(14,165,160,0.28)',  Icon: Crown },
  Pickup:     { label: 'Pickup',     color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.28)', Icon: Crown },
};

/* ── CSS injected once ──────────────────────────────────────── */
const PAGE_CSS = `
@keyframes holo-sweep { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
@keyframes prism-ray-sweep {
  0%{transform:translateX(-130%) skewX(-15deg);opacity:0}
  10%{opacity:1} 90%{opacity:1}
  100%{transform:translateX(460%) skewX(-15deg);opacity:0}
}
@keyframes card-enter { from{transform:translateY(14px) scale(0.988);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
@keyframes cta-rainbow-glow {
  0%,100%{box-shadow:0 0 0 1.5px rgba(255,80,80,.42),0 0 22px rgba(255,165,0,.15)}
  33%{box-shadow:0 0 0 1.5px rgba(0,200,255,.42),0 0 22px rgba(160,0,255,.15)}
  66%{box-shadow:0 0 0 1.5px rgba(0,255,120,.42),0 0 22px rgba(255,0,100,.15)}
}
.prism-ray {
  position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);
  background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%);
}
.spectrum-line {
  height:1.5px;
  background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);
  background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:0.40;
}
.cta-prism-glow{animation:cta-rainbow-glow 5s ease-in-out infinite}
.card-stagger{animation:card-enter 0.52s cubic-bezier(0.22,1,0.36,1) both}
.plan-field-input {
  width:100%;padding:10px 14px;border-radius:12px;
  border:1px solid var(--border-color);background:var(--surface-bg);
  color:var(--text-color);font-size:0.875rem;
  transition:border-color 0.2s,box-shadow 0.2s;outline:none;
}
.plan-field-input:focus{border-color:rgba(200,169,107,0.65);box-shadow:0 0 0 3px rgba(200,169,107,0.12)}
.plan-field-input:disabled{opacity:0.45;cursor:not-allowed}
.plan-field-label{display:block;font-size:0.68rem;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

/* ── Feature list editor ────────────────────────────────────── */
function FeatureListEditor({ features, onChange }) {
  const addFeature = () => onChange([...features, '']);
  const removeFeature = (i) => onChange(features.filter((_, idx) => idx !== i));
  const updateFeature = (i, val) => onChange(features.map((f, idx) => idx === i ? val : f));

  return (
    <div className="space-y-2">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <GripVertical size={13} className="text-[var(--muted-color)] flex-shrink-0 cursor-grab" />
          <input
            type="text" value={f}
            onChange={(e) => updateFeature(i, e.target.value)}
            placeholder={`Feature ${i + 1}`}
            className="plan-field-input flex-1"
          />
          <button type="button" onClick={() => removeFeature(i)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-rose-500/25 text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0">
            <X size={11} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addFeature}
        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition mt-1">
        <Plus size={12} /> Add feature bullet
      </button>
    </div>
  );
}

/* ── Toggle switch ──────────────────────────────────────────── */
function Toggle({ value, onChange, label, sublabel }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold text-[var(--heading-color)]">{label}</p>
        {sublabel && <p className="text-xs text-[var(--muted-color)]">{sublabel}</p>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-primary' : 'bg-[var(--border-color)]'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}


const BLANK_FORM = {
  name: '', vehicleType: 'Sedan', billingCycle: 'Monthly',
  price: '', discountPercent: 0, isPopular: false, isActive: true, displayOrder: 0,
  features: [], benefits: [], packageIds: [],
};

function planToForm(p) {
  return {
    name:           p.name || '',
    vehicleType:    p.vehicleType || 'Sedan',
    billingCycle:   p.billingCycle || 'Monthly',
    price:          String(p.price ?? ''),
    discountPercent: p.discountPercent ?? 0,
    isPopular:      !!p.isPopular,
    isActive:       p.isActive !== false,
    displayOrder:   p.displayOrder ?? 0,
    features:       Array.isArray(p.features) ? p.features.map(f => typeof f === 'string' ? f : f.featureText) : [],
    benefits:       Array.isArray(p.benefits)  ? p.benefits.map(b  => typeof b  === 'string' ? b  : b.benefitText)  : [],
    packageIds: Array.isArray(p.planPackages)
      ? p.planPackages.sort((a, b) => a.displayOrder - b.displayOrder).map(pp => pp.packageId)
      : [],
  };
}

/* ════════════════════════════════════════════════════════════
   ADMIN PLANS PAGE
════════════════════════════════════════════════════════════ */
function AdminPlans() {
  const { t } = useLanguage();
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [plans,     setPlans]     = useState([]);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [formData,  setFormData]  = useState(BLANK_FORM);
  const [expanded,  setExpanded]  = useState(null);
  const [allPackages, setAllPackages] = useState([]);
  const [modal, setModal] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });

  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open: true, title, message, variant, onConfirm });
  const closeModal = () => setModal((m) => ({ ...m, open: false, onConfirm: null }));

  const set = (key, val) => setFormData((p) => ({ ...p, [key]: val }));

  useEffect(() => { fetchPlans(); }, []);

  useEffect(() => {
    packagesAPI.getAllAdmin().then((data) => setAllPackages(data || [])).catch(() => {});
  }, []);

  const fetchPlans = async () => {
    setLoading(true); setError('');
    try {
      const data = await subscriptionsAPI.getAllPlans();
      setPlans(data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load plans.');
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData(BLANK_FORM);
    setEditing(null); setShowForm(false);
    setError(''); setSuccess('');
  };

  const handleEdit = (plan) => {
    setEditing(plan);
    setFormData(planToForm(plan));
    setShowForm(true); setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!formData.name.trim()) { setError('Plan name is required.'); return; }
    if (formData.packageIds.length === 0) { setError('Add at least one package to calculate the price.'); return; }
    const base = formData.packageIds.reduce((sum, id) => {
      const pkg = allPackages.find(p => p.id === id);
      return sum + (pkg ? Number(pkg.price) : 0);
    }, 0);
    const disc = Number(formData.discountPercent) || 0;
    const price = Math.round(base * (1 - disc / 100) * 100) / 100;
    if (price <= 0) { setError('Computed price must be greater than 0.'); return; }

    const payload = {
      name:            formData.name.trim(),
      vehicleType:     formData.vehicleType,
      billingCycle:    formData.billingCycle,
      price,
      discountPercent: Number(formData.discountPercent) || 0,
      isPopular:       formData.isPopular,
      isActive:        formData.isActive,
      displayOrder:    Number(formData.displayOrder) || 0,
      features:        formData.features.filter(f => f.trim()),
      benefits:        formData.benefits.filter(b => b.trim()),
      packageIds: formData.packageIds,
    };

    try {
      setSaving(true);
      if (editing) {
        await subscriptionsAPI.updatePlan(editing.id, payload);
        setSuccess('Plan updated successfully.');
      } else {
        await subscriptionsAPI.createPlan(payload);
        setSuccess('Plan created successfully.');
      }
      resetForm(); await fetchPlans();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save plan.');
    } finally { setSaving(false); }
  };

  const handleDelete = (plan) => {
    showConfirm(
      'Delete Plan',
      `Delete "${plan.name}"? If customers are subscribed, it will be deactivated instead of deleted.`,
      'danger',
      async () => {
        closeModal();
        try {
          setError(''); setSuccess('');
          const result = await subscriptionsAPI.deletePlan(plan.id);
          setSuccess(result.message || 'Plan removed.');
          await fetchPlans();
        } catch (e) { setError(e.response?.data?.message || 'Failed to delete plan.'); }
      }
    );
  };

  const handleToggleActive = (plan) => {
    const dto = planToForm(plan);
    dto.isActive = !plan.isActive;
    showConfirm(
      `${plan.isActive ? 'Deactivate' : 'Activate'} Plan`,
      `${plan.isActive ? 'Deactivate' : 'Activate'} "${plan.name}"?`,
      plan.isActive ? 'warning' : 'info',
      async () => {
        closeModal();
        try {
          setError(''); setSuccess('');
          const payload = {
            name:            plan.name,
            vehicleType:     plan.vehicleType,
            billingCycle:    plan.billingCycle,
            price:           plan.price,
            discountPercent: plan.discountPercent ?? 0,
            isPopular:       !!plan.isPopular,
            isActive:        !plan.isActive,
            displayOrder:    plan.displayOrder ?? 0,
            features:        Array.isArray(plan.features) ? plan.features.map(f => typeof f === 'string' ? f : f.featureText) : [],
            benefits:        Array.isArray(plan.benefits)  ? plan.benefits.map(b  => typeof b  === 'string' ? b  : b.benefitText)  : [],
          };
          await subscriptionsAPI.updatePlan(plan.id, payload);
          setSuccess(`Plan ${plan.isActive ? 'deactivated' : 'activated'}.`);
          await fetchPlans();
        } catch (e) { setError(e.response?.data?.message || 'Failed to update plan.'); }
      }
    );
  };

  if (loading) return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-[var(--muted-color)] text-sm">Loading plans…</p>
      </div>
    </>
  );

  const inp = 'plan-field-input';
  const formAccent = editing ? '#0ea5a0' : '#c8a96b';

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="min-h-screen py-10 relative">
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.14),rgba(14,165,160,.10),rgba(255,165,0,.09),rgba(0,150,255,.10),rgba(200,169,107,.14))', filter: 'blur(85px)' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Header ─────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                  <Crown size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Subscription Plans</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Create, edit, and manage your subscription plan catalogue</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button"
                onClick={() => showForm ? resetForm() : setShowForm(true)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? 'Close Form' : 'New Plan'}
              </button>
            </div>
          </div>

          {/* ── Alerts ─────────────────────────────────── */}
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

          {/* ── Form ────────────────────────────────── */}

          {/* ── Form ───────────────────────────────────── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: `linear-gradient(180deg,${formAccent} 0%,${formAccent}44 60%,transparent 100%)` }} />
              <div className="prism-ray" style={{ left: '68%', width: '13%', animation: 'prism-ray-sweep 16s ease-in-out 2s infinite' }} />

              <div className="p-7">
                {/* Form header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg,transparent,${formAccent})` }} />
                      <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em]" style={{ color: formAccent }}>
                        {editing ? 'Edit Plan' : 'New Plan'}
                      </p>
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg,${formAccent},transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editing ? `Editing: ${editing.name}` : 'Create Subscription Plan'}
                    </h2>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-5"><div className="spectrum-line" /></div>

                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* ── Basics ── */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="plan-field-label">Plan Name *</label>
                      <input type="text" value={formData.name} onChange={(e) => set('name', e.target.value)}
                        required className={inp} placeholder="e.g. Sedan Monthly" />
                    </div>
                    <div>
                      <label className="plan-field-label">Price (QAR) <span className="normal-case font-normal">— auto from packages</span></label>
                      {(() => {
                        const base = formData.packageIds.reduce((sum, id) => {
                          const pkg = allPackages.find(p => p.id === id);
                          return sum + (pkg ? Number(pkg.price) : 0);
                        }, 0);
                        const disc = Number(formData.discountPercent) || 0;
                        const computed = Math.round(base * (1 - disc / 100) * 100) / 100;
                        return (
                          <div className={`${inp} flex items-center justify-between pointer-events-none select-none opacity-80`}>
                            <span className="text-[var(--text-color)]">
                              {formData.packageIds.length === 0 ? 'Add packages above' : `QAR ${computed.toFixed(2)}`}
                            </span>
                            {disc > 0 && formData.packageIds.length > 0 && (
                              <span className="text-xs text-green-400 font-semibold">{disc}% off · base QAR {base.toFixed(2)}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Vehicle type + billing cycle ── */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="plan-field-label">Vehicle Type *</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {VEHICLE_OPTIONS.map(v => (
                          <button key={v} type="button" onClick={() => set('vehicleType', v)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            style={{
                              background: formData.vehicleType === v ? 'rgba(200,169,107,0.15)' : 'transparent',
                              color:      formData.vehicleType === v ? '#c8a96b' : 'var(--muted-color)',
                              border:     formData.vehicleType === v ? '1px solid rgba(200,169,107,0.4)' : '1px solid var(--border-color)',
                            }}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="plan-field-label">Billing Cycle *</label>
                      <div className="flex gap-2 mt-1">
                        {BILLING_OPTIONS.map(b => (
                          <button key={b} type="button" onClick={() => set('billingCycle', b)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            style={{
                              background: formData.billingCycle === b ? 'rgba(200,169,107,0.15)' : 'transparent',
                              color:      formData.billingCycle === b ? '#c8a96b' : 'var(--muted-color)',
                              border:     formData.billingCycle === b ? '1px solid rgba(200,169,107,0.4)' : '1px solid var(--border-color)',
                            }}>
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Discount + display order ── */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="plan-field-label">Booking Discount % <span className="normal-case font-normal">(0–50)</span></label>
                      <input type="number" step="0.01" min="0" max="50" value={formData.discountPercent}
                        onChange={(e) => set('discountPercent', e.target.value)}
                        className={inp} placeholder="0" />
                    </div>
                    <div>
                      <label className="plan-field-label">Display Order</label>
                      <input type="number" min="0" value={formData.displayOrder}
                        onChange={(e) => set('displayOrder', e.target.value)}
                        className={inp} placeholder="1" />
                    </div>
                  </div>

                  {/* ── Toggles ── */}
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 p-5 rounded-xl border border-[var(--border-color)]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="sm:col-span-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Plan Settings</p>
                    <Toggle value={formData.isPopular} onChange={(v) => set('isPopular', v)} label="Mark as Popular"  sublabel="Shows a 'Popular' badge on the card" />
                    <Toggle value={formData.isActive}  onChange={(v) => set('isActive', v)}  label="Plan Active"      sublabel="Visible to customers" />
                  </div>

                  {/* ── Feature bullets ── */}
                  <div>
                    <label className="plan-field-label">Feature Bullets <span className="normal-case font-normal">(shown on pricing card)</span></label>
                    <FeatureListEditor features={formData.features} onChange={(f) => set('features', f)} />
                  </div>

                  {/* ── Benefits ── */}
                  <div>
                    <label className="plan-field-label">Benefits <span className="normal-case font-normal">(highlights shown on card)</span></label>
                    <FeatureListEditor features={formData.benefits} onChange={(b) => set('benefits', b)} />
                  </div>

                  {/* ── Plan Packages ── */}
                  <div>
                    <label className="plan-field-label">Plan Packages <span className="normal-case font-normal">(ordered services included in this plan)</span></label>
                    <div className="space-y-2 mb-3">
                      {formData.packageIds.length === 0 && (
                        <p className="text-xs text-[var(--muted-color)] italic py-2">No packages added yet.</p>
                      )}
                      {formData.packageIds.map((pkgId, idx) => {
                        const pkg = allPackages.find(p => p.id === pkgId);
                        return (
                          <div key={`${pkgId}-${idx}`} className="flex items-center gap-2 p-3 rounded-xl border border-[var(--border-color)] bg-white/2">
                            <span className="text-[10px] font-bold text-[var(--muted-color)] w-5 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--heading-color)] truncate">{pkg?.name ?? `Package #${pkgId}`}</p>
                              <p className="text-xs text-[var(--muted-color)]">{pkg ? `QAR ${pkg.price}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button type="button" disabled={idx === 0}
                                onClick={() => {
                                  const arr = [...formData.packageIds];
                                  [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                  set('packageIds', arr);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 disabled:opacity-25 transition text-xs">
                                ↑
                              </button>
                              <button type="button" disabled={idx === formData.packageIds.length - 1}
                                onClick={() => {
                                  const arr = [...formData.packageIds];
                                  [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                                  set('packageIds', arr);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 disabled:opacity-25 transition text-xs">
                                ↓
                              </button>
                              <button type="button"
                                onClick={() => set('packageIds', formData.packageIds.filter((_, i) => i !== idx))}
                                className="w-6 h-6 flex items-center justify-center rounded border border-rose-500/25 text-rose-400 hover:bg-rose-500/10 transition">
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {allPackages.length > 0 && (
                      <select
                        className="plan-field-input text-xs"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          set('packageIds', [...formData.packageIds, Number(e.target.value)]);
                          e.target.value = '';
                        }}>
                        <option value="">+ Add package…</option>
                        {allPackages.filter(p => p.isActive !== false).map(p => (
                          <option key={p.id} value={p.id}>{p.name} — QAR {p.price}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* ── Submit ── */}
                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit" disabled={saving}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60">
                        <CheckCircle size={14} />
                        {saving ? 'Saving…' : (editing ? 'Update Plan' : 'Create Plan')}
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

          {/* ── Plans grid ─────────────────────────────── */}
          <div className="space-y-4 card-stagger" style={{ animationDelay: '0.06s' }}>
            <div className="flex items-center justify-between">
              <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Plan Catalogue</h2>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)', color: '#c8a96b' }}>
                {plans.length} plan{plans.length !== 1 ? 's' : ''}
              </span>
            </div>

            {plans.length === 0 ? (
              <div className="glass-card p-14 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)' }}>
                  <Crown size={24} style={{ color: '#c8a96b' }} />
                </div>
                <p className="text-sm font-bold text-[var(--heading-color)]">No plans yet</p>
                <p className="text-xs text-[var(--muted-color)]">Create your first subscription plan above.</p>
              </div>
            ) : (
              plans.map((plan, idx) => {
                const meta     = VEHICLE_META[plan.vehicleType] ?? VEHICLE_META['Sedan'];
                const PlanIcon = meta.Icon;
                const isExpanded = expanded === plan.id;

                return (
                  <div key={plan.id} className="glass-card relative overflow-hidden card-stagger"
                    style={{ animationDelay: `${idx * 0.04}s`, borderColor: plan.isActive ? meta.border : undefined, opacity: plan.isActive ? 1 : 0.6 }}>
                    <div className="absolute top-0 left-0 w-[3px] h-full"
                      style={{ background: `linear-gradient(180deg,${meta.color} 0%,${meta.color}44 60%,transparent 100%)` }} />
                    <div className="prism-ray" style={{ left: '55%', width: '14%', animation: `prism-ray-sweep ${18 + idx * 3}s ease-in-out ${idx * 1.5}s infinite` }} />

                    {/* Card header */}
                    <div className="px-6 py-5 flex flex-wrap items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                        <PlanIcon size={16} style={{ color: meta.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <h3 className="premium-heading text-lg font-bold text-[var(--heading-color)]">{plan.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
                            {plan.vehicleType}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(14,165,160,0.10)', border: '1px solid rgba(14,165,160,0.28)', color: '#0ea5a0' }}>
                            {plan.billingCycle}
                          </span>
                          {plan.isPopular && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary">
                              Popular
                            </span>
                          )}
                          {!plan.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--border-color)]/20 border border-[var(--border-color)] text-[var(--muted-color)]">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted-color)]">
                          {plan.discountPercent > 0 ? `${plan.discountPercent}% booking discount` : 'No booking discount'}
                          {plan.subscriberCount != null ? ` · ${plan.subscriberCount} subscriber${plan.subscriberCount !== 1 ? 's' : ''}` : ''}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-black" style={{ color: meta.color }}>
                          {formatQAR(plan.price)}
                          <span className="text-xs font-semibold text-[var(--muted-color)]">/{plan.billingCycle === 'Quarterly' ? 'qtr' : 'mo'}</span>
                        </p>
                        <p className="text-xs text-[var(--muted-color)] mt-0.5">Display order: {plan.displayOrder ?? 0}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => setExpanded(isExpanded ? null : plan.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 transition"
                          title={isExpanded ? 'Collapse' : 'Expand'}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button type="button" onClick={() => handleEdit(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                          <Edit2 size={11} /> Edit
                        </button>
                        <button type="button" onClick={() => handleToggleActive(plan)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${plan.isActive ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/8' : 'border-green-500/30 text-green-400 hover:bg-green-500/8'}`}>
                          <Power size={11} /> {plan.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => handleDelete(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-6 pb-5 border-t border-[var(--border-color)] pt-4">
                        <div className="grid sm:grid-cols-2 gap-4 mb-5">

                          {/* Feature bullets */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Features</p>
                            {Array.isArray(plan.features) && plan.features.length > 0 ? (
                              <ul className="space-y-1">
                                {plan.features.map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: meta.color }} />
                                    <span className="text-xs text-[var(--text-color)]">{typeof f === 'string' ? f : f.featureText}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[var(--muted-color)] italic">No features</p>
                            )}
                          </div>

                          {/* Benefits */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Benefits</p>
                            {Array.isArray(plan.benefits) && plan.benefits.length > 0 ? (
                              <ul className="space-y-1">
                                {plan.benefits.map((b, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#0ea5a0' }} />
                                    <span className="text-xs text-[var(--text-color)]">{typeof b === 'string' ? b : b.benefitText}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[var(--muted-color)] italic">No benefits</p>
                            )}
                          </div>
                        </div>

                        {/* Plan packages */}
                        {Array.isArray(plan.planPackages) && plan.planPackages.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Included Packages ({plan.planPackages.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {plan.planPackages.sort((a, b) => a.displayOrder - b.displayOrder).map((pp, i) => (
                                <span key={pp.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                  style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)', color: '#c8a96b' }}>
                                  <span className="opacity-50">{i + 1}.</span> {pp.packageName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            )}
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

export default AdminPlans;