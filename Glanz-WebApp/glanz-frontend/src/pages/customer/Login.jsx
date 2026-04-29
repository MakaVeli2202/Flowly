import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../../components/shared/SEO';

/* ── PRISM CSS ─────────────────────────────────────────────── */
const PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg);          opacity: 0.28; }
  33%      { transform: translate(18px,-24px) rotate(120deg); opacity: 0.55; }
  66%      { transform: translate(-12px,12px) rotate(240deg); opacity: 0.38; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.5),  0 0 28px rgba(255,165,0,.2), 0 0 55px rgba(0,255,100,.15); }
  25%      { box-shadow: 0 0 0 1.5px rgba(255,210,0,.5),  0 0 28px rgba(0,255,150,.2), 0 0 55px rgba(0,150,255,.15); }
  50%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.5),  0 0 28px rgba(160,0,255,.2), 0 0 55px rgba(255,0,100,.15); }
  75%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.5),  0 0 28px rgba(255,0,100,.2), 0 0 55px rgba(255,210,0,.15); }
}
@keyframes hero-ring-pulse {
  0%,100% { transform: scale(1);     opacity: 0.38; }
  50%      { transform: scale(1.07); opacity: 0.62; }
}
@keyframes icon-pop-in {
  0%   { transform: scale(0.45) rotate(-18deg); opacity: 0; }
  70%  { transform: scale(1.12)  rotate(3deg);  opacity: 1; }
  100% { transform: scale(1)     rotate(0deg);  opacity: 1; }
}
@keyframes card-enter {
  from { transform: translateY(28px) scale(0.985); opacity: 0; }
  to   { transform: translateY(0)    scale(1);     opacity: 1; }
}
@keyframes field-in {
  from { transform: translateX(-10px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}

.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(85px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.055) 15%, rgba(255,200,0,.08) 30%,
    rgba(0,255,145,.07) 50%, rgba(0,145,255,.07) 70%,
    rgba(195,0,255,.05) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; transition: box-shadow 0.45s ease; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(
    circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.2) 0%, rgba(80,255,160,.14) 25%,
    rgba(40,130,255,.14) 50%, rgba(200,40,255,.1) 70%, transparent 86%
  );
  opacity: 0; transition: opacity 0.3s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.cta-prism-glow  { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.85) 12%, rgba(255,165,0,.9) 24%,
    rgba(255,255,0,.9) 36%, rgba(0,255,100,.9) 48%,
    rgba(0,150,255,.9) 60%, rgba(150,0,255,.85) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.45;
}
.card-enter { animation: card-enter  0.65s cubic-bezier(0.22,1,0.36,1) both; }
.icon-pop   { animation: icon-pop-in 0.70s cubic-bezier(0.34,1.56,0.64,1) 0.20s both; }
.field-1    { animation: field-in 0.42s ease 0.32s both; }
.field-2    { animation: field-in 0.42s ease 0.44s both; }
.btn-in     { animation: field-in 0.42s ease 0.56s both; }
.footer-in  { animation: field-in 0.42s ease 0.68s both; }
`;

/* ── Cursor orb ────────────────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY, rafId;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const tick = () => {
      curX += (mouseX - curX) * 0.09; curY += (mouseY - curY) * 0.09;
      const hue = (mouseX / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${curX}px,${curY}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.23),rgba(255,160,0,.21),rgba(255,255,0,.18),rgba(0,255,100,.21),rgba(0,160,255,.23),rgba(160,0,255,.21),rgba(255,0,80,.23))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}

/* ══════════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════════ */
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData,     setFormData]     = useState({ email: '', password: '' });
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from            = location.state?.from || '/';
  const selectedPackage = location.state?.selectedPackage;
  const message         = location.state?.message;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(formData.email, formData.password);
      if (selectedPackage)            navigate('/booking', { state: { selectedPackage }, replace: true });
      else if (from && from !== '/login') navigate(from, { replace: true });
      else                            navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <SEO title="Sign In" description="Sign in to your Glanz account to manage bookings and track your car detailing services." noindex />
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div
        className="min-h-screen flex items-center justify-center px-4 py-16 relative"
        style={{
          background: `
            radial-gradient(circle at 14% 18%, rgba(200,169,107,0.07) 0%, transparent 42%),
            radial-gradient(circle at 86% 82%, rgba(14,165,160,0.05) 0%, transparent 36%)
          `,
        }}
      >
        {/* Spectral backdrop orbs */}
        <div className="absolute top-10 -left-24 w-96 h-80 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.14),rgba(255,165,0,.1),rgba(200,169,107,.14),rgba(14,165,160,.09),rgba(200,169,107,.14))', filter: 'blur(88px)', animation: 'spectrum-float 18s ease-in-out infinite' }} />
        <div className="absolute bottom-10 -right-24 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 180deg,rgba(14,165,160,.12),rgba(0,120,255,.09),rgba(14,165,160,.12),rgba(200,169,107,.08),rgba(14,165,160,.12))', filter: 'blur(72px)', animation: 'spectrum-float 14s ease-in-out 7s infinite' }} />

        <div className="max-w-md w-full relative z-10">
          <div className="card-enter glass-card relative overflow-hidden">
            {/* Left accent bar */}
            <div className="absolute top-0 left-0 w-[2px] h-full"
              style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #0ea5a0 55%, transparent 100%)' }} />
            {/* Prism rays */}
            <div className="prism-ray" style={{ left: '65%', width: '15%', animation: 'prism-ray-sweep 14s ease-in-out 3s infinite' }} />
            <div className="prism-ray" style={{ left: '28%', width: '9%',  animation: 'prism-ray-sweep 20s ease-in-out 11s infinite' }} />

            <div className="p-8 md:p-10">

              {/* ── Icon header ──────────────────────────────────────── */}
              <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center mb-6">
                  {/* Outer conic pulse */}
                  <div className="absolute w-28 h-28 rounded-full"
                    style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.24),rgba(14,165,160,.17),rgba(255,165,0,.19),rgba(200,169,107,.24))', filter: 'blur(20px)', animation: 'hero-ring-pulse 3.5s ease-in-out infinite' }} />
                  {/* Mid ring */}
                  <div className="absolute w-18 h-18 rounded-full border border-primary/28"
                    style={{ width: 68, height: 68, background: 'rgba(200,169,107,0.05)', boxShadow: '0 0 30px rgba(200,169,107,0.13)' }} />
                  {/* Icon core */}
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center icon-pop prism-glass cursor-default"
                    style={{
                      background: 'linear-gradient(135deg, rgba(200,169,107,0.22) 0%, rgba(14,165,160,0.16) 100%)',
                      border: '1px solid rgba(200,169,107,0.42)',
                      boxShadow: '0 4px 24px rgba(200,169,107,0.22)',
                    }}
                    onMouseMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                      e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                    }}
                  >
                    <LogIn size={22} className="text-primary" />
                  </div>
                </div>

                {/* Badge — home hero pattern */}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                  <p className="uppercase tracking-[0.25em] text-primary text-[0.65rem] font-semibold whitespace-nowrap">
                    Welcome Back
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-2">
                  Sign In
                </h1>
                <p className="text-[var(--muted-color)] text-sm">Enter your credentials to continue</p>
              </div>

              {/* Spectrum separator */}
              <div className="mb-7"><div className="spectrum-line" /></div>

              {/* Banners */}
              {message && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/8 p-4">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={12} className="text-blue-400" />
                  </div>
                  <p className="text-blue-300 text-sm leading-relaxed">{message}</p>
                </div>
              )}
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 p-4">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={12} className="text-rose-400" />
                  </div>
                  <p className="text-rose-300 text-sm leading-relaxed">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email */}
                <div className="field-1">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type="email" name="email" value={formData.email} onChange={handleChange}
                      required placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="field-2">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                      required placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="btn-in pt-1">
                  <div className="cta-prism-glow rounded-2xl">
                    <button type="submit" disabled={loading}
                      className="premium-btn w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Signing in…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Sign In <ArrowRight size={16} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Trust row */}
              <div className="footer-in flex items-center justify-center gap-5 flex-wrap mt-4">
                {[
                  { icon: Shield,      label: '256-bit Encrypted'  },
                  { icon: CheckCircle, label: 'Your data is safe'  },
                ].map(({ icon: TIcon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-color)]">
                    <TIcon size={11} className="text-primary" />{label}
                  </div>
                ))}
              </div>

              {/* Switch */}
              <div className="footer-in mt-7 pt-5 border-t border-[var(--border-color)] text-center">
                <p className="text-sm text-[var(--muted-color)]">
                  Don't have an account?{' '}
                  <Link to="/register" state={{ from, selectedPackage, message }}
                    className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                    Create one <ArrowRight size={13} />
                  </Link>
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;