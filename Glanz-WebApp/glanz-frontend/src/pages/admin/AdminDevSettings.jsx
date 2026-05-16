import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Info,
  Rocket, RefreshCw, Terminal, CreditCard, MessageSquare, Star,
  ChevronRight, Wrench, ShieldAlert, LogOut, Database, Trash2,
  Globe, Server, Eye, EyeOff, BarChart3, Loader2, Clock, Save, AlertCircle,
  FastForward, Play, RotateCcw, FlaskConical, KeyRound, ExternalLink, Copy,
} from 'lucide-react';
import { useFeatures } from '../../context/FeaturesContext';
import { useSettings } from '../../context/SettingsContext';
import { settingsAPI } from '../../api/settings';
import { authAPI } from '../../api/auth';
import AppModal from '../../components/shared/AppModal';

/* â”€â”€â”€ Dev flags stored in localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€*/
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
    description: 'Switch between real API reviews and hardcoded fallback reviews. Enables the tiger toggle button on the homepage for testing review display without waiting for API data.',
    category: 'Reviews',
    icon: Star,
    accent: '#f59e0b',
    warning: null,
  },
];

/* â”€â”€â”€ Backend feature flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const FEATURE_FLAG_META = {
  payments:         { label: 'Payment Processing',         description: 'Tap live/test payment collection.' },
  subscriptions:    { label: 'Subscription Plans',         description: 'Customer-facing subscription tiers.' },
  slotReservation:  { label: 'Slot Reservation (15-min)',  description: 'Temporary slot hold during checkout.' },
  smartAssignment:  { label: 'Smart Worker Assignment',    description: 'Auto-assign workers based on proximity & schedule.' },
  loyalty:          { label: 'Loyalty Rewards',            description: 'Loyalty counter, reward cycles, and coupon generation.' },
  favoriteDetailer: { label: 'Favourite Detailer',         description: 'Customer can request a preferred detailer.' },
};

/* â”€â”€â”€ Deployment readiness checklist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const DEPLOY_CHECKS = [
  // Payments
  { id: 'tap_live',          label: 'Tap live keys configured (backend appsettings)',               category: 'Payments' },
  { id: 'tap_webhooks',      label: 'Tap webhooks pointed at production URL',                       category: 'Payments' },
  { id: 'tap_webhook_secret',label: 'TapPayments:WebhookSecret set in Render env vars',            category: 'Payments' },
  // Email (requires paid provider â€” SendGrid / Postmark / SES)
  { id: 'email_provider',    label: '[Paid] Email provider configured (SendGrid/Postmark/SES)',     category: 'Email' },
  { id: 'email_booking',     label: '[Paid] Booking confirmation email tested end-to-end',         category: 'Email' },
  { id: 'email_reset',       label: '[Paid] Password reset email tested end-to-end',               category: 'Email' },
  // Notifications
  { id: 'sms_live',          label: 'SMS provider using live credentials',                         category: 'Notifications' },
  // Monitoring (requires Sentry account â€” free tier available)
  { id: 'sentry_web',        label: '[Free tier] Sentry DSN configured in web app',                category: 'Monitoring' },
  { id: 'sentry_api',        label: '[Free tier] Sentry SDK added to .NET API',                    category: 'Monitoring' },
  { id: 'uptime_monitor',    label: '[Free] UptimeRobot or BetterUptime configured',               category: 'Monitoring' },
  // Analytics
  { id: 'analytics',         label: '[Free] GA4 tag added to index.html',                         category: 'Analytics' },
  // Legal
  { id: 'cookie_consent',    label: 'Cookie consent banner present (PDPL / GDPR)',                 category: 'Legal' },
  { id: 'privacy_policy',    label: 'Privacy policy page live and linked',                         category: 'Legal' },
  // Infra
  { id: 'jwt_secret',        label: 'JwtSettings:SecretKey set in Render env vars (32+ chars)',    category: 'Infra' },
  { id: 'env_vars',          label: 'Frontend env vars pointing to production API',                category: 'Infra' },
  { id: 'cors',              label: 'CORS restricted to production domain only',                   category: 'Infra' },
  { id: 'cors_render',       label: 'Render: Cors__AllowedOrigins__0=https://www.flowly.qa',       category: 'Infra' },
  { id: 'vercel_api_url',    label: 'Vercel: VITE_API_BASE_URL set to Render URL',                category: 'Infra' },
  { id: 'https',             label: 'HTTPS enforced (HTTP redirects to HTTPS)',                    category: 'Infra' },
  // SEO
  { id: 'sitemap_live',      label: 'sitemap.xml accessible at /sitemap.xml',                     category: 'SEO' },
  { id: 'google_search',     label: 'Google Search Console property verified',                     category: 'SEO' },
  // Quality
  { id: 'google_review',     label: 'Google review URL verified and working',                     category: 'Reviews' },
  { id: 'dev_flags_off',     label: 'All dev flags (DEV_*) cleared',                              category: 'Dev Flags' },
  { id: 'features_on',       label: 'Backend feature flags enabled as intended',                  category: 'Feature Flags' },
  { id: 'error_pages',       label: '404 and 500 error pages tested',                             category: 'UX' },
  { id: 'mobile_test',       label: 'Tested on real mobile device (iOS + Android)',               category: 'UX' },
  { id: 'booking_e2e',       label: 'End-to-end booking flow tested with live payment',           category: 'E2E' },
];

const CHECKLIST_KEY = 'flowly_deploy_checklist';

function loadChecklist() {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
}

/* â”€â”€â”€ Reset modes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const RESET_MODES = [
  {
    value: 'transactional_only',
    label: 'Transactional Only',
    description: 'Safest reset â€” wipes operational data only.',
    deletes: ['Bookings & items', 'Customers & vehicles', 'Workers (staff)', 'Notifications & audit logs', 'Leads, referrals, feedback'],
    keeps: ['Packages, Services, Products', 'Subscription Plans', 'Offers', 'Job Positions', 'System Settings'],
    color: '#f59e0b',
  },
  {
    value: 'keep_catalog',
    label: 'Keep Catalog',
    description: 'Wipes all user data, keeps your service catalog.',
    deletes: ['Bookings & items', 'Customers & vehicles', 'Workers (staff)', 'Notifications & audit logs', 'Leads, referrals, feedback', 'Job Applications'],
    keeps: ['Packages, Services, Products', 'Subscription Plans', 'Offers', 'Job Positions', 'System Settings'],
    color: '#c8a96b',
  },
  {
    value: 'full',
    label: 'Full Reset',
    description: 'Nuclear option â€” deletes everything except your admin account.',
    deletes: ['Bookings & items', 'Customers & vehicles', 'Workers (staff)', 'Packages, Services, Products', 'Subscription Plans & Packages', 'Offers', 'Job Positions & Applications', 'Notifications, Audit Logs', 'Leads, Referrals, Feedback'],
    keeps: ['Your admin account', 'System Settings (business config)'],
    color: '#ef4444',
  },
];

/* â”€â”€â”€ Subcomponents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function DevToggle({ flag, value, onChange }) {
  const Icon = flag.icon;
  return (
    <div className="glass-card p-5 relative overflow-hidden" style={{ borderTop: `2px solid ${flag.accent}30` }}>
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

function StatCard({ label, value, loading }) {
  return (
    <div className="glass-card p-4 text-center">
      {loading ? (
        <div className="h-7 w-12 mx-auto rounded-md bg-white/10 animate-pulse mb-1" />
      ) : (
        <p className="text-2xl font-bold tabular-nums text-[var(--heading-color)]">
          {value?.toLocaleString() ?? 'â€”'}
        </p>
      )}
      <p className="text-xs text-[var(--muted-color)] mt-0.5">{label}</p>
    </div>
  );
}

/* â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  const [hasGateToken, setHasGateToken] = useState(() => !!localStorage.getItem('flowly.site-gate-token'));

  // DB stats
  const [dbStats, setDbStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Reset modal
  const [resetModal, setResetModal] = useState(false);
  const [resetMode, setResetMode] = useState('keep_catalog');
  const [resetPassword, setResetPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(null);

  // Launch configuration state
  const [launchDate,    setLaunchDate]    = useState('');
  const [launchSaving,  setLaunchSaving]  = useState(false);
  const [launchSaved,   setLaunchSaved]   = useState(false);
  const [launchError,   setLaunchError]   = useState('');

  // Dev Auth Tools state
  const [resetTestEmail,   setResetTestEmail]   = useState('');
  const [resetTestLoading, setResetTestLoading] = useState(false);
  const [resetTestResult,  setResetTestResult]  = useState(null);
  const [resetTestError,   setResetTestError]   = useState('');

  // Dev Testing Panel state
  const TEST_MODE_KEY = 'flowly.dev-test-mode';
  const [testModeActive, setTestModeActive] = useState(() => !!localStorage.getItem(TEST_MODE_KEY));
  const [devOps, setDevOps] = useState({
    sim7d:    { loading: false, result: null, error: '' },
    cleanup30: { loading: false, result: null, error: '' },
    fullCleanup: { loading: false, result: null, error: '' },
  });

  const formatDateTimeLocal = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins  = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  useEffect(() => {
    settingsAPI.getSystemSettings().then(data => {
      if (data?.site?.launchDate) {
        try { setLaunchDate(formatDateTimeLocal(data.site.launchDate)); } catch { setLaunchDate(''); }
      }
    }).catch(() => {});
  }, []);

  const handleSaveLaunchDate = async () => {
    if (!launchDate) { setLaunchError('Launch date is required.'); return; }
    try {
      setLaunchSaving(true); setLaunchError('');
      await settingsAPI.updateSystemSettings({ SiteLaunchDate: new Date(launchDate).toISOString() });
      setLaunchSaved(true);
      setTimeout(() => setLaunchSaved(false), 3000);
    } catch (err) { setLaunchError(err?.response?.data?.message || 'Failed to save launch date.'); }
    finally { setLaunchSaving(false); }
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await settingsAPI.getDatabaseStats();
      setDbStats(data);
    } catch {
      setDbStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
    localStorage.removeItem('flowly.site-gate-token');
    setHasGateToken(false);
  };

  const handleDevToggle = useCallback((key, enabled) => {
    if (enabled) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
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

  const openResetModal = () => {
    setResetPassword('');
    setResetError('');
    setResetMode('keep_catalog');
    setShowPassword(false);
    setResetModal(true);
  };

  const handleReset = async () => {
    if (!resetPassword) return;
    setResetLoading(true);
    setResetError('');
    try {
      const result = await settingsAPI.resetDatabase(resetPassword, resetMode);
      setResetModal(false);
      setResetSuccess(result);
      await fetchStats();
    } catch (err) {
      setResetError(err?.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const runDevOp = async (key, apiFn) => {
    setDevOps(prev => ({ ...prev, [key]: { loading: true, result: null, error: '' } }));
    localStorage.setItem(TEST_MODE_KEY, '1');
    setTestModeActive(true);
    try {
      const data = await apiFn();
      setDevOps(prev => ({ ...prev, [key]: { loading: false, result: data, error: '' } }));
      await fetchStats();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Operation failed.';
      setDevOps(prev => ({ ...prev, [key]: { loading: false, result: null, error: msg } }));
    }
  };

  const handleResetTestMode = () => {
    localStorage.removeItem(TEST_MODE_KEY);
    setTestModeActive(false);
    setDevOps({ sim7d: { loading: false, result: null, error: '' }, cleanup30: { loading: false, result: null, error: '' }, fullCleanup: { loading: false, result: null, error: '' } });
  };

  const handleGenerateResetLink = async () => {
    if (!resetTestEmail.trim()) { setResetTestError('Enter an email address.'); return; }
    setResetTestLoading(true); setResetTestError(''); setResetTestResult(null);
    try {
      const data = await authAPI.devGenerateResetToken(resetTestEmail.trim());
      setResetTestResult(data);
    } catch (err) {
      setResetTestError(err?.response?.data?.message || 'Failed to generate token.');
    } finally { setResetTestLoading(false); }
  };

  const anyDevFlagActive = DEV_FLAGS.some(f => devFlags[f.key]);
  const checklistDone = DEPLOY_CHECKS.filter(c => checklist[c.id]).length;
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api (no env var set)';
  const buildMode = import.meta.env.MODE;

  const selectedMode = RESET_MODES.find(m => m.value === resetMode);

  return (
    <div className="min-h-screen py-10 md:py-14 text-[var(--text-color)]"
      style={{
        background: 'radial-gradient(circle at 10% 15%, rgba(200,169,107,0.10), transparent 32%), radial-gradient(circle at 85% 8%, rgba(14,165,160,0.08), transparent 28%), linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)',
      }}>
      <div className="container mx-auto px-4 max-w-4xl">

        {/* â”€â”€ Header â”€â”€ */}
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
                Dev overrides, feature flags, deployment checklist, DB stats, and danger zone.
                <strong className="text-amber-400"> Clear dev flags before going live.</strong>
              </p>
            </div>
          </div>

          {anyDevFlagActive && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <ShieldAlert size={16} />
                Dev flags are active â€” do not deploy with these enabled.
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

        {/* â”€â”€ Launch Configuration + Publish â”€â”€ */}
        <section className="mb-10">
          <div className="rounded-2xl border border-white/10 bg-[#0a1020]/90 p-5 shadow-2xl backdrop-blur-xl">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-primary" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">Launch Configuration</h2>
                  <p className="text-xs text-[var(--muted-color)]">Countdown timer target + site visibility</p>
                </div>
              </div>
              {hasGateToken && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePublishToggle}
                    disabled={isSavingPublish}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
                  >
                    {isSavingPublish ? (
                      <><span className="h-3.5 w-3.5 animate-spin rounded-full border border-primary/35 border-t-primary" />Saving</>
                    ) : sitePublished ? (
                      <><ToggleRight size={14} />Unpublish</>
                    ) : (
                      <><ToggleLeft size={14} />Publish</>
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
              )}
            </div>

            {/* Site status */}
            {hasGateToken && (
              <div className="mb-5 flex items-start gap-2 text-xs text-white/50">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 flex-shrink-0" />
                <span>{sitePublished ? 'Anyone can browse the full website.' : 'Only this browser can bypass the private page until you publish.'}</span>
              </div>
            )}
            {publishError && <p className="mb-4 text-xs text-rose-300">{publishError}</p>}

            {/* Launch date picker */}
            <p className="text-xs text-[var(--muted-color)] mb-4">
              Set the countdown timer target date and time. Visitors will see a countdown until this moment when the site is in private mode.
            </p>
            {launchError && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-4">
                <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-rose-300 text-sm">{launchError}</p>
              </div>
            )}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] block mb-2">Launch Date &amp; Time</label>
              <input
                type="datetime-local"
                value={launchDate}
                onChange={e => setLaunchDate(e.target.value)}
                disabled={launchSaving}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:border-primary/60 disabled:opacity-50"
              />
            </div>
            {launchDate && (
              <div className="rounded-xl border p-3 mb-4" style={{ background:'rgba(6,182,212,.07)', borderColor:'rgba(6,182,212,.28)' }}>
                <p className="text-xs text-[var(--muted-color)]">
                  <span style={{ color:'#06b6d4', fontWeight:700 }}>Target: </span>
                  {new Date(launchDate).toLocaleString()}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveLaunchDate}
              disabled={launchSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50"
              style={{ background:'rgba(6,182,212,.15)', border:'1px solid rgba(6,182,212,.35)', color:'#22d3ee' }}
            >
              {launchSaving ? 'Saving...' : launchSaved ? <><CheckCircle2 size={14}/> Saved</> : <><Save size={14}/> Save Launch Date</>}
            </button>
          </div>
        </section>

        {/* â”€â”€ Environment & API Info â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={15} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Environment
            </h2>
            <span className="text-xs text-[var(--muted-color)] ml-1">(build-time config)</span>
          </div>
          <div className="glass-card divide-y divide-[var(--border-color)]">
            {[
              { label: 'Build Mode', value: buildMode, highlight: buildMode === 'production' ? 'green' : 'amber' },
              { label: 'API Base URL', value: apiUrl, highlight: apiUrl.includes('onrender.com') ? 'green' : 'rose' },
              { label: 'Frontend Origin', value: typeof window !== 'undefined' ? window.location.origin : 'â€”', highlight: null },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <p className="text-sm text-[var(--muted-color)]">{label}</p>
                <code className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
                  highlight === 'green' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                  highlight === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                  highlight === 'rose'  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' :
                  'border-[var(--border-color)] bg-white/5 text-[var(--text-color)]'
                }`}>
                  {value}
                </code>
              </div>
            ))}
          </div>
          {!import.meta.env.VITE_API_BASE_URL && (
            <p className="mt-2 text-xs text-rose-400 ml-1">
              âš  VITE_API_BASE_URL is not set â€” API calls use relative /api path. Set it to{' '}
              <code className="bg-white/5 px-1 rounded">https://flowly-api.onrender.com/api</code> in Vercel dashboard.
            </p>
          )}
        </section>

        {/* â”€â”€ Database Stats â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
                Database Stats
              </h2>
            </div>
            <button
              onClick={fetchStats}
              disabled={statsLoading}
              className="text-xs font-bold text-[var(--muted-color)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg hover:border-primary/40 hover:text-primary transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={11} className={statsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {[
              { label: 'Customers', key: 'customers' },
              { label: 'Workers', key: 'workers' },
              { label: 'Bookings', key: 'bookings' },
              { label: 'Packages', key: 'packages' },
              { label: 'Services', key: 'services' },
              { label: 'Products', key: 'products' },
              { label: 'Offers', key: 'offers' },
              { label: 'Sub Plans', key: 'subscriptionPlans' },
              { label: 'Notifications', key: 'notifications' },
              { label: 'Audit Logs', key: 'auditLogs' },
            ].map(({ label, key }) => (
              <StatCard key={key} label={label} value={dbStats?.[key]} loading={statsLoading} />
            ))}
          </div>
        </section>

        {/* â”€â”€ Dev flag toggles â”€â”€ */}
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
              <DevToggle key={flag.key} flag={flag} value={devFlags[flag.key]} onChange={handleDevToggle} />
            ))}
          </div>
        </section>

        {/* â”€â”€ Backend feature flags (read-only) â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Info size={15} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Backend Feature Flags
            </h2>
            <span className="text-xs text-[var(--muted-color)] ml-1">(read-only â€” change via admin settings)</span>
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
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                    enabled
                      ? 'border-green-500/30 bg-green-500/12 text-green-400'
                      : 'border-[var(--border-color)] bg-white/3 text-[var(--muted-color)]'
                  }`}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted-color)] mt-2 ml-1">
            Edit at <Link to="/admin/settings" className="text-primary hover:underline">Admin â†’ Settings</Link>
          </p>
        </section>

        {/* â”€â”€ Dev Testing Panel â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical size={15} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
                Dev Testing Panel
              </h2>
              <span className="text-xs text-[var(--muted-color)] ml-1">(simulate time-based events)</span>
            </div>
            {testModeActive && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/12 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Test Mode Active
                </span>
                <button
                  type="button"
                  onClick={handleResetTestMode}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40 hover:text-primary transition"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Simulate 7-Day Forward */}
            {[
              {
                opKey: 'sim7d',
                label: 'Simulate 7 Days Forward',
                description: 'Deletes read notifications older than 7 days, stale unread notifications older than 14 days, expired slot reservations, and cancels pending unpaid bookings older than 7 days.',
                icon: FastForward,
                accent: '#c8a96b',
                apiFn: () => settingsAPI.simulateTimeForward(7),
              },
              {
                opKey: 'cleanup30',
                label: 'Cleanup Notifications (30d)',
                description: 'Permanently deletes all notifications (read and unread) older than 30 days. Use to clear notification backlog during testing.',
                icon: Trash2,
                accent: '#0ea5a0',
                apiFn: () => settingsAPI.cleanupNotifications(30),
              },
              {
                opKey: 'fullCleanup',
                label: 'Run Full Cleanup',
                description: 'Comprehensive sweep: expired slot reservations, read notifications 30d+, unread notifications 90d+, stale pending bookings 7d+.',
                icon: Play,
                accent: '#8b5cf6',
                apiFn: () => settingsAPI.runFullCleanup(),
              },
            ].map(({ opKey, label, description, icon: Icon, accent, apiFn }) => {
              const op = devOps[opKey];
              return (
                <div key={opKey} className="glass-card p-5" style={{ borderTop: `2px solid ${accent}30` }}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                      <Icon size={16} style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--heading-color)] mb-1">{label}</p>
                      <p className="text-xs text-[var(--muted-color)] leading-relaxed mb-3">{description}</p>

                      {op.error && (
                        <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 mb-3 text-xs text-rose-300">
                          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                          {op.error}
                        </div>
                      )}

                      {op.result && (
                        <div className="rounded-lg border border-green-500/25 bg-green-500/8 px-3 py-2 mb-3">
                          <p className="text-xs font-semibold text-green-400 mb-1">{op.result.message}</p>
                          {op.result.results && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {Object.entries(op.result.results).map(([k, v]) => (
                                <span key={k} className="text-[11px] text-[var(--muted-color)]">
                                  <span className="font-bold text-[var(--text-color)]">{v}</span> {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                              ))}
                            </div>
                          )}
                          {op.result.deleted != null && (
                            <span className="text-[11px] text-[var(--muted-color)]">
                              <span className="font-bold text-[var(--text-color)]">{op.result.deleted}</span> deleted
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={op.loading}
                        onClick={() => runDevOp(opKey, apiFn)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: `${accent}15`, border: `1px solid ${accent}35`, color: accent }}
                      >
                        {op.loading
                          ? <><Loader2 size={13} className="animate-spin" /> Runningâ€¦</>
                          : <><Icon size={13} /> {label}</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* â”€â”€ Dev Auth Tools â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={15} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Dev Auth Tools
            </h2>
            <span className="text-xs text-[var(--muted-color)] ml-1">(password reset testing)</span>
          </div>

          <div className="glass-card p-5" style={{ borderTop: '2px solid rgba(200,169,107,0.3)' }}>
            <p className="text-xs text-[var(--muted-color)] mb-4">
              Generates a real password reset token for any email without sending an email. Use this to test the reset-password flow end-to-end.
            </p>

            <div className="flex gap-3 mb-4">
              <input
                type="email"
                value={resetTestEmail}
                onChange={e => { setResetTestEmail(e.target.value); setResetTestError(''); setResetTestResult(null); }}
                placeholder="user@example.com"
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              />
              <button
                type="button"
                disabled={resetTestLoading}
                onClick={handleGenerateResetLink}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'rgba(200,169,107,0.15)', border: '1px solid rgba(200,169,107,0.35)', color: '#c8a96b' }}
              >
                {resetTestLoading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                {resetTestLoading ? 'Generating...' : 'Generate Link'}
              </button>
            </div>

            {resetTestError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 mb-3 text-xs text-rose-300">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{resetTestError}
              </div>
            )}

            {resetTestResult && (
              <div className="rounded-lg border border-green-500/25 bg-green-500/8 px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-green-400">Token generated - valid for 6 hours</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-[var(--text-color)] bg-[var(--surface-bg)] rounded-lg px-2 py-1.5 break-all border border-[var(--border-color)]">
                    {resetTestResult.resetUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(resetTestResult.resetUrl)}
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:text-primary transition flex-shrink-0"
                    title="Copy link"
                  >
                    <Copy size={12} />
                  </button>
                  <a
                    href={resetTestResult.resetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:text-primary transition flex-shrink-0"
                    title="Open link"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] text-[var(--muted-color)]">
                  Raw token: <span className="font-mono text-[var(--text-color)]">{resetTestResult.token}</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* â”€â”€ Deployment readiness checklist â”€â”€ */}
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
              All checks passed â€” ready to deploy.
            </div>
          )}
        </section>

        {/* â”€â”€ Danger Zone â”€â”€ */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-rose-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-rose-400">
              Danger Zone
            </h2>
          </div>

          {resetSuccess && (
            <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-1">
                <CheckCircle2 size={15} />
                Database reset successful ({resetSuccess.mode} mode)
              </div>
              <p className="text-xs text-[var(--muted-color)]">
                Deleted: {Object.entries(resetSuccess.deletedCounts || {})
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(', ')}
              </p>
              <button
                onClick={() => setResetSuccess(null)}
                className="mt-2 text-xs text-[var(--muted-color)] hover:text-[var(--text-color)] transition"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="rounded-2xl border-2 border-rose-500/25 bg-rose-500/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-rose-400 mb-1">Reset Database</p>
                <p className="text-xs text-[var(--muted-color)] leading-relaxed max-w-lg">
                  Wipes selected data from the database. Your admin account is always preserved.
                  Choose the reset mode in the confirmation dialog. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={openResetModal}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400 text-sm font-bold hover:bg-rose-500/25 transition"
              >
                <Trash2 size={15} />
                Reset DB
              </button>
            </div>
          </div>
        </section>

        {/* â”€â”€ Quick nav â”€â”€ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--heading-color)]">
              Related Pages
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { to: '/admin/settings',      label: 'System Settings',  sub: 'Pricing, buffers, notifications' },
              { to: '/admin/notifications', label: 'Notifications',    sub: 'SMS & email logs' },
              { to: '/admin/offers',        label: 'Loyalty & Offers', sub: 'Programs, coupons, triggers' },
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

      {/* â”€â”€ Reset Database Modal â”€â”€ */}
      <AppModal
        isOpen={resetModal}
        onClose={() => { if (!resetLoading) setResetModal(false); }}
        title="Reset Database"
        variant="danger"
        confirmLabel="Reset Database"
        cancelLabel="Cancel"
        onConfirm={handleReset}
        loading={resetLoading}
        size="lg"
      >
        <div className="space-y-4">
          {/* Mode selector */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Select reset mode</p>
            <div className="space-y-2">
              {RESET_MODES.map(mode => (
                <label
                  key={mode.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    resetMode === mode.value
                      ? 'border-rose-500/50 bg-rose-500/10'
                      : 'border-[var(--border-color)] hover:border-rose-500/30'
                  }`}
                  onClick={() => setResetMode(mode.value)}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition ${
                    resetMode === mode.value ? 'border-rose-400 bg-rose-400' : 'border-[var(--border-color)]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[var(--heading-color)]">{mode.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: `${mode.color}18`, color: mode.color }}>
                        {mode.value === 'full' ? 'NUCLEAR' : mode.value === 'transactional_only' ? 'SAFE' : 'RECOMMENDED'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-color)] mt-0.5">{mode.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* What gets deleted/kept */}
          {selectedMode && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                <p className="font-bold text-rose-400 mb-1.5 flex items-center gap-1">
                  <Trash2 size={11} /> Deletes
                </p>
                <ul className="space-y-1">
                  {selectedMode.deletes.map(d => (
                    <li key={d} className="text-[var(--muted-color)] flex items-start gap-1">
                      <span className="text-rose-400 mt-0.5">â€¢</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <p className="font-bold text-green-400 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Keeps
                </p>
                <ul className="space-y-1">
                  {selectedMode.keeps.map(k => (
                    <li key={k} className="text-[var(--muted-color)] flex items-start gap-1">
                      <span className="text-green-400 mt-0.5">â€¢</span> {k}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-[var(--muted-color)] uppercase tracking-widest mb-1.5 block">
              Admin password to confirm
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={e => { setResetPassword(e.target.value); setResetError(''); }}
                placeholder="Enter your admin password"
                className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 pr-10 text-sm text-[var(--text-color)] placeholder:text-[var(--muted-color)] focus:outline-none focus:border-primary/60 transition"
                onKeyDown={e => { if (e.key === 'Enter' && resetPassword) handleReset(); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {resetError && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                <AlertTriangle size={11} /> {resetError}
              </p>
            )}
          </div>
        </div>
      </AppModal>
    </div>
  );
}
