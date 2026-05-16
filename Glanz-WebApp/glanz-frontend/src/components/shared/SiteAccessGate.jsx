import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const GATE_TOKEN_STORAGE_KEY = 'flowly.site-gate-token';
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
  const [showLogin, setShowLogin] = useState(false);
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
      setShowLogin(false);
    } catch (err) {
      console.error('Gate verify error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isLoaded) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-primary/30 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-primary"
            style={{ width: '60%', animation: 'settings-bar 1.4s ease-in-out infinite alternate' }}
          />
        </div>
        <style>{`
          @keyframes settings-bar {
            from { transform: translateX(-100%); }
            to   { transform: translateX(200%); }
          }
        `}</style>
      </>
    );
  }

  if (!siteOpen) {
    return (
      <div
        className="min-h-screen overflow-hidden text-white relative flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 20% 20%, rgba(200,169,107,0.18), transparent 28%), radial-gradient(circle at 80% 10%, rgba(14,165,160,0.16), transparent 26%), linear-gradient(160deg, #050816 0%, #0b1120 45%, #050816 100%)' }}
      >
        <div className="absolute inset-0 opacity-35 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_25%)]" />

        {/* Main coming-soon content */}
        <div className="relative z-10 container mx-auto px-4 py-16 flex flex-col items-center text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-primary mb-8">
            <Sparkles size={14} />
            Coming soon
          </div>

          <h1 className="premium-heading text-5xl sm:text-6xl md:text-7xl font-black leading-[0.92] mb-6">
            Something great<br />is on its way.
          </h1>
          <p className="text-base md:text-lg text-white/60 leading-relaxed max-w-xl mb-10">
            We're putting the finishing touches on Flowly â€” your premium vehicle cleaning service. Be the first to know when we launch.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mb-10">
            <CountdownStat value={remaining.days} label="Days" />
            <CountdownStat value={remaining.hours} label="Hours" />
            <CountdownStat value={remaining.minutes} label="Minutes" />
            <CountdownStat value={remaining.secs} label="Seconds" />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 max-w-sm w-full backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Clock3 size={18} className="text-primary flex-shrink-0" />
              <p className="text-sm text-white/55">
                Launching <span className="text-white font-semibold">{new Date(countdownTarget).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Staff login â€” subtle corner button */}
        <button
          onClick={() => { setShowLogin(true); setError(''); }}
          className="fixed bottom-5 right-5 z-20 h-10 w-10 rounded-full border border-white/15 bg-white/8 text-white/30 hover:text-white/70 hover:border-white/30 transition-all backdrop-blur-xl flex items-center justify-center"
          title="Staff login"
        >
          <Lock size={15} />
        </button>

        {/* Staff login overlay */}
        {showLogin && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4" onClick={() => setShowLogin(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0a1020]/95 p-7 shadow-2xl backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowLogin(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/25 text-primary">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40 font-bold">Staff access</p>
                  <h2 className="text-xl font-black text-white mt-0.5">Sign in</h2>
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
                  <label className="block text-xs font-bold uppercase tracking-[0.22em] text-white/45 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                    placeholder="admin@example.com"
                    autoComplete="email"
                    disabled={isVerifying}
                    autoFocus
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
                  className="premium-btn w-full inline-flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50 mt-1"
                >
                  {isVerifying ? 'Verifying...' : 'Unlock site'}
                  <ArrowRight size={17} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
