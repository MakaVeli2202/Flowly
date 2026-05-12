import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Info,
  Rocket, RefreshCw, Terminal, CreditCard, MessageSquare, Star,
  ChevronRight, Wrench, ShieldAlert, LogOut,
} from 'lucide-react';
import { useFeatures } from '../../context/FeaturesContext';
import { useSettings } from '../../context/SettingsContext';
import { settingsAPI } from '../../api/settings';

/* ─── Dev flags stored in localStorage ──────────────────────────────────────
   These are FRONTEND-ONLY overrides. They bypass checks in the UI layer.
   They have no effect on the backend.
   ─────────────────────────────────────────────────────────────────────────── */
const DEV_FLAGS = [
  {
    key: 'DEV_BYPASS_REVIEW',
    label: 'Bypass Google Review Requirement',
    description: 'Unlocks the loyalty counter without requiring the user to click "Rate on Google". Use this while testing loyalty flows so you\'re not blocked by the review gate.',
    category: 'Loyalty',
    icon: Star,
    accent: '#c8a96b',
    warning: null,
  },
  {
    key: 'DEV_BYPASS_PAYMENT',
    label: 'Bypass Payment Processing',
    description: 'Skips payment redirect in the UI for local testing. Bookings can still be created without a live Tap checkout.',
    category: 'Payments',
    icon: CreditCard,
    accent: '#0ea5a0',
    warning: 'Frontend-only bypass. Disable before production.',
  },
  {
    key: 'DEV_SMS_SILENT',
    label: 'Silent SMS Mode',
    description: 'Suppresses SMS sends from the frontend layer (booking confirmations, OTPs). SMS content is logged to the browser console instead. Does not affect backend-triggered SMS.',
    category: 'Notifications',
    icon: MessageSquare,
    accent: '#c8a96b',
    warning: 'Backend sends are not suppressed. Disable before production.',
  },
  {
    key: 'DEV_REVIEWS_TOGGLE',
    label: 'Review Mode Toggle',
    description: 'Switch between real API reviews and hardcoded fallback reviews. Enables the tiger (🔴 REAL / 🟡 HARDCODED) toggle button on the homepage for testing review display without waiting for API data.',
    category: 'Reviews',
    icon: Star,
    accent: '#f59e0b',
    warning: null,
  },
];

/* ─── Backend feature flags (read-only display) ──────────────────────────── */
const FEATURE_FLAG_META = {
  payments:         { label: 'Payment Processing',         description: 'Tap live/test payment collection.' },
  subscriptions:    { label: 'Subscription Plans',         description: 'Customer-facing subscription tiers.' },
  slotReservation:  { label: 'Slot Reservation (15-min)',  description: 'Temporary slot hold during checkout.' },
  smartAssignment:  { label: 'Smart Worker Assignment',    description: 'Auto-assign workers based on proximity & schedule.' },
  loyalty:          { label: 'Loyalty Rewards',            description: 'Loyalty counter, reward cycles, and coupon generation.' },
  favoriteDetailer: { label: 'Favourite Detailer',         description: 'Customer can request a preferred detailer.' },
};

/* ─── Deployment readiness checklist ─────────────────────────────────────── */
const DEPLOY_CHECKS = [
  { id: 'tap_live',        label: 'Tap live keys configured',                  category: 'Payments' },
  { id: 'tap_webhooks',    label: 'Tap webhooks pointed at production URL',    category: 'Payments' },
  { id: 'sms_live',        label: 'SMS provider using live credentials',        category: 'Notifications' },
  { id: 'google_review',   label: 'Google review URL verified and working',     category: 'Reviews' },
  { id: 'dev_flags_off',   label: 'All dev flags (DEV_*) cleared',              category: 'Dev Flags' },
  { id: 'features_on',     label: 'Backend feature flags enabled as intended',  category: 'Feature Flags' },
  { id: 'env_vars',        label: 'Frontend env vars pointing to production API', category: 'Infra' },
  { id: 'https',           label: 'HTTPS enforced (HTTP redirects to HTTPS)',   category: 'Infra' },
  { id: 'cors',            label: 'CORS restricted to production domain only',  category: 'Infra' },
  { id: 'error_pages',     label: '404 and 500 error pages tested',             category: 'UX' },
  { id: 'mobile_test',     label: 'Tested on real mobile device (iOS + Android)', category: 'UX' },
  { id: 'booking_e2e',     label: 'End-to-end booking flow tested (live payment)', category: 'E2E' },
];

const CHECKLIST_KEY = 'glanz_deploy_checklist';

function loadChecklist() {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
}

