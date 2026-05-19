import React, { useEffect, useState } from 'react';
import {
  CreditCard, Zap, Users, Calendar, BarChart2,
  CheckCircle, ArrowRight, AlertCircle, ExternalLink,
} from 'lucide-react';
import { billingAPI } from '../../api/billing';

const FEATURE_LABELS = {
  payments: 'Payments',
  subscriptions: 'Subscriptions',
  inventory: 'Inventory',
  ai_assistant: 'AI Assistant',
  marketing: 'Marketing',
  worker_tracking: 'Worker Tracking',
  loyalty: 'Loyalty Program',
  referrals: 'Referrals',
  multi_location: 'Multi-Location',
  white_label: 'White Label',
};

function PlanCard({ plan, current, onSelect, loading }) {
  const isCurrent = current?.planId === plan.id;
  return (
    <div className={`relative rounded-2xl border p-6 transition-all ${
      isCurrent
        ? 'border-[var(--brand-primary,#c8a96b)] bg-[var(--brand-primary,#c8a96b)]/5'
        : 'border-border bg-surface-card hover:border-[var(--brand-primary,#c8a96b)]/50'
    }`}>
      {isCurrent && (
        <span className="absolute -top-3 left-6 px-3 py-1 bg-[var(--brand-primary,#c8a96b)] text-black text-xs font-bold rounded-full">
          Current Plan
        </span>
      )}

      <h3 className="text-xl font-bold mb-1">{plan.name}</h3>

      <div className="mb-4">
        <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
        <span className="text-muted text-sm">/mo</span>
        {plan.annualPrice > 0 && (
          <p className="text-xs text-muted mt-1">${plan.annualPrice}/yr (save {Math.round((1 - plan.annualPrice / (plan.monthlyPrice * 12)) * 100)}%)</p>
        )}
      </div>

      <ul className="space-y-2 mb-6 text-sm">
        <li className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          {plan.maxLocations === 999 ? 'Unlimited' : plan.maxLocations} location{plan.maxLocations !== 1 ? 's' : ''}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          {plan.maxStaff === 999 ? 'Unlimited' : plan.maxStaff} staff
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          {plan.maxBookingsPerMonth === 0 ? 'Unlimited' : plan.maxBookingsPerMonth.toLocaleString()} bookings/mo
        </li>
        {Object.entries(plan.features || {})
          .filter(([, v]) => v)
          .map(([k]) => (
            <li key={k} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              {FEATURE_LABELS[k] || k}
            </li>
          ))}
      </ul>

      <button
        onClick={() => onSelect(plan)}
        disabled={isCurrent || loading}
        className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
          isCurrent
            ? 'bg-[var(--brand-primary,#c8a96b)]/20 text-[var(--brand-primary,#c8a96b)] cursor-default'
            : 'bg-[var(--brand-primary,#c8a96b)] text-black hover:opacity-90'
        }`}
      >
        {isCurrent ? 'Active' : loading ? 'Redirecting...' : 'Select Plan'}
        {!isCurrent && !loading && <ArrowRight className="inline w-3 h-3 ml-1" />}
      </button>
    </div>
  );
}

export default function AdminBilling() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    Promise.all([
      billingAPI.getPlans().catch(() => []),
      billingAPI.getSubscription().catch(() => null),
      billingAPI.getUsage().catch(() => null),
    ]).then(([p, s, u]) => {
      setPlans(p);
      setSubscription(s);
      setUsage(u);
      setLoading(false);
    });
  }, []);

  const handleSelectPlan = async (plan) => {
    setCheckoutLoading(true);
    setError('');
    try {
      const result = await billingAPI.createCheckoutSession(
        plan.id,
        billingCycle,
        `${window.location.origin}/admin/billing?success=1`,
        `${window.location.origin}/admin/billing?cancelled=1`,
      );
      if (result?.url) window.location.href = result.url;
      else setError('Stripe billing is not yet configured.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Billing not yet configured. Set Stripe:SecretKey in server config.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const result = await billingAPI.createBillingPortalSession(`${window.location.origin}/admin/billing`);
      if (result?.url) window.location.href = result.url;
      else setError('Stripe billing portal is not yet configured.');
    } catch {
      setError('Billing portal not yet configured.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-muted">Loading...</div>;
  }

  const usagePercent = usage && subscription
    ? Math.min(100, Math.round((usage.bookingCount / (plans.find(p => p.id === subscription.planId)?.maxBookingsPerMonth || 1)) * 100))
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[var(--brand-primary,#c8a96b)]" /> Billing & Plan
        </h1>
        <p className="text-muted text-sm">Manage your subscription and usage.</p>
      </div>

      {/* Current subscription summary */}
      {subscription ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-card border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">Plan</p>
            <p className="text-xl font-bold">{subscription.planName}</p>
            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-semibold ${
              subscription.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>{subscription.status}</span>
          </div>
          <div className="bg-surface-card border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">Billing Cycle</p>
            <p className="text-xl font-bold capitalize">{subscription.billingCycle || 'Monthly'}</p>
            <p className="text-xs text-muted">Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
          </div>
          <div className="bg-surface-card border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">Bookings This Month</p>
            <p className="text-xl font-bold">{usage?.bookingCount ?? '-'}</p>
            {usagePercent > 0 && (
              <div className="h-1.5 bg-border rounded-full mt-2">
                <div
                  className={`h-full rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : 'bg-[var(--brand-primary,#c8a96b)]'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm">No active subscription. Select a plan below to get started.</p>
        </div>
      )}

      {/* Billing portal link */}
      {subscription?.isActive && (
        <button
          onClick={handleBillingPortal}
          disabled={portalLoading}
          className="btn btn-outline flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          {portalLoading ? 'Opening...' : 'Manage Billing (Stripe Portal)'}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Plan selector */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Available Plans</h2>
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 transition-colors ${billingCycle === 'monthly' ? 'bg-[var(--brand-primary,#c8a96b)] text-black font-semibold' : 'text-muted hover:text-foreground'}`}
            >Monthly</button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 transition-colors ${billingCycle === 'annual' ? 'bg-[var(--brand-primary,#c8a96b)] text-black font-semibold' : 'text-muted hover:text-foreground'}`}
            >Annual</button>
          </div>
        </div>

        {plans.length === 0 ? (
          <p className="text-muted text-sm">No plans available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={subscription}
                onSelect={handleSelectPlan}
                loading={checkoutLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
