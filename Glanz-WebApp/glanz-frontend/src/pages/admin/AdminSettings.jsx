// AdminSettings.jsx
import React, { useState, useEffect, useRef } from 'react';
import { settingsAPI } from '../../api/settings';
import { authAPI } from '../../api/auth';
import { formatQAR } from '../../utils/currency';
import { Settings, Shield, CheckCircle, AlertCircle, Save, Building2, Clock, MessageSquare, DollarSign } from 'lucide-react';
import { getBusiness, saveBusiness } from '../../config/business';

/* PRISM_CSS — identical to ManageServices */
const PRISM_CSS = `
@keyframes holo-sweep{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes prism-ray-sweep{0%{transform:translateX(-130%) skewX(-15deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(460%) skewX(-15deg);opacity:0}}
@keyframes spectrum-float{0%,100%{transform:translate(0,0) rotate(0deg);opacity:.18}33%{transform:translate(12px,-14px) rotate(120deg);opacity:.30}66%{transform:translate(-7px,8px) rotate(240deg);opacity:.22}}
@keyframes cta-rainbow-glow{0%,100%{box-shadow:0 0 0 1.5px rgba(255,80,80,.42),0 0 22px rgba(255,165,0,.15)}33%{box-shadow:0 0 0 1.5px rgba(0,200,255,.42),0 0 22px rgba(160,0,255,.15)}66%{box-shadow:0 0 0 1.5px rgba(0,255,120,.42),0 0 22px rgba(255,0,100,.15)}}
@keyframes card-enter{from{transform:translateY(14px) scale(.988);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.prism-cursor-blob{position:fixed;pointer-events:none;z-index:0;border-radius:50%;filter:blur(90px);mix-blend-mode:screen;will-change:transform,background}
.prism-ray{position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%)}
.spectrum-line{height:1.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:.40}
.cta-prism-glow{animation:cta-rainbow-glow 5s ease-in-out infinite}
.card-stagger{animation:card-enter .52s cubic-bezier(.22,1,.36,1) both}
.field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem;transition:border-color .2s,box-shadow .2s;outline:none}
.field-input:focus{border-color:rgba(200,169,107,.65);box-shadow:0 0 0 3px rgba(200,169,107,.12)}
.field-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my, rafId;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*.07; cy += (my-cy)*.07;
      const hue = (mx/window.innerWidth)*360;
      el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} style={{ position:'fixed', pointerEvents:'none', zIndex:0, borderRadius:'50%', filter:'blur(90px)', mixBlendMode:'screen', willChange:'transform,background', width:480, height:480, top:'-240px', left:'-240px' }} />;
}

/* Toggle — button-based, no checkbox, matches original's onClick pattern */
function Toggle({ checked, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-[var(--border-color)]'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function AdminSettings() {
  const [policy, setPolicy] = useState({ feeEnabled:false, feeType:'Percent', feeAmount:20, freeWindowHours:24 });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  // Business config state
  const [biz, setBiz] = useState(() => getBusiness());
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved,  setBizSaved]  = useState(false);
  const [bizError,  setBizError]  = useState('');
  const [newArea,   setNewArea]   = useState('');

  // Scheduling: worker travel/prep gap between consecutive bookings
  const [workerTravelMinutes,  setWorkerTravelMinutes]  = useState(30);
  const [workerTravelSaving,   setWorkerTravelSaving]   = useState(false);
  const [workerTravelSaved,    setWorkerTravelSaved]    = useState(false);
  const [workerTravelError,    setWorkerTravelError]    = useState('');

  // SMS follow-up state
  const [smsEnabled,       setSmsEnabled]       = useState(false);
  const [smsSaving,        setSmsSaving]        = useState(false);
  const [smsSaved,         setSmsSaved]         = useState(false);
  const [smsError,         setSmsError]         = useState('');

  // Subscription discount state
  const [discountPct,      setDiscountPct]      = useState(10);
  const [discountSaving,   setDiscountSaving]   = useState(false);
  const [discountSaved,    setDiscountSaved]    = useState(false);
  const [discountError,    setDiscountError]    = useState('');

  // Pay slip settings state
  const [paySlip, setPaySlip] = useState({ companyName: 'Glanz', companyLogo: '', companyAddress: '', companyPhone: '', companyEmail: '', footerText: '' });
  const [paySlipLoading, setPaySlipLoading] = useState(true);
  const [paySlipSaving, setPaySlipSaving] = useState(false);
  const [paySlipSaved, setPaySlipSaved] = useState(false);
  const [paySlipError, setPaySlipError] = useState('');

  // Business hours state
  const defaultBusinessHours = {
    Sunday: '09:00-18:00', Monday: '09:00-18:00', Tuesday: '09:00-18:00',
    Wednesday: '09:00-18:00', Thursday: '09:00-18:00', Friday: '00:00-00:00', Saturday: '10:00-16:00',
  };
  const [businessHours, setBusinessHours] = useState(defaultBusinessHours);
  const [bizHoursSaving, setBizHoursSaving] = useState(false);
  const [bizHoursSaved, setBizHoursSaved] = useState(false);
  const [bizHoursError, setBizHoursError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsAPI.getCancellationPolicy();
        setPolicy({ feeEnabled: data.feeEnabled ?? false, feeType: data.feeType ?? 'Percent', feeAmount: data.feeAmount ?? 20, freeWindowHours: data.freeWindowHours ?? 24 });
      } catch { setError('Failed to load settings.'); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    settingsAPI.getSystemSettings()
      .then(data => {
        setWorkerTravelMinutes(data?.booking?.workerTravelBufferMinutes ?? data?.workerTravelBufferMinutes ?? 30);
        setDiscountPct(data?.subscriptionDiscountPercent ?? 10);
        setSmsEnabled(data?.sms?.followUpEnabled ?? false);
        if (data?.businessHours) {
          setBusinessHours({
            Sunday:    data.businessHours.sunday    || '09:00-18:00',
            Monday:    data.businessHours.monday    || '09:00-18:00',
            Tuesday:   data.businessHours.tuesday   || '09:00-18:00',
            Wednesday: data.businessHours.wednesday || '09:00-18:00',
            Thursday:  data.businessHours.thursday  || '09:00-18:00',
            Friday:    data.businessHours.friday    || '00:00-00:00',
            Saturday:  data.businessHours.saturday  || '10:00-16:00',
          });
        }
                if (data?.businessConfig) {
                  const bc = data.businessConfig;
                  setBiz(b => ({
                    ...b,
                    ...(bc.name         && { name:         bc.name }),
                    ...(bc.tagline      && { tagline:       bc.tagline }),
                    ...(bc.phone        && { phone:         bc.phone }),
                    ...(bc.email        && { email:         bc.email }),
                    ...(bc.location     && { location:      bc.location }),
                    ...(bc.serviceAreas && { serviceAreas:  bc.serviceAreas }),
                    ...(bc.socialLinks  && { socialLinks:   bc.socialLinks }),
                  }));
                }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    authAPI.getPaySlipSettings()
      .then(data => setPaySlip({
        companyName: data?.companyName || 'Glanz',
        companyLogo: data?.companyLogo || '',
        companyAddress: data?.companyAddress || '',
        companyPhone: data?.companyPhone || '',
        companyEmail: data?.companyEmail || '',
        footerText: data?.footerText || ''
      }))
      .catch(() => {})
      .finally(() => setPaySlipLoading(false));
  }, []);

  const handleSavePaySlip = async () => {
    try {
      setPaySlipSaving(true); setPaySlipError('');
      await authAPI.updatePaySlipSettings(paySlip);
      setPaySlipSaved(true);
      setTimeout(() => setPaySlipSaved(false), 3000);
    } catch (err) { setPaySlipError(err?.response?.data?.message || 'Failed to save pay slip settings.'); }
    finally { setPaySlipSaving(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      const updated = await settingsAPI.updateCancellationPolicy(policy);
      setPolicy({ feeEnabled: updated.feeEnabled, feeType: updated.feeType, feeAmount: updated.feeAmount, freeWindowHours: updated.freeWindowHours });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err?.response?.data?.message || 'Failed to save settings.'); }
    finally { setSaving(false); }
  };

  const handleSaveWorkerTravel = async () => {
    const v = Number(workerTravelMinutes);
    if (!Number.isFinite(v) || v < 0 || v > 480) {
      setWorkerTravelError('Worker travel buffer must be between 0 and 480 minutes.'); return;
    }
    try {
      setWorkerTravelSaving(true); setWorkerTravelError('');
      await settingsAPI.updateSystemSettings({ WorkerTravelBufferMinutes: v });
      setWorkerTravelSaved(true);
      setTimeout(() => setWorkerTravelSaved(false), 3000);
    } catch (err) { setWorkerTravelError(err?.response?.data?.message || 'Failed to save worker travel buffer setting.'); }
    finally { setWorkerTravelSaving(false); }
  };

  const handleSaveSms = async () => {
    try {
      setSmsSaving(true); setSmsError('');
      await settingsAPI.updateSmsSettings({ followUpEnabled: smsEnabled });
      setSmsSaved(true);
      setTimeout(() => setSmsSaved(false), 3000);
    } catch (err) { setSmsError(err?.response?.data?.message || 'Failed to save SMS setting.'); }
    finally { setSmsSaving(false); }
  };

  const handleSaveDiscount = async () => {
    const v = Number(discountPct);
    if (!Number.isFinite(v) || v < 0 || v > 50) {
      setDiscountError('Discount must be between 0 and 50 percent.'); return;
    }
    try {
      setDiscountSaving(true); setDiscountError('');
      await settingsAPI.updateSystemSettings({ subscriptionDiscountPercent: v });
      setDiscountSaved(true);
      setTimeout(() => setDiscountSaved(false), 3000);
    } catch (err) { setDiscountError(err?.response?.data?.message || 'Failed to save discount.'); }
    finally { setDiscountSaving(false); }
  };

  const handleSaveBusinessHours = async () => {
    try {
      setBizHoursSaving(true); setBizHoursError('');
      await settingsAPI.updateSystemSettings({ BusinessHours: businessHours });
      setBizHoursSaved(true);
      setTimeout(() => setBizHoursSaved(false), 3000);
    } catch (err) { setBizHoursError(err?.response?.data?.message || 'Failed to save business hours.'); }
    finally { setBizHoursSaving(false); }
  };

  const updateBusinessHours = (day, start, end) => {
    setBusinessHours(prev => ({ ...prev, [day]: `${start}-${end}` }));
  };

  const exampleFee = policy.feeType === 'Percent'
    ? `${policy.feeAmount}% of booking total`
    : formatQAR(policy.feeAmount);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading settings…</p>
    </div>
  );

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />
      <div className="min-h-screen py-10 relative"
        style={{ background:'radial-gradient(circle at 7% 6%,rgba(200,169,107,.05) 0%,transparent 38%),radial-gradient(circle at 93% 92%,rgba(14,165,160,.04) 0%,transparent 32%)' }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background:'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter:'blur(85px)', animation:'spectrum-float 20s ease-in-out infinite' }} />
        <div className="container mx-auto px-4 max-w-2xl relative z-10 space-y-6">

          {/* ── Header ── */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Admin Panel</p>
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                <Settings size={16} style={{ color:'#c8a96b' }} />
              </div>
              <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Admin Settings</h1>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">Control system-wide policies and fees.</p>
          </div>

          {/* ── Cancellation Policy card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#c8a96b 0%,#c8a96b44 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'72%', width:'14%', animation:'prism-ray-sweep 20s ease-in-out 4s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                  <Shield size={14} style={{ color:'#c8a96b' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Cancellation Policy</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Configure whether a fee is charged when customers cancel a booking. Shown to customers before they confirm cancellation.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] mb-5">
                <div>
                  <p className="font-bold text-sm text-[var(--heading-color)] mb-0.5">Enable Cancellation Fee</p>
                  <p className="text-xs text-[var(--muted-color)]">Customers will see a warning and calculated fee before confirming cancellation.</p>
                </div>
                <Toggle checked={policy.feeEnabled} onClick={() => setPolicy(p => ({ ...p, feeEnabled:!p.feeEnabled }))} />
              </div>

              {/* Fee type pills */}
              <div className="mb-5">
                <label className="field-label">Fee Type</label>
                <div className="flex gap-2">
                  {['Percent','Flat'].map(t => (
                    <button key={t} type="button" disabled={!policy.feeEnabled}
                      onClick={() => setPolicy(p => ({ ...p, feeType:t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-40 ${
                        policy.feeType !== t ? 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/30 hover:text-[var(--text-color)]' : ''
                      }`}
                      style={policy.feeType === t ? { background:'rgba(200,169,107,.10)', borderColor:'rgba(200,169,107,.45)', color:'#c8a96b' } : {}}>
                      {t === 'Percent' ? 'Percentage of booking' : 'Flat amount (QAR)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee amount */}
              <div className="mb-5">
                <label className="field-label">{policy.feeType === 'Percent' ? 'Fee Percentage (%)' : 'Flat Fee (QAR)'}</label>
                <input type="number" min={0} max={policy.feeType === 'Percent' ? 100 : undefined}
                  step={policy.feeType === 'Percent' ? 1 : 0.5}
                  value={policy.feeAmount} disabled={!policy.feeEnabled}
                  onChange={e => setPolicy(p => ({ ...p, feeAmount: parseFloat(e.target.value) || 0 }))}
                  className="field-input disabled:opacity-40" />
              </div>

              {/* Free window */}
              <div className="mb-5">
                <label className="field-label">Free Cancellation Window (hours)</label>
                <p className="text-xs text-[var(--muted-color)] mb-2">
                  Cancellations made more than this many hours before the appointment incur no fee.
                </p>
                <input type="number" min={0} step={1} value={policy.freeWindowHours} disabled={!policy.feeEnabled}
                  onChange={e => setPolicy(p => ({ ...p, freeWindowHours: parseInt(e.target.value) || 0 }))}
                  className="field-input disabled:opacity-40" />
              </div>

              {/* Preview */}
              {policy.feeEnabled && (
                <div className="rounded-xl border p-4 mb-6"
                  style={{ background:'rgba(245,158,11,.08)', borderColor:'rgba(245,158,11,.28)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={12} style={{ color:'#f59e0b' }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#f59e0b' }}>Policy Preview</p>
                  </div>
                  <p className="text-sm text-[var(--text-color)]">
                    Customers who cancel within <strong>{policy.freeWindowHours}h</strong> of their appointment will be charged{' '}
                    <strong>{exampleFee}</strong>. Cancellations made more than {policy.freeWindowHours}h before are free.
                  </p>
                </div>
              )}

              {/* Save */}
              <div className="cta-prism-glow rounded-xl">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60">
                  {saving ? 'Saving…' : saved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Settings</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Business Configuration card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#10b981 38%,#0ea5a0 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#10b981 0%,#10b98144 60%,transparent 100%)' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.24)' }}>
                  <Building2 size={14} style={{ color:'#10b981' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Business Configuration</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Set the business name, contact info, and operating area. These values are shown throughout the app.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {bizError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{bizError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="field-label">Business Name</label>
                  <input type="text" value={biz.name}
                    onChange={e => setBiz(b => ({ ...b, name: e.target.value }))}
                    className="field-input" placeholder="e.g. Glanz" />
                </div>
                <div>
                  <label className="field-label">Tagline</label>
                  <input type="text" value={biz.tagline}
                    onChange={e => setBiz(b => ({ ...b, tagline: e.target.value }))}
                    className="field-input" placeholder="Short description" />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input type="text" value={biz.phone}
                    onChange={e => setBiz(b => ({ ...b, phone: e.target.value }))}
                    className="field-input" placeholder="+974 4444 4444" />
                </div>
                <div>
                  <label className="field-label">Support Email</label>
                  <input type="email" value={biz.email}
                    onChange={e => setBiz(b => ({ ...b, email: e.target.value }))}
                    className="field-input" placeholder="info@example.qa" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Operating Area</label>
                  <input type="text" value={biz.location}
                    onChange={e => setBiz(b => ({ ...b, location: e.target.value }))}
                    className="field-input" placeholder="e.g. Doha, Qatar" />
                </div>
                 <div className="sm:col-span-2">
                   <label className="field-label">Service Areas (cities / districts)</label>
                   <div className="flex flex-wrap gap-2 mb-3">
                     {(biz.serviceAreas || []).map((area, i) => (
                       <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                         style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b', border: '1px solid rgba(200,169,107,.28)' }}>
                         {area}
                         <button type="button"
                           onClick={() => setBiz(b => ({ ...b, serviceAreas: (b.serviceAreas || []).filter((_, j) => j !== i) }))}
                           className="text-[var(--muted-color)] hover:text-rose-400 transition-colors ml-0.5">
                           ×
                         </button>
                       </span>
                     ))}
                     {(!biz.serviceAreas || biz.serviceAreas.length === 0) && (
                       <span className="text-xs text-[var(--muted-color)]">No areas added</span>
                     )}
                   </div>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       value={newArea}
                       onChange={e => setNewArea(e.target.value)}
                       onKeyDown={e => {
                         if (e.key === 'Enter' && newArea.trim()) {
                           setBiz(b => ({ ...b, serviceAreas: [...(b.serviceAreas || []), newArea.trim()] }));
                           setNewArea('');
                         }
                       }}
                       placeholder="Type area name and press Enter"
                       className="field-input flex-1"
                     />
                     <button type="button"
                       onClick={() => {
                         if (newArea.trim()) {
                           setBiz(b => ({ ...b, serviceAreas: [...(b.serviceAreas || []), newArea.trim()] }));
                           setNewArea('');
                         }
                       }}
                       className="px-4 py-2.5 rounded-xl text-xs font-bold transition"
                       style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b', border: '1px solid rgba(200,169,107,.28)' }}>
                       + Add
                     </button>
                   </div>
                 </div>

                 {/* Social Links */}
                 <div className="sm:col-span-2 mt-4">
                   <label className="field-label">Social Media Links</label>
                   <div className="space-y-3">
                     {[
                       { id: 'facebook', label: 'Facebook' },
                       { id: 'twitter', label: 'Twitter/X' },
                       { id: 'instagram', label: 'Instagram' },
                       { id: 'linkedin', label: 'LinkedIn' },
                       { id: 'youtube', label: 'YouTube' },
                     ].map(({ id, label }) => (
                       <div key={id} className="flex items-center gap-3">
                         <span className="w-24 text-xs font-medium text-[var(--muted-color)]">{label}</span>
                         <input
                           type="url"
                           value={biz.socialLinks?.[id] || ''}
                           onChange={e => setBiz(b => ({
                             ...b,
                             socialLinks: { ...(b.socialLinks || {}), [id]: e.target.value }
                           }))}
                           placeholder={`https://${id}.com/your-page`}
                           className="field-input flex-1"
                         />
                       </div>
                     ))}
                   </div>
                 </div>
              </div>

              <div className="cta-prism-glow rounded-xl">
                <button
                  type="button"
                  disabled={bizSaving}
                  onClick={async () => {
                    setBizSaving(true);
                    setBizError('');
                try {
                    await settingsAPI.updateBusinessConfig({
                      name:         biz.name,
                      tagline:      biz.tagline,
                      phone:        biz.phone,
                      email:        biz.email,
                      location:     biz.location,
                      serviceAreas: biz.serviceAreas,
                      socialLinks:  biz.socialLinks,
                    });
                      saveBusiness(biz);
                      setBizSaved(true);
                      setTimeout(() => setBizSaved(false), 3000);
                    } catch (err) {
                      setBizError(err?.response?.data?.message || 'Failed to save business configuration.');
                    } finally {
                      setBizSaving(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.35)', color:'#10b981' }}
                >
                  {bizSaving ? 'Saving…' : bizSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Business Config</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Booking Time Buffers card (combined Customer Lead Time + Worker Travel Buffer) ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#6366f1 38%,#06b6d4 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#6366f1 0%,#06b6d488 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'55%', width:'14%', animation:'prism-ray-sweep 22s ease-in-out 2s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.24)' }}>
                  <Clock size={14} style={{ color:'#6366f1' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Booking Time Buffers</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Control how much gap workers need between consecutive jobs.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {/* ── Worker Travel Buffer ── */}
              <div className="mb-6 p-5 rounded-xl border"
                style={{ background:'rgba(6,182,212,.06)', borderColor:'rgba(6,182,212,.20)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background:'rgba(6,182,212,.15)' }}>
                    <Clock size={10} style={{ color:'#22d3ee' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--heading-color)]">Worker Travel Buffer</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#22d3ee' }}>Gap between consecutive jobs</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-4 mt-2">
                  Minimum gap between end of one booking and start of the next. Accounts for travel and preparation time between jobs.
                </p>

                {workerTravelError && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 mb-4">
                    <AlertCircle size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-rose-300 text-xs font-semibold">{workerTravelError}</p>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  {[0, 15, 30, 45, 60].map(v => (
                    <button key={v} type="button" onClick={() => setWorkerTravelMinutes(v)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition"
                      style={workerTravelMinutes === v
                        ? { background:'rgba(6,182,212,.18)', borderColor:'rgba(6,182,212,.55)', color:'#22d3ee' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v} min
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={480} step={5} value={workerTravelMinutes}
                  onChange={e => setWorkerTravelMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="field-input" />

                <p className="text-xs text-[var(--text-color)] mt-3">
                  Worker available at <strong>T</strong> only if{' '}
                  <code className="text-xs bg-white/6 px-1.5 py-0.5 rounded font-mono">T ≥ lastBookingEnd + {workerTravelMinutes} min</code>.
                </p>
              </div>

              {/* ── Save ── */}
              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(6,182,212,.40)' }}>
                <button type="button" onClick={handleSaveWorkerTravel} disabled={workerTravelSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(6,182,212,.15)', border:'1px solid rgba(6,182,212,.35)', color:'#22d3ee' }}>
                  {workerTravelSaving ? 'Saving…' : workerTravelSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Worker Buffer</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Business Hours card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#10b981 38%,#06b6d4 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#10b981 0%,#10b98144 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'60%', width:'14%', animation:'prism-ray-sweep 20s ease-in-out 3s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.24)' }}>
                  <Clock size={14} style={{ color:'#10b981' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Business Hours</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Set opening and closing hours for each day of the week. Slots are generated in 30-minute steps within these bounds.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {bizHoursError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{bizHoursError}</p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                  const [start, end] = (businessHours[day] || '09:00-18:00').split('-');
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-28 text-sm font-medium text-[var(--text-color)]">{day}</span>
                      <input type="time" value={start} step="1800"
                        onChange={e => updateBusinessHours(day, e.target.value, end)}
                        className="field-input flex-1" />
                      <span className="text-[var(--muted-color)]">to</span>
                      <input type="time" value={end} step="1800"
                        onChange={e => updateBusinessHours(day, start, e.target.value)}
                        className="field-input flex-1" />
                    </div>
                  );
                })}
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(16,185,129,.40)' }}>
                <button type="button" onClick={handleSaveBusinessHours} disabled={bizHoursSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.35)', color:'#10b981' }}>
                  {bizHoursSaving ? 'Saving…' : bizHoursSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Business Hours</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Subscription Discount card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#f59e0b 38%,#10b981 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#f59e0b 0%,#f59e0b44 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'65%', width:'14%', animation:'prism-ray-sweep 18s ease-in-out 1s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.24)' }}>
                  <span style={{ color:'#f59e0b', fontWeight:700, fontSize:14 }}>%</span>
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Subscription Discount</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Percentage discount applied automatically to monthly subscription bookings before any coupon is applied. Valid range: 0–50%.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {discountError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{discountError}</p>
                </div>
              )}

              <div className="mb-5">
                <label className="field-label">Discount Percentage</label>
                <p className="text-xs text-[var(--muted-color)] mb-3">
                  A 10% discount means: a QAR 200 monthly plan is billed at QAR 180 before any coupon.
                </p>
                <div className="flex gap-2 mb-3">
                  {[0, 5, 10, 15, 20].map(v => (
                    <button key={v} type="button" onClick={() => setDiscountPct(v)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border transition"
                      style={discountPct === v
                        ? { background:'rgba(245,158,11,.14)', borderColor:'rgba(245,158,11,.50)', color:'#fbbf24' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v}%
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={50} step={1} value={discountPct}
                  onChange={e => setDiscountPct(Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="field-input" />
              </div>

              <div className="rounded-xl border p-4 mb-6"
                style={{ background:'rgba(245,158,11,.07)', borderColor:'rgba(245,158,11,.25)' }}>
                <p className="text-sm text-[var(--text-color)]">
                  Applied in <strong>CreatePaymentIntent</strong> and <strong>CreateBookingV2</strong> endpoints.
                  Change takes effect on the next booking creation — no restart needed.
                </p>
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(245,158,11,.40)' }}>
                <button type="button" onClick={handleSaveDiscount} disabled={discountSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(245,158,11,.15)', border:'1px solid rgba(245,158,11,.35)', color:'#fbbf24' }}>
                  {discountSaving ? 'Saving…' : discountSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Discount</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── SMS Follow-Up Notifications card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#06b6d4 38%,#3b82f6 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#06b6d4 0%,#06b6d444 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'58%', width:'14%', animation:'prism-ray-sweep 25s ease-in-out 3s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(6,182,212,.12)', border:'1px solid rgba(6,182,212,.24)' }}>
                  <MessageSquare size={14} style={{ color:'#06b6d4' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">SMS Follow-Up Notifications</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">
                Enable automated SMS messages for booking reminders, abandoned booking recovery, and win-back campaigns.
                Keep off during development to avoid carrier costs.
              </p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {smsError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{smsError}</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] mb-4">
                <div>
                  <p className="font-bold text-sm text-[var(--heading-color)] mb-0.5">Enable SMS Follow-Ups</p>
                  <p className="text-xs text-[var(--muted-color)]">
                    When enabled, SMS messages will fire for reminders, win-backs, and abandoned bookings.
                    Requires a Twilio integration to be configured.
                  </p>
                </div>
                <Toggle checked={smsEnabled} onClick={() => setSmsEnabled(v => !v)} />
              </div>

              {!smsEnabled && (
                <div className="rounded-xl border p-3 mb-5"
                  style={{ background:'rgba(245,158,11,.07)', borderColor:'rgba(245,158,11,.28)' }}>
                  <p className="text-xs text-[var(--muted-color)]">
                    <span style={{ color:'#fbbf24', fontWeight:700 }}>Development mode:</span>{' '}
                    SMS is off — no messages will be sent and no costs will be incurred.
                  </p>
                </div>
              )}

              {smsEnabled && (
                <div className="rounded-xl border p-3 mb-5"
                  style={{ background:'rgba(239,68,68,.07)', borderColor:'rgba(239,68,68,.28)' }}>
                  <p className="text-xs" style={{ color:'#f87171' }}>
                    <strong>SMS is active.</strong> Messages will be sent to customers. Ensure Twilio credentials are configured in <code className="bg-white/6 px-1 rounded">appsettings</code>.
                  </p>
                </div>
              )}

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(6,182,212,.40)' }}>
                <button type="button" onClick={handleSaveSms} disabled={smsSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(6,182,212,.15)', border:'1px solid rgba(6,182,212,.35)', color:'#22d3ee' }}>
                  {smsSaving ? 'Saving…' : smsSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save SMS Setting</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Pay Slip Settings card ── */}
          <div className="glass-card relative overflow-hidden card-stagger mt-4">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#c8a96b 0%,#c8a96b44 60%,transparent 100%)' }} />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                  <DollarSign size={16} style={{ color:'#c8a96b' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Pay Slip Settings</h2>
              </div>
              <div className="mb-4"><div className="spectrum-line" /></div>

              {paySlipLoading ? (
                <div className="text-center py-4 text-[var(--muted-color)]">Loading...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="field-label">Company Name</label>
                    <input type="text" value={paySlip.companyName}
                      onChange={e => setPaySlip(p => ({ ...p, companyName: e.target.value }))}
                      className="field-input" placeholder="Your Company Name" />
                  </div>
                  <div>
                    <label className="field-label">Company Logo URL</label>
                    <input type="text" value={paySlip.companyLogo}
                      onChange={e => setPaySlip(p => ({ ...p, companyLogo: e.target.value }))}
                      className="field-input" placeholder="https://example.com/logo.png" />
                  </div>
                  <div>
                    <label className="field-label">Company Address</label>
                    <input type="text" value={paySlip.companyAddress}
                      onChange={e => setPaySlip(p => ({ ...p, companyAddress: e.target.value }))}
                      className="field-input" placeholder="123 Main St, Doha, Qatar" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Phone</label>
                      <input type="text" value={paySlip.companyPhone}
                        onChange={e => setPaySlip(p => ({ ...p, companyPhone: e.target.value }))}
                        className="field-input" placeholder="+974XXXXXXXX" />
                    </div>
                    <div>
                      <label className="field-label">Email</label>
                      <input type="email" value={paySlip.companyEmail}
                        onChange={e => setPaySlip(p => ({ ...p, companyEmail: e.target.value }))}
                        className="field-input" placeholder="info@company.com" />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Footer Text</label>
                    <input type="text" value={paySlip.footerText}
                      onChange={e => setPaySlip(p => ({ ...p, footerText: e.target.value }))}
                      className="field-input" placeholder="Thank you for your hard work!" />
                  </div>

                  {paySlipError && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3">
                      <AlertCircle size={14} className="text-rose-400" />
                      <p className="text-rose-300 text-sm">{paySlipError}</p>
                    </div>
                  )}

                  <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(200,169,107,.40)' }}>
                    <button type="button" onClick={handleSavePaySlip} disabled={paySlipSaving}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                      style={{ background:'rgba(200,169,107,.15)', border:'1px solid rgba(200,169,107,.35)', color:'#c8a96b' }}>
                      {paySlipSaving ? 'Saving…' : paySlipSaved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save Pay Slip Settings</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}