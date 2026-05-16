import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Star, Zap, Crown, ArrowRight, Shield,
  CalendarDays, UserCheck, HeadphonesIcon, Infinity as InfinityIcon,
} from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/shared/Toast';
import SEO from '../../components/shared/SEO';
import LoadingCircle from '../../components/shared/LoadingCircle';

/* ── CSS injected once ────────────────────────────────────────────────────── */
const PLANS_CSS = `
@keyframes plans-glow-pulse {
  0%,100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 0.9; transform: scale(1.04); }
}
@keyframes plans-badge-pop {
  0%   { transform: translateY(-6px) scale(0.88); opacity: 0; }
  70%  { transform: translateY(2px)  scale(1.04); opacity: 1; }
  100% { transform: translateY(0)    scale(1);    opacity: 1; }
}
@keyframes plans-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes plans-check-in {
  0%   { opacity: 0; transform: scale(0.5) rotate(-12deg); }
  60%  { transform: scale(1.15) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}

.plans-card {
  position: relative;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform .3s cubic-bezier(.4,0,.2,1), box-shadow .3s cubic-bezier(.4,0,.2,1), border-color .3s;
  overflow: hidden;
}
.plans-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%);
  pointer-events: none;
}
.plans-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 24px 64px rgba(0,0,0,0.25);
}
.plans-card.featured {
  border-color: rgba(200,169,107,0.55);
  box-shadow: 0 0 0 1px rgba(200,169,107,0.18), 0 16px 48px rgba(200,169,107,0.12);
}
.plans-card.featured:hover {
  box-shadow: 0 0 0 1px rgba(200,169,107,0.35), 0 28px 72px rgba(200,169,107,0.2);
}
.plans-price-shimmer {
  background: linear-gradient(90deg,
    var(--heading-color) 0%,
    #c8a96b 40%,
    #0ea5a0 60%,
    var(--heading-color) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: plans-shimmer 4s linear infinite;
}
.plans-badge {
  animation: plans-badge-pop .5s cubic-bezier(.4,0,.2,1) both;
}
.plans-check {
  animation: plans-check-in .35s cubic-bezier(.4,0,.2,1) both;
}
.plans-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
  animation: plans-glow-pulse 6s ease-in-out infinite;
}
.plans-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all .25s cubic-bezier(.4,0,.2,1);
  border: none;
  outline: none;
}
.plans-cta.primary {
  background: linear-gradient(135deg, #c8a96b 0%, #d4b87a 100%);
  color: #0d1117;
}
.plans-cta.primary:hover {
  background: linear-gradient(135deg, #d4b87a 0%, #c8a96b 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(200,169,107,0.35);
}
.plans-cta.secondary {
  background: rgba(255,255,255,0.06);
  color: var(--heading-color);
  border: 1px solid var(--border-color);
}
.plans-cta.secondary:hover {
  background: rgba(255,255,255,0.10);
  transform: translateY(-2px);
}
.plans-cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}
.savings-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(14,165,160,0.12);
  border: 1px solid rgba(14,165,160,0.25);
  color: #0ea5a0;
  font-size: 0.75rem;
  font-weight: 600;
}
.tier-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
`;

/* ── Vehicle config ──────────────────────────────────────────────────────── */
const VEHICLE_OPTIONS = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];

const VEHICLE_CONFIG = {
  Motorcycle: { icon: <Zap size={22} />,    iconBg: 'rgba(148,163,184,0.15)', iconColor: '#94a3b8', glowColor: 'rgba(148,163,184,0.08)', accentColor: '#94a3b8', ctaClass: 'secondary' },
  Sedan:      { icon: <Star size={22} />,   iconBg: 'rgba(200,169,107,0.15)', iconColor: '#c8a96b', glowColor: 'rgba(200,169,107,0.10)', accentColor: '#c8a96b', ctaClass: 'primary'   },
  SUV:        { icon: <Crown size={22} />,  iconBg: 'rgba(14,165,160,0.15)',  iconColor: '#0ea5a0', glowColor: 'rgba(14,165,160,0.10)',  accentColor: '#0ea5a0', ctaClass: 'secondary' },
  Pickup:     { icon: <Shield size={22} />, iconBg: 'rgba(168,85,247,0.15)',  iconColor: '#a855f7', glowColor: 'rgba(168,85,247,0.10)',  accentColor: '#a855f7', ctaClass: 'secondary' },
};

