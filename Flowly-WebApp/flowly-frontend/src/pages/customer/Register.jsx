import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus, User, Mail, Lock, AlertCircle,
  Eye, EyeOff, Shield, CheckCircle, ArrowRight, Zap, Phone, Gift,
} from 'lucide-react';
import SEO from '../../components/shared/SEO';
import AddressAutocompleteInput from '../../components/shared/AddressAutocompleteInput';
import { DateWheelPicker } from '../../components/shared/DateWheelPicker';
import PrismaticCursorOrb from '../../components/shared/PrismaticCursorOrb';
import { pwStrength, STRENGTH_BAR, STRENGTH_LABEL, STRENGTH_CLR } from '../../utils/passwordStrength';

/* ══════════════════════════════════════════════════════════════
   REGISTER
══════════════════════════════════════════════════════════════ */
function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    phone: '', address: '', referralCode: '',
  });
  const [error,               setError]               = useState('');
  const [loading,             setLoading]             = useState(false);
  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(null);

  const from            = location.state?.from || '/';
  const selectedPackage = location.state?.selectedPackage;
  const message         = location.state?.message;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Please enter a valid email address.'); return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (formData.phone && !/^\+?[\d\s\-().]{7,20}$/.test(formData.phone.trim())) {
      setError('Please enter a valid phone number.'); return;
    }
    setLoading(true);
    try {
      const result = await register({
        firstName: formData.firstName, lastName: formData.lastName,
        email: formData.email,         password: formData.password,
        phone: formData.phone.trim() || undefined,
        preferredAddress: formData.address.trim() || undefined,
        referralCode: formData.referralCode.trim() || undefined,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : undefined,
      });
      if (result.requiresEmailVerification) {
        sessionStorage.setItem('pendingEmail', formData.email);
        sessionStorage.setItem('pendingPassword', formData.password);
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`, { replace: true });
        return;
      }
      if (selectedPackage)                              navigate('/booking', { state: { selectedPackage }, replace: true });
      else if (from && from !== '/register' && from !== '/login') navigate(from, { replace: true });
      else                                              navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const strength    = pwStrength(formData.password);
  const pwsMatch    = formData.confirmPassword && formData.password === formData.confirmPassword;
  const pwsMismatch = formData.confirmPassword && formData.password !== formData.confirmPassword;

  return (
    <>
      <SEO title="Create Account" description="Create your free Flowly account and book professional mobile car detailing anywhere in Qatar." noindex />
      <PrismaticCursorOrb />

      <div
        className="min-h-screen flex items-center justify-center px-4 py-16 relative"
        style={{
          background: `
            radial-gradient(circle at 80% 14%, rgba(14,165,160,0.07) 0%, transparent 42%),
            radial-gradient(circle at 18% 86%, rgba(200,169,107,0.05) 0%, transparent 36%)
          `,
        }}
      >
        {/* Spectral backdrop orbs — teal-dominant for register */}
        <div className="absolute top-8 -right-24 w-96 h-80 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.14),rgba(0,120,255,.1),rgba(14,165,160,.14),rgba(200,169,107,.09),rgba(14,165,160,.14))', filter: 'blur(88px)', animation: 'spectrum-float 16s ease-in-out infinite' }} />
        <div className="absolute bottom-8 -left-24 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 270deg,rgba(200,169,107,.12),rgba(255,165,0,.09),rgba(200,169,107,.12),rgba(14,165,160,.08),rgba(200,169,107,.12))', filter: 'blur(72px)', animation: 'spectrum-float 20s ease-in-out 5s infinite' }} />

        <div className="max-w-md w-full relative z-10">
          <div className="card-enter glass-card relative overflow-hidden">
            {/* Left accent bar — teal-led for register */}
            <div className="absolute top-0 left-0 w-[2px] h-full"
              style={{ background: 'linear-gradient(180deg, #0ea5a0 0%, #c8a96b 55%, transparent 100%)' }} />
            {/* Prism rays */}
            <div className="prism-ray" style={{ left: '70%', width: '13%', animation: 'prism-ray-sweep 13s ease-in-out 2s infinite' }} />
            <div className="prism-ray" style={{ left: '22%', width: '9%',  animation: 'prism-ray-sweep 21s ease-in-out 8s infinite' }} />

            <div className="p-8 md:p-10">

              {/* ── Icon header ──────────────────────────────────────── */}
              <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center mb-6">
                  {/* Outer conic — teal dominant */}
                  <div className="absolute w-28 h-28 rounded-full"
                    style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.24),rgba(200,169,107,.17),rgba(0,200,255,.19),rgba(14,165,160,.24))', filter: 'blur(20px)', animation: 'hero-ring-pulse 3.2s ease-in-out infinite' }} />
                  {/* Mid ring */}
                  <div className="absolute rounded-full border border-[rgba(14,165,160,0.32)]"
                    style={{ width: 68, height: 68, background: 'rgba(14,165,160,0.05)', boxShadow: '0 0 28px rgba(14,165,160,0.13)' }} />
                  {/* Icon core */}
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center icon-pop prism-glass cursor-default"
                    style={{
                      background: 'linear-gradient(135deg, rgba(14,165,160,0.22) 0%, rgba(200,169,107,0.16) 100%)',
                      border: '1px solid rgba(14,165,160,0.42)',
                      boxShadow: '0 4px 24px rgba(14,165,160,0.22)',
                    }}
                    onMouseMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                      e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                    }}
                  >
                    <UserPlus size={22} className="text-primary" />
                  </div>
                </div>

                {/* Badge */}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #0ea5a0)' }} />
                  <p className="uppercase tracking-[0.25em] text-primary text-[0.65rem] font-semibold whitespace-nowrap">
                    Get Started Today
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #0ea5a0, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-2">
                  Create Account
                </h1>
                <p className="text-[var(--muted-color)] text-sm">Join and book your first detail today</p>
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
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name row */}
                <div className="field-1 grid grid-cols-2 gap-3">
                  {[
                    { label: 'First Name', name: 'firstName', placeholder: 'John' },
                    { label: 'Last Name',  name: 'lastName',  placeholder: 'Doe'  },
                  ].map(({ label, name, placeholder }) => (
                    <div key={name}>
                      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                        {label}
                      </label>
                      <div className="relative">
                        <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                          type="text" name={name} value={formData[name]} onChange={handleChange}
                          required placeholder={placeholder}
                          className="w-full pl-9 pr-3 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Email */}
                <div className="field-2">
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
                <div className="field-3">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                      required minLength={8} placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password strength bars */}
                  {formData.password && (
                    <div className="mt-2.5">
                      <div className="flex gap-1 mb-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i < strength ? STRENGTH_BAR[strength - 1] : 'bg-[var(--border-color)]'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--muted-color)]">
                        Strength:{' '}
                        <span className={`font-bold ${strength > 0 ? STRENGTH_CLR[strength - 1] : ''}`}>
                          {strength > 0 ? STRENGTH_LABEL[strength - 1] : '—'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="field-4">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                      required placeholder="••••••••"
                      className={`w-full pl-10 pr-12 py-3 rounded-xl border bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition ${
                        pwsMismatch ? 'border-rose-500/60' : pwsMatch ? 'border-green-500/60' : 'border-[var(--border-color)]'
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Match indicator */}
                  {formData.confirmPassword && (
                    <p className={`text-[11px] mt-1.5 flex items-center gap-1.5 font-medium ${pwsMatch ? 'text-green-400' : 'text-rose-400'}`}>
                      {pwsMatch
                        ? <><CheckCircle size={11} /> Passwords match</>
                        : <><AlertCircle size={11} /> Passwords don't match</>
                      }
                    </p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="field-5">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">
                    Date of Birth <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <div className="flex justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] py-3">
                    <DateWheelPicker
                      value={dateOfBirth}
                      onChange={setDateOfBirth}
                      maxYear={new Date().getFullYear() - 13}
                      minYear={new Date().getFullYear() - 100}
                      size="sm"
                      numericMonths
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Phone Number <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      placeholder="+974 3300 0000"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <AddressAutocompleteInput
                    label={<span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)]">Address <span className="normal-case font-normal">(optional)</span></span>}
                    value={formData.address}
                    onChange={(v) => setFormData((prev) => ({ ...prev, address: v }))}
                    placeholder="Search your home or work address"
                  />
                </div>

                {/* Referral Code */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Referral Code <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Gift size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                    <input
                      type="text" name="referralCode" value={formData.referralCode} onChange={handleChange}
                      placeholder="Enter friend's referral code"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--muted-color)] mt-1.5">
                    Have a friend who uses Flowly? Enter their referral code to get a discount!
                  </p>
                </div>

                {/* Submit */}
                <div className="btn-in pt-2">
                  <div className="cta-prism-glow rounded-2xl">
                    <button type="submit" disabled={loading}
                      className="btn-chrome w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Creating account…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Create Account <ArrowRight size={16} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Trust row */}
              <div className="footer-in flex items-center justify-center gap-5 flex-wrap mt-4">
                {[
                  { icon: Zap,         label: 'Free Account'       },
                  { icon: Shield,      label: '256-bit Encrypted'  },
                  { icon: CheckCircle, label: 'No spam, ever'      },
                ].map(({ icon: TIcon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-color)]">
                    <TIcon size={11} className="text-primary" />{label}
                  </div>
                ))}
              </div>

              {/* Switch */}
              <div className="footer-in mt-7 pt-5 border-t border-[var(--border-color)] text-center">
                <p className="text-sm text-[var(--muted-color)]">
                  Already have an account?{' '}
                  <Link to="/login" state={{ from, selectedPackage, message }}
                    className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                    Sign in <ArrowRight size={13} />
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

export default Register;