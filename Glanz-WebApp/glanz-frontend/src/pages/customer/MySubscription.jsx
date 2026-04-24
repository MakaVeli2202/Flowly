// MySubscription.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Repeat, Calendar, ArrowRight, XCircle, CheckCircle,
  AlertCircle, Zap, Star, Crown, RefreshCw, TrendingDown,
} from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { formatQAR } from '../../utils/currency';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';

const TIER_ICON  = { Basic: <Zap size={18} />, Smart: <Star size={18} />, Premium: <Crown size={18} /> };
const TIER_COLOR = { Basic: '#94a3b8', Smart: '#c8a96b', Premium: '#0ea5a0' };

export default function MySubscription() {
  const navigate   = useNavigate();
  const [sub,        setSub]        = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await subscriptionsAPI.getMy();
        setSub(data ?? null);
      } catch (err) {
        if (err?.response?.status !== 404)
          setError(err?.response?.data?.message || 'Failed to load subscription.');
      } finally { setLoading(false); }
    })();
  }, []);

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You will lose your benefits on future bookings.')) return;
    setCancelling(true);
    try {
      await subscriptionsAPI.cancelPlan();
      setCancelled(true);
      setSub(null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to cancel. Please try again.');
    } finally { setCancelling(false); }
  };

  const retryFetch = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await subscriptionsAPI.getMy();
      setSub(data ?? null);
    } catch (err) {
      if (err?.response?.status !== 404)
        setError(err?.response?.data?.message || 'Failed to load subscription.');
    } finally { setLoading(false); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen py-16" style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton variant="text" className="w-20 h-3" />
          </div>
          <div className="flex items-center gap-3 mb-1.5">
            <Skeleton variant="avatar" className="w-9 h-9" />
            <Skeleton variant="text" className="w-48 h-10" />
          </div>
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title="Failed to load subscription" description={error} actionLabel="Try Again" onAction={retryFetch} />
      </div>
    );
  }

  // ── No subscription ─────────────────────────────────────────────────────────────
  if (!sub) {
    return (
      <div className="min-h-screen py-16" style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          <div className="mb-2">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Account</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,169,107,.12)', border: '1px solid rgba(200,169,107,.24)' }}>
                <Repeat size={16} style={{ color: '#c8a96b' }} />
              </div>
              <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)]">My Subscription</h1>
            </div>
          </div>
          <EmptyState icon="repeat" title="No active subscription" description="Subscribe to get discounts on every booking." actionLabel="View Plans" onAction={() => navigate('/plans')} />
        </div>
      </div>
    );
  }

  const tierName  = sub?.planName || 'Plan';
  const tierColor = TIER_COLOR[tierName] || '#c8a96b';
  const tierIcon  = TIER_ICON[tierName]  || <Repeat size={18} />;

  return (
    <div className="min-h-screen py-16 relative"
      style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
      <div className="container mx-auto px-4 max-w-2xl space-y-6">

        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
            <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Account</p>
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
          </div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(200,169,107,.12)', border: '1px solid rgba(200,169,107,.24)' }}>
              <Repeat size={16} style={{ color: '#c8a96b' }} />
            </div>
            <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)]">My Subscription</h1>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3">
            <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-rose-300 text-sm font-semibold">{error}</p>
          </div>
        )}

        {cancelled && (
          <div className="glass-card p-8 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
            <p className="font-bold text-[var(--heading-color)] mb-1">Subscription cancelled</p>
            <p className="text-[var(--muted-color)] text-sm mb-6">Your benefits will no longer apply to new bookings.</p>
            <Link to="/plans"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
              Browse Plans <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {!sub && !cancelled && !error && (
          <div className="glass-card p-10 text-center">
            <Repeat size={48} className="mx-auto mb-4 text-[var(--muted-color)] opacity-40" />
            <p className="text-[var(--heading-color)] font-semibold mb-2">No active plan</p>
            <p className="text-[var(--muted-color)] text-sm mb-6">
              Subscribe to a plan and get discounts on every detailing session.
            </p>
            <Link to="/plans"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
              Browse Plans <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {sub && (
          <>
            <div className="glass-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(90deg,transparent,${tierColor} 38%,${tierColor}88 62%,transparent)` }} />
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${tierColor}18`, border: `1px solid ${tierColor}44`, color: tierColor }}>
                      {tierIcon}
                    </div>
                    <div>
                      <h2 className="font-bold text-xl text-[var(--heading-color)]">{sub.planName} Plan</h2>
                      <p className="text-xs text-[var(--muted-color)]">
                        {sub.billingCycle} billing · started {new Date(sub.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    style={{
                      color: sub.status === 'Active' ? '#10b981' : sub.status === 'Cancelled' ? '#ef4444' : '#c8a96b',
                      background: sub.status === 'Active' ? 'rgba(16,185,129,.12)' : sub.status === 'Cancelled' ? 'rgba(239,68,68,.12)' : 'rgba(200,169,107,.12)',
                    }}>
                    {sub.status || 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--muted-color)] text-xs mb-1">Your Discount</p>
                    <p className="font-black text-2xl" style={{ color: '#10b981' }}>{sub.discountPercent}%</p>
                    <p className="text-[var(--muted-color)] text-xs">off sessions</p>
                  </div>
                  <div className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--muted-color)] text-xs mb-1">Plan Price</p>
                    <p className="font-black text-2xl text-[var(--heading-color)]">{formatQAR(sub.price)}</p>
                    <p className="text-[var(--muted-color)] text-xs">per {(sub.billingCycle || 'Monthly').toLowerCase()}</p>
                  </div>
                  <div className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--muted-color)] text-xs mb-1">Vehicle Type</p>
                    <p className="font-black text-lg text-[var(--heading-color)]">{sub.vehicleType || '—'}</p>
                    <p className="text-[var(--muted-color)] text-xs">subscribed plan</p>
                  </div>
                </div>

                {sub.nextBillingDate && (
                  <p className="text-xs text-[var(--muted-color)] mb-5">
                    Next billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
                  </p>
                )}

                <button onClick={handleCancel} disabled={cancelling}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition font-semibold disabled:opacity-50">
                  <XCircle size={13} /> {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                </button>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} style={{ color: tierColor }} />
                <h3 className="font-bold text-[var(--heading-color)]">How your plan works</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  sub.discountPercent > 0 ? `${sub.discountPercent}% discount applied automatically when you book` : null,
                  'Pick your own date and time — full control over your schedule',
                  'Color-coded calendar shows availability at a glance',
                  'Cancel or reschedule from My Bookings anytime',
                  'Book as often as you like — discount applies every time',
                ].filter(Boolean).map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-color)]">
                    <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: tierColor }}>✓</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/subscription-booking')}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg,${tierColor},#0ea5a0)`, color: '#fff' }}>
                <Calendar size={16} />
                Book a Session
                <ArrowRight size={14} />
              </button>
              <Link to="/my-bookings"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                <RefreshCw size={14} />
                View My Bookings
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
