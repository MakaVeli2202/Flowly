import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Mail, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import SEO from '../../components/shared/SEO';
import { authAPI } from '../../api/auth';

function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const [email,   setEmail]   = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.'); return;
    }
    setError(''); setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <SEO title="Forgot Password" description="Reset your Glanz account password." noindex />


      <div
        className="min-h-screen flex items-center justify-center px-4 py-16 relative"
        style={{
          background: `
            radial-gradient(circle at 14% 18%, rgba(200,169,107,0.07) 0%, transparent 42%),
            radial-gradient(circle at 86% 82%, rgba(14,165,160,0.05) 0%, transparent 36%)
          `,
        }}
      >
        <div className="absolute top-10 -left-24 w-80 h-72 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.14),rgba(255,165,0,.1),rgba(200,169,107,.14))', filter: 'blur(88px)', animation: 'spectrum-float 18s ease-in-out infinite' }} />

        <div className="max-w-md w-full relative z-10">
          <div className="card-enter glass-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full"
              style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #0ea5a0 55%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '65%', width: '13%', animation: 'prism-ray-sweep 14s ease-in-out 3s infinite' }} />

            <div className="p-8 md:p-10">

              {/* Icon header */}
              <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute w-28 h-28 rounded-full"
                    style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.24),rgba(14,165,160,.17),rgba(200,169,107,.24))', filter: 'blur(20px)', animation: 'hero-ring-pulse 3.5s ease-in-out infinite' }} />
                  <div className="absolute rounded-full border border-primary/28"
                    style={{ width: 68, height: 68, background: 'rgba(200,169,107,0.05)', boxShadow: '0 0 30px rgba(200,169,107,0.13)' }} />
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center icon-pop"
                    style={{
                      background: 'linear-gradient(135deg, rgba(200,169,107,0.22) 0%, rgba(14,165,160,0.16) 100%)',
                      border: '1px solid rgba(200,169,107,0.42)',
                      boxShadow: '0 4px 24px rgba(200,169,107,0.22)',
                    }}
                  >
                    <KeyRound size={22} className="text-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                  <p className="uppercase tracking-[0.25em] text-primary text-[0.65rem] font-semibold whitespace-nowrap">
                    Account Recovery
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-2">
                  Forgot Password?
                </h1>
                <p className="text-[var(--muted-color)] text-sm">
                  Enter your email and we'll send reset instructions.
                </p>
              </div>

              <div className="mb-7"><div className="spectrum-line" /></div>

              {sent ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle size={48} className="text-green-400 mx-auto" />
                  <p className="text-[var(--heading-color)] font-semibold text-lg">Check your inbox</p>
                  <p className="text-[var(--muted-color)] text-sm leading-relaxed">
                    If that email is registered, you'll receive reset instructions within a few minutes.
                    Check your spam folder if you don't see it.
                  </p>
                  <Link to="/login"
                    className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold text-sm transition-colors mt-2">
                    Back to sign in <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 p-4">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertCircle size={12} className="text-rose-400" />
                      </div>
                      <p className="text-rose-300 text-sm leading-relaxed">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="field-1">
                      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                          type="email" value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          required placeholder="you@example.com"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                        />
                      </div>
                    </div>

                    <div className="btn-in pt-1">
                      <div className="cta-prism-glow rounded-2xl">
                        <button type="submit" disabled={loading}
                          className="btn-chrome w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Sending…
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              Send Reset Link <ArrowRight size={16} />
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="footer-in mt-6 pt-5 border-t border-[var(--border-color)] text-center">
                    <p className="text-sm text-[var(--muted-color)]">
                      Remembered it?{' '}
                      <Link to="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                        Sign in <ArrowRight size={13} />
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;
