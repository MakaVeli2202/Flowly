import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const GATE_TOKEN_STORAGE_KEY = 'glanz.site-gate-token';
const FORCE_PUBLISHED = import.meta.env.VITE_FORCE_PUBLISHED === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';

function getRemaining(targetTime, now) {
  const total = Math.max(0, targetTime - now);
  const seconds = Math.floor(total / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return { days, hours, minutes, secs, total };
}

function CountdownStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur-xl">
      <div className="text-3xl md:text-4xl font-black tracking-tight text-white">{String(value).padStart(2, '0')}</div>
      <div className="mt-1 text-[0.62rem] uppercase tracking-[0.26em] text-white/40 font-bold">{label}</div>
    </div>
  );
}

export default function SiteAccessGate({ children }) {
  const { sitePublished, siteLaunchDate, isLoaded } = useSettings();
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem(GATE_TOKEN_STORAGE_KEY));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdownTarget = useMemo(() => {
    const parsed = siteLaunchDate ? new Date(siteLaunchDate).getTime() : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
    return new Date('2026-06-01T00:00:00Z').getTime();
  }, [siteLaunchDate]);

  const remaining = useMemo(() => getRemaining(countdownTarget, now), [countdownTarget, now]);
  const siteOpen = sitePublished || hasToken || FORCE_PUBLISHED;

  const handleVerifyCredentials = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/Settings/gate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data?.message || 'Invalid credentials or insufficient permissions.');
        return;
      }

      const data = await response.json();
      localStorage.setItem(GATE_TOKEN_STORAGE_KEY, data.token);
      setHasToken(true);
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Gate verify error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(200,169,107,0.08),transparent_36%),linear-gradient(160deg,var(--surface-bg)_0%,var(--surface-bg-alt)_52%,var(--surface-bg)_100%)] text-white">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-black/20 px-8 py-10 shadow-2xl backdrop-blur-xl">
          <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
          <p className="text-sm text-white/60 font-medium">Preparing site status...</p>
        </div>
      </div>
    );
  }

  if (!siteOpen) {
    return (
      <div className="min-h-screen overflow-hidden text-white relative" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(200,169,107,0.18), transparent 28%), radial-gradient(circle at 80% 10%, rgba(14,165,160,0.16), transparent 26%), linear-gradient(160deg, #050816 0%, #0b1120 45%, #050816 100%)' }}>
        <div className="absolute inset-0 opacity-35 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_25%),linear-gradient(transparent_0,transparent_95%,rgba(255,255,255,0.03)_100%)]" />
        <div className="relative z-10 container mx-auto min-h-screen px-4 py-10 md:py-16 flex items-center">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 w-full items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-primary">
                <Sparkles size={14} />
                Coming soon
              </div>
              <div className="space-y-4 max-w-2xl">
                <p className="text-xs uppercase tracking-[0.32em] text-white/45 font-semibold">Glanz Preview</p>
                <h1 className="premium-heading text-5xl sm:text-6xl md:text-7xl font-black leading-[0.92]">
                  The site is being prepared for launch.
                </h1>
                <p className="text-base md:text-lg text-white/65 leading-relaxed max-w-xl">
                  Visitors will see this launch screen until the site is published. Enter the private password to view the full website and manage publishing.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                <CountdownStat value={remaining.days} label="Days" />
                <CountdownStat value={remaining.hours} label="Hours" />
                <CountdownStat value={remaining.minutes} label="Minutes" />
                <CountdownStat value={remaining.secs} label="Seconds" />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 max-w-2xl backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <Clock3 size={18} className="mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-bold text-white">Launch target</p>
                    <p className="text-sm text-white/55 mt-1">Countdown target: {new Date(countdownTarget).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl opacity-60" />
              <div className="relative rounded-[2rem] border border-white/10 bg-[#0a1020]/85 p-6 md:p-8 shadow-2xl backdrop-blur-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/25 text-primary">
                    <LockKeyhole size={20} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/40 font-bold">Admin access</p>
                    <h2 className="text-2xl font-black text-white mt-1">Enter admin credentials</h2>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm flex items-start gap-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyCredentials} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.22em] text-white/45 mb-2">Admin email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="admin@example.com"
                      autoComplete="email"
                      disabled={isVerifying}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.22em] text-white/45 mb-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isVerifying}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="premium-btn w-full inline-flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying...' : 'Unlock site'}
                    <ArrowRight size={17} />
                  </button>
                </form>

                <div className="mt-5 rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                    <ShieldCheck size={16} className="text-primary" />
                    How it works
                  </div>
                  <p className="text-sm text-white/55 mt-2 leading-relaxed">
                    Only admin accounts can access the private preview page. Enter your admin email and password to view and manage the site before publishing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