/* ── Feature icon helper ─────────────────────────────────────────────────── */
const featureIcon = (feature) => {
  if (/cleaner|dedicated|same/i.test(feature)) return <UserCheck size={13} className="flex-shrink-0" />;
  if (/unlimited/i.test(feature))              return <InfinityIcon size={13} className="flex-shrink-0" />;
  if (/schedule|recurring|weekly/i.test(feature)) return <CalendarDays size={13} className="flex-shrink-0" />;
  if (/VIP|support/i.test(feature))            return <HeadphonesIcon size={13} className="flex-shrink-0" />;
  if (/priority/i.test(feature))               return <Shield     size={13} className="flex-shrink-0" />;
  return <Check size={13} className="flex-shrink-0" />;
};

/* ── Plan card ───────────────────────────────────────────────────────────── */
function PlanCard({ plan, cfg, onSelect, subscribing, currentPlanId, isLoggedIn }) {
  const isCurrentPlan = currentPlanId === plan.id;
  const isSelected    = subscribing && currentPlanId !== plan.id;

  const freqLabel = plan.billingCycle === 'Quarterly' ? 'quarter' : 'month';

  const btnLabel = isCurrentPlan
    ? 'Current plan'
    : isSelected
    ? 'Subscribing…'
    : isLoggedIn
    ? 'Get started'
    : 'Sign up & subscribe';

  return (
    <div className={`plans-card flex flex-col h-full ${plan.isPopular ? 'featured' : ''}`}>
      {/* Ambient glow */}
      <div className="plans-glow" style={{
        width: 220, height: 220, top: -60, right: -60,
        background: cfg.glowColor,
      }} />

      {/* Badge */}
      {plan.isPopular && (
        <div className="plans-badge absolute -top-px left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-4 py-1 rounded-b-xl text-xs font-bold tracking-wide"
            style={{ background: 'linear-gradient(135deg, #c8a96b 0%, #d4b87a 100%)', color: '#0d1117' }}>
            Most Popular
          </span>
        </div>
      )}

      <div className="p-7 flex flex-col flex-1" style={{ paddingTop: plan.isPopular ? '2.2rem' : '1.75rem' }}>

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="tier-icon-wrap" style={{ background: cfg.iconBg, color: cfg.iconColor }}>
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-[var(--heading-color)] leading-tight">{plan.name}</h3>
            <p className="text-[var(--muted-color)] text-sm mt-0.5 leading-snug">{plan.billingCycle} · {plan.vehicleType}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-4 flex items-end gap-2 flex-wrap">
          <span className={`font-black text-5xl leading-none tracking-tight ${plan.isPopular ? 'plans-price-shimmer' : 'text-[var(--heading-color)]'}`}>
            {plan.price}
          </span>
          <span className="text-[var(--muted-color)] text-sm mb-1.5">QAR / {freqLabel}</span>
        </div>

        {/* Divider */}
        <div className="w-full h-px mb-4" style={{ background: `linear-gradient(90deg,transparent,${cfg.accentColor}44,transparent)` }} />

        {/* Features */}
        <ul className="flex-1 space-y-2.5 mb-6">
          {(plan.features || []).map((f, i) => {
            const text = typeof f === 'string' ? f : f.featureText;
            return (
              <li key={i} className="plans-check flex items-center gap-2.5 text-sm text-[var(--text-color)]"
                style={{ animationDelay: `${i * 0.05}s` }}>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: `${cfg.accentColor}22`, color: cfg.accentColor }}>
                  {featureIcon(text)}
                </span>
                {text}
              </li>
            );
          })}
        </ul>

        {/* CTA */}
        <button
          className={`plans-cta ${cfg.ctaClass}`}
          disabled={isCurrentPlan || isSelected}
          onClick={() => !isCurrentPlan && onSelect(plan.id)}
        >
          {isSelected
            ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : null}
          {btnLabel}
          {!isCurrentPlan && !isSelected && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
/* ── Subscription Confirmation Modal ────────────────────────────────────── */
function ConfirmSubscribeModal({ plan, onConfirm, onCancel, loading }) {
  if (!plan) return null;

  const freqLabel = plan.billingCycle === 'Quarterly' ? 'quarter' : 'month';
  const freqName  = plan.billingCycle || 'Monthly';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-color)] p-7 relative"
        style={{ background: 'var(--card-bg)' }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted-color)] hover:text-[var(--heading-color)] transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>✕</span>
        </button>

        <h2 className="font-bold text-xl text-[var(--heading-color)] mb-1">
          Confirm subscription
        </h2>
        <p className="text-[var(--muted-color)] text-sm mb-6">
          Review your plan details before activating.
        </p>

        {/* Plan summary */}
        <div className="rounded-xl border border-[var(--border-color)] p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-lg text-[var(--heading-color)]">{plan.name} Plan</span>
            {plan.isPopular && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(200,169,107,0.15)', color: '#c8a96b', border: '1px solid rgba(200,169,107,0.3)' }}>
                Popular
              </span>
            )}
          </div>
          <div className="flex items-end gap-1.5 mb-3">
            <span className="font-black text-3xl text-[var(--heading-color)]">{plan.price} QAR</span>
            <span className="text-[var(--muted-color)] text-sm mb-0.5">/ {freqLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(14,165,160,0.1)', color: '#0ea5a0', border: '1px solid rgba(14,165,160,0.25)' }}>
              {freqName} billing
            </span>
            {plan.discountPercent > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(200,169,107,0.1)', color: '#c8a96b', border: '1px solid rgba(200,169,107,0.25)' }}>
                {plan.discountPercent}% booking discount
              </span>
            )}
          </div>
        </div>

        {/* Key features */}
        {(plan.features || []).slice(0, 4).map((f, i) => {
          const text = typeof f === 'string' ? f : f.featureText;
          return (
            <div key={i} className="flex items-center gap-2.5 text-sm text-[var(--text-color)] mb-2">
              <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(14,165,160,0.12)', color: '#0ea5a0' }}>
                <Check size={10} />
              </span>
              {text}
            </div>
          );
        })}

        <p className="text-[var(--muted-color)] text-xs mt-4 mb-6">
          No contracts. You can cancel anytime from your account.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-semibold text-sm border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--heading-color)] transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: loading ? 'rgba(200,169,107,0.4)' : 'linear-gradient(135deg,#c8a96b,#d4b87a)',
              color: '#0d1117',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Activating…</>
              : <><Check size={14} /> Confirm subscription</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Plans() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const { showToast } = useToast();

  const [plans,         setPlans]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [vehicleType,   setVehicleType]   = useState('Sedan');

  const styleRef = useRef(null);
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement('style');
      el.textContent = PLANS_CSS;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    return () => { if (styleRef.current) { styleRef.current.remove(); styleRef.current = null; } };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plansData, myData] = await Promise.allSettled([
          subscriptionsAPI.getPlans(vehicleType),
          user?.role === 'Customer' ? subscriptionsAPI.getMy() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (plansData.status === 'fulfilled') {
          const sorted = [...(plansData.value || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          setPlans(sorted);
        }
        if (myData.status === 'fulfilled' && myData.value) {
          setCurrentPlanId(myData.value.planId ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, vehicleType]);

  // Step 1: navigate to checkout page with plan data
  const handleSelect = (planId) => {
    if (!user) {
      navigate('/register', { state: { redirectTo: '/plans', planId } });
      return;
    }
    if (user.role !== 'Customer') {
      showToast('Only customer accounts can subscribe.', 'error');
      return;
    }
    const plan = plans.find(p => p.id === planId) || null;
    if (plan) navigate('/subscribe', { state: { plan } });
  };

  // Loading skeleton
  if (loading) {
    return <LoadingCircle fullScreen label="Loading plans..." />;
  }

  // Fallback static plans if API fails
  const displayPlans = plans;

  return (
    <>
      <SEO title="Subscription Plans — Flowly" description="Choose the car detailing subscription plan that fits your lifestyle. Plans for every vehicle type." />

      <section className="relative overflow-hidden pb-24 pt-16 px-4">

        {/* Background orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'rgba(200,169,107,0.06)', filter: 'blur(100px)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'rgba(14,165,160,0.05)', filter: 'blur(90px)' }} />

        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-5"
            style={{ background: 'rgba(200,169,107,0.1)', border: '1px solid rgba(200,169,107,0.2)', color: '#c8a96b' }}>
            <Zap size={11} /> Subscription Plans
          </span>
          <h1 className="premium-heading text-4xl md:text-5xl font-black text-[var(--heading-color)] mb-5 leading-tight">
            Your car, always&nbsp;
            <span style={{
              background: 'linear-gradient(135deg, #c8a96b 0%, #0ea5a0 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>spotless</span>
          </h1>
          <p className="text-[var(--muted-color)] text-lg leading-relaxed max-w-xl mx-auto">
            Select your vehicle type to see available plans. No contracts — cancel anytime.
          </p>
        </div>

        {/* Vehicle type selector */}
        <div className="max-w-md mx-auto mb-10 flex items-center justify-center gap-2 rounded-xl p-1 border border-[var(--border-color)] bg-[var(--card-bg)]">
          {VEHICLE_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => setVehicleType(v)}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: vehicleType === v ? 'rgba(200,169,107,0.15)' : 'transparent',
                color:      vehicleType === v ? '#c8a96b' : 'var(--muted-color)',
                border:     vehicleType === v ? '1px solid rgba(200,169,107,0.3)' : '1px solid transparent',
              }}>
              {v}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {displayPlans.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 text-center py-16">
              <p className="text-[var(--muted-color)] text-sm">No plans available for {vehicleType} yet.</p>
            </div>
          ) : displayPlans.map((plan) => {
            const cfg = VEHICLE_CONFIG[plan.vehicleType] || VEHICLE_CONFIG.Sedan;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                cfg={cfg}
                onSelect={handleSelect}
                subscribing={false}
                currentPlanId={currentPlanId}
                isLoggedIn={!!user}
              />
            );
          })}
        </div>

        {/* My subscription link */}
        {currentPlanId && (
          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/my-subscription')}
              className="inline-flex items-center gap-2 text-sm text-[var(--muted-color)] hover:text-[var(--heading-color)] transition-colors">
              Manage your current subscription <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Value props */}
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: <Shield size={20} />, title: 'No contracts', body: 'Cancel anytime. Your subscription runs to the end of the billing period.' },
              { icon: <CalendarDays size={20} />, title: 'Flexible scheduling', body: 'Book any time that suits you. Your discount applies automatically.' },
              { icon: <UserCheck size={20} />, title: 'Trusted cleaners', body: 'Professional cleaners assigned to your vehicle type every time.' },
            ].map(({ icon, title, body }) => (
              <div key={title} className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] text-left">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
                  style={{ background: 'rgba(200,169,107,0.1)', color: '#c8a96b' }}>
                  {icon}
                </span>
                <h4 className="font-semibold text-[var(--heading-color)] text-sm mb-1">{title}</h4>
                <p className="text-[var(--muted-color)] text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

      </section>
    </>
  );
}