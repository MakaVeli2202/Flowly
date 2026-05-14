import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { authAPI } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

function PasswordRule({ met, text }) {
  return (
    <div className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-400' : 'text-[var(--muted-color)]'}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${met ? 'bg-green-400' : 'bg-[var(--border-color)]'}`} />
      {text}
    </div>
  );
}

export default function ForceChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword]     = useState('');
  const [confirm, setConfirm]             = useState('');
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [done, setDone]                   = useState(false);

  const rules = [
    { met: newPassword.length >= 8,             text: 'At least 8 characters' },
    { met: /[A-Z]/.test(newPassword),           text: 'One uppercase letter' },
    { met: /[0-9]/.test(newPassword),           text: 'One number' },
    { met: /[^A-Za-z0-9]/.test(newPassword),   text: 'One special character' },
  ];
  const allRulesMet = rules.every(r => r.met);
  const passwordsMatch = newPassword === confirm && confirm.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRulesMet) { setError('Password does not meet requirements.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setSaving(true);
    setError('');
    try {
      await authAPI.forceChangePassword({ newPassword, confirmNewPassword: confirm });
      setDone(true);
      // Update local user state so mustChangePassword is cleared
      if (setUser) setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);
      setTimeout(() => {
        const role = user?.role?.toLowerCase();
        navigate(role === 'employee' ? '/worker' : '/admin', { replace: true });
      }, 1800);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(circle at 30% 20%, rgba(200,169,107,0.12), transparent 40%), var(--surface-bg)' }}>
      <div className="w-full max-w-md">
        <div className="glass-card p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(200,169,107,0.12)', border: '2px solid rgba(200,169,107,0.3)' }}>
              <Lock size={28} style={{ color: '#c8a96b' }} />
            </div>
            <h1 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-2">
              Set Your Password
            </h1>
            <p className="text-sm text-[var(--muted-color)] leading-relaxed">
              Your account was created with a temporary password. Choose a new one to continue.
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={48} className="text-green-400" />
              <p className="font-bold text-green-400 text-lg">Password updated!</p>
              <p className="text-sm text-[var(--muted-color)]">Redirecting you now...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Choose a strong password"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 pr-11 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className="mt-3 space-y-1.5 px-1">
                    {rules.map(r => <PasswordRule key={r.text} met={r.met} text={r.text} />)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Repeat your new password"
                    className={`w-full rounded-xl border bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 pr-11 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 transition ${
                      confirm.length > 0
                        ? passwordsMatch
                          ? 'border-green-500/50 focus:ring-green-500/30 focus:border-green-500'
                          : 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500'
                        : 'border-[var(--border-color)] focus:ring-primary/50 focus:border-primary'
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={saving || !allRulesMet || !passwordsMatch}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                  <>Set Password <ArrowRight size={16} /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
