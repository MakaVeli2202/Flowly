import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import SEO from '../../components/shared/SEO';
import { authAPI } from '../../api/auth';

function EmailVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code,       setCode]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [cooldown,   setCooldown]   = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (email) {
      authAPI.sendVerificationEmail(email).catch(() => {});
      startCooldown();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      await authAPI.verifyEmailCode(email, code);
      setSuccess(true);
      
      // Auto-login after verification
      const storedEmail = sessionStorage.getItem('pendingEmail');
      const storedPassword = sessionStorage.getItem('pendingPassword');
      if (storedEmail === email && storedPassword) {
        try {
          const loginResult = await authAPI.login({ email, password: storedPassword });
          localStorage.setItem('token', loginResult.token);
          localStorage.setItem('refreshToken', loginResult.refreshToken || '');
          localStorage.setItem('user', JSON.stringify(loginResult.user));
          sessionStorage.removeItem('pendingEmail');
          sessionStorage.removeItem('pendingPassword');
          setTimeout(() => navigate('/', { replace: true }), 1800);
          return;
        } catch { /* fall through to login page */ }
      }
      setTimeout(() => navigate('/login', { state: { message: 'Email verified! You can now sign in.' } }), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(''); setResending(true);
    try {
      await authAPI.sendVerificationEmail(email);
      startCooldown();
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally { setResending(false); }
  };

  return (
    <>
      <SEO title="Verify Email" description="Verify your email address to complete registration." noindex />
      <div
        className="min-h-screen flex items-center justify-center px-4 py-16 relative"
        style={{
          background: `
            radial-gradient(circle at 70% 20%, rgba(14,165,160,0.07) 0%, transparent 42%),
            radial-gradient(circle at 20% 80%, rgba(200,169,107,0.05) 0%, transparent 36%)
          `,
        }}
      >
        <div className="absolute top-8 -right-24 w-80 h-72 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.14),rgba(0,120,255,.1),rgba(14,165,160,.14))', filter: 'blur(88px)', animation: 'spectrum-float 16s ease-in-out infinite' }} />

        <div className="max-w-md w-full relative z-10">
          <div className="card-enter glass-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full"
              style={{ background: 'linear-gradient(180deg, #0ea5a0 0%, #c8a96b 55%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '65%', width: '13%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />

            <div className="p-8 md:p-10">

              {/* Icon header */}
              <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute w-28 h-28 rounded-full"
                    style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.24),rgba(200,169,107,.17),rgba(14,165,160,.24))', filter: 'blur(20px)', animation: 'hero-ring-pulse 3.2s ease-in-out infinite' }} />
                  <div className="absolute rounded-full border border-[rgba(14,165,160,0.32)]"
                    style={{ width: 68, height: 68, background: 'rgba(14,165,160,0.05)', boxShadow: '0 0 28px rgba(14,165,160,0.13)' }} />
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center icon-pop"
                    style={{
                      background: 'linear-gradient(135deg, rgba(14,165,160,0.22) 0%, rgba(200,169,107,0.16) 100%)',
                      border: '1px solid rgba(14,165,160,0.42)',
                      boxShadow: '0 4px 24px rgba(14,165,160,0.22)',
                    }}
                  >
                    <Mail size={22} className="text-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #0ea5a0)' }} />
                  <p className="uppercase tracking-[0.25em] text-primary text-[0.65rem] font-semibold whitespace-nowrap">
                    One More Step
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #0ea5a0, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-2">
                  Verify Your Email
                </h1>
                <p className="text-[var(--muted-color)] text-sm leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="text-[var(--text-color)] font-medium">{email || 'your email'}</span>.
                  Enter it below to activate your account.
                </p>
              </div>

              <div className="mb-7"><div className="spectrum-line" /></div>

              {success ? (
                <div className="text-center py-4">
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                  <p className="text-green-400 font-semibold text-lg">Email verified!</p>
                  <p className="text-[var(--muted-color)] text-sm mt-1">Redirecting to sign in…</p>
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

                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="field-1">
                      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text" value={code}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                        required maxLength={6} placeholder="000000" inputMode="numeric"
                        className="w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                      />
                    </div>

                    <div className="btn-in pt-1">
                      <div className="cta-prism-glow rounded-2xl">
                        <button type="submit" disabled={loading || code.length !== 6}
                          className="btn-chrome w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Verifying…
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              Verify Email <ArrowRight size={16} />
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="footer-in mt-5 text-center space-y-3">
                    <p className="text-sm text-[var(--muted-color)]">
                      Didn't receive the code?{' '}
                      <button
                        onClick={handleResend} disabled={cooldown > 0 || resending}
                        className="text-primary hover:text-primary/80 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {resending ? <><RefreshCw size={12} className="animate-spin" /> Sending…</> :
                         cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      </button>
                    </p>
                    <p className="text-xs text-[var(--muted-color)]">
                      <Link to="/login" className="text-primary hover:text-primary/80 transition-colors">
                        Back to sign in
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

export default EmailVerification;
