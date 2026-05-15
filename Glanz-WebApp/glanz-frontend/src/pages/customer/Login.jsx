import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../../components/shared/SEO';
import { useLanguage } from '../../context/LanguageContext';

const UI_BY_LANG = {
  en: {
    seoTitle: 'Sign In',
    seoDesc: 'Sign in to your Glanz account to manage bookings and track your car detailing services.',
    loginFailed: 'Login failed. Please try again.',
    welcomeBack: 'Welcome Back',
    signIn: 'Sign In',
    credentials: 'Enter your credentials to continue',
    email: 'Email Address',
    emailPh: 'you@example.com',
    password: 'Password',
    signingIn: 'Signing in...',
    encrypted: '256-bit Encrypted',
    dataSafe: 'Your data is safe',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
  },
  ar: {
    seoTitle: 'تسجيل الدخول',
    seoDesc: 'سجّل الدخول إلى حساب Glanz لإدارة الحجوزات ومتابعة خدمات العناية بالسيارة.',
    loginFailed: 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.',
    welcomeBack: 'أهلا بعودتك',
    signIn: 'تسجيل الدخول',
    credentials: 'أدخل بياناتك للمتابعة',
    email: 'البريد الإلكتروني',
    emailPh: 'you@example.com',
    password: 'كلمة المرور',
    signingIn: 'جارٍ تسجيل الدخول...',
    encrypted: 'تشفير 256-بت',
    dataSafe: 'بياناتك آمنة',
    noAccount: 'ليس لديك حساب؟',
    createOne: 'إنشاء حساب',
    hidePassword: 'إخفاء كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
  },
  de: {
    seoTitle: 'Anmelden',
    seoDesc: 'Melden Sie sich bei Ihrem Glanz-Konto an, um Buchungen zu verwalten und Services zu verfolgen.',
    loginFailed: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
    welcomeBack: 'Willkommen zuruck',
    signIn: 'Anmelden',
    credentials: 'Geben Sie Ihre Zugangsdaten ein',
    email: 'E-Mail-Adresse',
    emailPh: 'you@example.com',
    password: 'Passwort',
    signingIn: 'Anmeldung lauft...',
    encrypted: '256-Bit-verschlusselt',
    dataSafe: 'Ihre Daten sind sicher',
    noAccount: 'Noch kein Konto?',
    createOne: 'Konto erstellen',
    hidePassword: 'Passwort ausblenden',
    showPassword: 'Passwort anzeigen',
  },
};

import PrismaticCursorOrb from '../../components/shared/PrismaticCursorOrb';

/* ══════════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════════ */
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
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
      const errData = err.response?.data;
      if (errData?.requiresEmailVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(errData.email || formData.email)}`, { replace: true });
        return;
      }
      setError(errData?.message || err.message || ui.loginFailed);
    } finally { setLoading(false); }
  };

  return (
    <>
      <SEO title={ui.seoTitle} description={ui.seoDesc} noindex />
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
                    {ui.welcomeBack}
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-2">
                  {ui.signIn}
                </h1>
                <p className="text-[var(--muted-color)] text-sm">{ui.credentials}</p>
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
                    {ui.email}
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type="email" name="email" value={formData.email} onChange={handleChange}
                      required placeholder={ui.emailPh}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="field-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)]">
                      {ui.password}
                    </label>
                    <Link
                      to={`/forgot-password${formData.email ? `?email=${encodeURIComponent(formData.email)}` : ''}`}
                      className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                      required placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? ui.hidePassword : ui.showPassword}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="btn-in pt-1">
                  <div className="cta-prism-glow rounded-2xl">
                    <button type="submit" disabled={loading}
                      className="btn-chrome w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          {ui.signingIn}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          {ui.signIn} <ArrowRight size={16} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Trust row */}
              <div className="footer-in flex items-center justify-center gap-5 flex-wrap mt-4">
                {[
                  { icon: Shield,      label: ui.encrypted  },
                  { icon: CheckCircle, label: ui.dataSafe  },
                ].map(({ icon: TIcon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-color)]">
                    <TIcon size={11} className="text-primary" />{label}
                  </div>
                ))}
              </div>

              {/* Switch */}
              <div className="footer-in mt-7 pt-5 border-t border-[var(--border-color)] text-center">
                <p className="text-sm text-[var(--muted-color)]">
                  {ui.noAccount}{' '}
                  <Link to="/register" state={{ from, selectedPackage, message }}
                    className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                    {ui.createOne} <ArrowRight size={13} />
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