/* ─── Toggle component ───────────────────────────────────────────────────── */
function DevToggle({ flag, value, onChange }) {
  const Icon = flag.icon;
  return (
    <div
      className="glass-card p-5 relative overflow-hidden"
      style={{ borderTop: `2px solid ${flag.accent}30` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${flag.accent}15`, border: `1px solid ${flag.accent}30` }}>
            <Icon size={16} style={{ color: flag.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-bold text-[var(--heading-color)]">{flag.label}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${flag.accent}15`, color: flag.accent }}>
                {flag.category}
              </span>
              {value && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted-color)] leading-relaxed">{flag.description}</p>
            {flag.warning && (
              <div className="flex items-start gap-1.5 mt-2 text-amber-400">
                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                <span className="text-[11px]">{flag.warning}</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(flag.key, !value)}
          className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-80"
          aria-label={value ? 'Disable' : 'Enable'}
        >
          {value
            ? <ToggleRight size={32} style={{ color: flag.accent }} />
            : <ToggleLeft size={32} className="text-[var(--muted-color)] opacity-50" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function AdminDevSettings() {
  const features = useFeatures();

  const [devFlags, setDevFlags] = useState(() => {
    const state = {};
    DEV_FLAGS.forEach(f => { state[f.key] = !!localStorage.getItem(f.key); });
    return state;
  });

  const [checklist, setChecklist] = useState(loadChecklist);

  const { sitePublished } = useSettings();
  const [isSavingPublish, setIsSavingPublish] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [hasGateToken, setHasGateToken] = useState(() => !!localStorage.getItem('glanz.site-gate-token'));

  const handlePublishToggle = async () => {
    try {
      setIsSavingPublish(true);
      setPublishError('');
      await settingsAPI.updateSystemSettings({ SitePublished: !sitePublished });
    } catch (err) {
      setPublishError(err?.response?.data?.message || 'Failed to update site visibility.');
    } finally {
      setIsSavingPublish(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('glanz.site-gate-token');
    setHasGateToken(false);
  };

  const handleDevToggle = useCallback((key, enabled) => {
    if (enabled) {
      localStorage.setItem(key, '1');
    } else {
      localStorage.removeItem(key);
    }
    setDevFlags(prev => ({ ...prev, [key]: enabled }));
  }, []);

  const handleChecklistToggle = useCallback((id) => {
    setChecklist(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAllDevFlags = useCallback(() => {
    DEV_FLAGS.forEach(f => localStorage.removeItem(f.key));
    setDevFlags(Object.fromEntries(DEV_FLAGS.map(f => [f.key, false])));
  }, []);

  const anyDevFlagActive = DEV_FLAGS.some(f => devFlags[f.key]);
  const checklistDone = DEPLOY_CHECKS.filter(c => checklist[c.id]).length;

  return (
    <div className="min-h-screen py-10 md:py-14 text-[var(--text-color)]"
      style={{
        background: 'radial-gradient(circle at 10% 15%, rgba(200,169,107,0.10), transparent 32%), radial-gradient(circle at 85% 8%, rgba(14,165,160,0.08), transparent 28%), linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)',
      }}>
      <div className="container mx-auto px-4 max-w-4xl">

        {/* ── Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-color)] mb-4">
            <Link to="/admin" className="hover:text-primary transition">Dashboard</Link>
            <ChevronRight size={12} />
            <span>Dev Settings</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)' }}>
              <Wrench size={22} style={{ color: '#c8a96b' }} />
            </div>
            <div>
              <h1 className="premium-heading text-2xl md:text-3xl font-bold text-[var(--heading-color)]">
                Developer Settings
              </h1>
              <p className="text-[var(--muted-color)] text-sm mt-1">
                Frontend-only dev overrides, feature flag inspector, and deployment checklist.
                <strong className="text-amber-400"> These settings live in your browser only — clear them before going live.</strong>
              </p>
            </div>
          </div>

          {anyDevFlagActive && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <ShieldAlert size={16} />
                Dev flags are active — do not deploy with these enabled.
              </div>
              <button
                onClick={clearAllDevFlags}
                className="text-xs font-bold text-amber-400 border border-amber-500/35 px-3 py-1.5 rounded-lg hover:bg-amber-500/15 transition flex items-center gap-1.5"
              >
                <RefreshCw size={11} /> Clear All
              </button>
            </div>
          )}
        </div>

        {/* ── Site Access ── */}
        {hasGateToken && (
          <section className="mb-10">
            <div className="rounded-2xl border border-white/10 bg-[#0a1020]/90 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.26em] text-white/40 font-bold">Admin access</p>
                  <p className="text-lg font-semibold text-white">{sitePublished ? 'Site is published' : 'Private preview unlocked'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePublishToggle}
                    disabled={isSavingPublish}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
                  >
                    {isSavingPublish ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-primary/35 border-t-primary" />
                        Saving
                      </>
                    ) : sitePublished ? (
                      <>
                        <ToggleRight size={14} />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={14} />
                        Publish
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10"
                    title="Logout"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-start gap-2 text-xs text-white/50">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 flex-shrink-0" />
                <span>{sitePublished ? 'Anyone can browse the full website.' : 'Only this browser can bypass the private page until you publish.'}</span>
              </div>
              {publishError && <p className="mt-2 text-xs text-rose-300">{publishError}</p>}
            </div>
          </section>
        )}

        {/* ── Dev flag toggles ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Terminal size={15} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Dev Overrides
            </h2>
            <span className="text-xs text-[var(--muted-color)] ml-1">(browser localStorage only)</span>
          </div>
          <div className="space-y-3">
            {DEV_FLAGS.map(flag => (
              <DevToggle
                key={flag.key}
                flag={flag}
                value={devFlags[flag.key]}
                onChange={handleDevToggle}
              />
            ))}
          </div>
        </section>

        {/* ── Backend feature flags (read-only) ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Info size={15} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Backend Feature Flags
            </h2>
            <span className="text-xs text-[var(--muted-color)] ml-1">(read-only — change via DB or admin settings)</span>
          </div>
          <div className="glass-card divide-y divide-[var(--border-color)]">
            {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => {
              const enabled = features[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--heading-color)]">{meta.label}</p>
                    <p className="text-xs text-[var(--muted-color)] mt-0.5">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      enabled
                        ? 'border-green-500/30 bg-green-500/12 text-green-400'
                        : 'border-[var(--border-color)] bg-white/3 text-[var(--muted-color)]'
                    }`}>
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted-color)] mt-2 ml-1">
            Edit at <Link to="/admin/settings" className="text-primary hover:underline">Admin → Settings</Link> or via DB: <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">UPDATE AppSettings SET value='true' WHERE key='feature.payments'</code>
          </p>
        </section>

        {/* ── Deployment readiness checklist ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Rocket size={15} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
                Deployment Readiness
              </h2>
            </div>
            <span className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-full border"
              style={{
                borderColor: checklistDone === DEPLOY_CHECKS.length ? 'rgba(132,204,22,0.35)' : 'rgba(200,169,107,0.30)',
                background:  checklistDone === DEPLOY_CHECKS.length ? 'rgba(132,204,22,0.10)' : 'rgba(200,169,107,0.07)',
                color:       checklistDone === DEPLOY_CHECKS.length ? '#84cc16' : '#c8a96b',
              }}>
              {checklistDone} / {DEPLOY_CHECKS.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/8 rounded-full h-1.5 mb-4 overflow-hidden">
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${(checklistDone / DEPLOY_CHECKS.length) * 100}%`,
                background: 'linear-gradient(90deg, rgba(200,169,107,0.9), rgba(14,165,160,0.85))',
              }} />
          </div>

          <div className="glass-card divide-y divide-[var(--border-color)]">
            {DEPLOY_CHECKS.map(item => (
              <label key={item.id}
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/3 transition select-none">
                <div
                  onClick={() => handleChecklistToggle(item.id)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checklist[item.id]
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-[var(--border-color)] bg-transparent'
                  }`}
                >
                  {checklist[item.id] && <CheckCircle2 size={12} className="text-green-400" />}
                </div>
                <div className="flex-1 min-w-0" onClick={() => handleChecklistToggle(item.id)}>
                  <span className={`text-sm ${checklist[item.id] ? 'line-through text-[var(--muted-color)]' : 'text-[var(--text-color)]'}`}>
                    {item.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(200,169,107,0.08)', color: 'rgba(200,169,107,0.6)' }}>
                  {item.category}
                </span>
              </label>
            ))}
          </div>

          {checklistDone === DEPLOY_CHECKS.length && (
            <div className="mt-4 flex items-center gap-2 text-green-400 text-sm font-semibold">
              <CheckCircle2 size={16} />
              All checks passed — ready to deploy.
            </div>
          )}
        </section>

        {/* ── Quick nav ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Related Pages
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { to: '/admin/settings',      label: 'System Settings',    sub: 'Pricing, buffers, notifications' },
              { to: '/admin/notifications', label: 'Notifications',       sub: 'SMS & email logs' },
              { to: '/admin/offers',        label: 'Loyalty & Offers',    sub: 'Programs, coupons, triggers' },
            ].map(({ to, label, sub }) => (
              <Link key={to} to={to}
                className="glass-card p-4 flex items-center justify-between gap-2 hover:border-primary/40 transition group">
                <div>
                  <p className="text-sm font-semibold text-[var(--heading-color)] group-hover:text-primary transition">{label}</p>
                  <p className="text-xs text-[var(--muted-color)] mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--muted-color)] group-hover:text-primary transition flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
