import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';
import SEO from '../../components/shared/SEO';
import { authAPI } from '../../api/auth';

import { pwStrength, STRENGTH_BAR, STRENGTH_LABEL, STRENGTH_CLR } from '../../utils/passwordStrength';

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState(false);

  const strength   = pwStrength(newPassword);
  const pwsMatch   = confirmPassword && newPassword === confirmPassword;
  const pwsMismatch = confirmPassword && newPassword !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!token) { setError('Invalid reset link. Please request a new one.'); return; }
    setError(''); setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } }), 2000);
    } catch (err) {
      console.error('[ResetPassword] error:', err?.response?.status, err?.response?.data, err?.message);
      setError(err.response?.data?.message || err.response?.data?.Message || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <SEO title="Reset Password" description="Set a new password for your Glanz account." noindex />
      <div
        className="min-h-screen flex items-center justify-center px-4 py-16 relative"
        style={{
          background: `
            radial-gradient(circle at 80% 14%, rgba(14,165,160,0.07) 0%, transparent 42%),
            radial-gradient(circle at 18% 86%, rgba(200,169,107,0.05) 0%, transparent 36%)
          `,
        }}
      >
        <div className="absolute top-8 -right-24 w-80 h-72 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.14),rgba(0,120,255,.1),rgba(14,165,160,.14))', filter: 'blur(88px)', animation: 'spectrum-float 16s ease-in-out infinite' }} />

        <div className="max-w-md w-full relative z-10">
          <div className="card-enter glass-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full"
              style={{ background: 'linear-gradient(180deg, #0ea5a0 0%, #c8a96b 55%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '68%', width: '13%', animation: 'prism-ray-sweep 13s ease-in-out 2s infinite' }} />

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
                    <Lock size={22} className="text-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #0ea5a0)' }} />
                  <p className="uppercase tracking-[0.25em] text-primary text-[0.65rem] font-semibold whitespace-nowrap">
                    Set New Password
                  </p>
                  <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #0ea5a0, transparent)' }} />
                </div>

                <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-2">
                  Reset Password
                </h1>
                <p className="text-[var(--muted-color)] text-sm">
                  Choose a strong new password for your account.
                </p>
              </div>

              <div className="mb-7"><div className="spectrum-line" /></div>

              {success ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle size={48} className="text-green-400 mx-auto" />
                  <p className="text-[var(--heading-color)] font-semibold text-lg">Password updated!</p>
                  <p className="text-[var(--muted-color)] text-sm">Redirecting to sign in…</p>
                </div>
              ) : (
                <>
                  {!token && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
                      <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-amber-300 text-sm">
                        Invalid reset link.{' '}
                        <Link to="/forgot-password" className="underline">Request a new one</Link>.
                      </p>
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

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New password */}
                    <div className="field-1">
                      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                          type={showNew ? 'text' : 'password'} value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                          required minLength={8} placeholder="••••••••"
                          className="w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                        />
                        <button type="button" onClick={() => setShowNew(p => !p)}
                          aria-label={showNew ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                          {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="mt-2.5">
                          <div className="flex gap-1 mb-1.5">
                            {[0, 1, 2, 3].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? STRENGTH_BAR[strength - 1] : 'bg-[var(--border-color)]'}`} />
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
                    <div className="field-2">
                      <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                        <input
                          type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                          required placeholder="••••••••"
                          className={`w-full pl-10 pr-12 py-3 rounded-xl border bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition ${pwsMismatch ? 'border-rose-500/60' : pwsMatch ? 'border-green-500/60' : 'border-[var(--border-color)]'}`}
                        />
                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <p className={`text-[11px] mt-1.5 flex items-center gap-1.5 font-medium ${pwsMatch ? 'text-green-400' : 'text-rose-400'}`}>
                          {pwsMatch ? <><CheckCircle size={11} /> Passwords match</> : <><AlertCircle size={11} /> Passwords don't match</>}
                        </p>
                      )}
                    </div>

                    <div className="btn-in pt-1">
                      <div className="cta-prism-glow rounded-2xl">
                        <button type="submit" disabled={loading || !token}
                          className="btn-chrome w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Updating…
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              Reset Password <ArrowRight size={16} />
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="footer-in mt-6 pt-5 border-t border-[var(--border-color)] text-center">
                    <p className="text-sm text-[var(--muted-color)]">
                      <Link to="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                        Back to sign in <ArrowRight size={13} />
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

export default ResetPassword;
