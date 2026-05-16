import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Mail, Lock, User, Globe, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { organizationsAPI } from '../../api/organizations';
import { useAuth } from '../../context/AuthContext';

const INDUSTRIES = [
  { value: 'automotive_detailing', label: 'Automotive Detailing' },
  { value: 'salon',                label: 'Salon & Beauty' },
  { value: 'cleaning',             label: 'Cleaning Services' },
  { value: 'workshop',             label: 'Workshop & Repair' },
  { value: 'other',                label: 'Other' },
];

const CURRENCIES = [
  { value: 'QAR', label: 'QAR - Qatari Riyal' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'AED', label: 'AED - UAE Dirham' },
];

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function OrgRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    organizationName: '',
    slug: '',
    industryType: 'automotive_detailing',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    billingEmail: '',
    defaultLocale: 'en',
    defaultCurrency: 'QAR',
    defaultTimezone: 'UTC',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'organizationName' && !slugTouched) {
        next.slug = toSlug(value);
      }
      return next;
    });
    setError('');
  };

  const handleSlugChange = (e) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
    setError('');
  };

  const validate = () => {
    if (!form.organizationName.trim()) return 'Organization name is required.';
    if (!form.slug || !/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/.test(form.slug))
      return 'Slug must be 3-100 lowercase letters, numbers, or hyphens.';
    if (!form.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail))
      return 'Valid admin email required.';
    if (!form.adminPassword || form.adminPassword.length < 8)
      return 'Password must be at least 8 characters.';
    if (!form.adminFirstName.trim()) return 'First name is required.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');

    try {
      await organizationsAPI.register({
        ...form,
        organizationName: form.organizationName.trim(),
        slug: form.slug.trim(),
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        billingEmail: form.billingEmail.trim() || undefined,
      });

      // Auto-login after registration
      try {
        await login({ email: form.adminEmail, password: form.adminPassword });
        navigate('/admin/onboarding', { replace: true });
      } catch {
        setSuccess(true);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-surface-card rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Organization Created!</h2>
          <p className="text-muted">Your account is ready. Sign in to start your onboarding.</p>
          <Link to="/login" className="btn btn-primary w-full block text-center">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-[var(--brand-primary,#c8a96b)]" />
          <h1 className="text-3xl font-bold">Start Your Free Trial</h1>
          <p className="text-muted mt-2">Set up your business on Flowly in minutes.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl p-8 shadow-xl space-y-5">

          {/* Organization info */}
          <div className="border-b border-border pb-5 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Organization Details
            </h2>

            <div>
              <label className="block text-sm font-medium mb-1">Organization Name *</label>
              <input
                name="organizationName"
                value={form.organizationName}
                onChange={handleChange}
                placeholder="Acme Detailing"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL Slug *</label>
              <div className="flex items-center gap-2">
                <span className="text-muted text-sm">flowly.app/</span>
                <input
                  name="slug"
                  value={form.slug}
                  onChange={handleSlugChange}
                  placeholder="acme-detailing"
                  className="input flex-1"
                  pattern="[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]"
                  required
                />
              </div>
              <p className="text-xs text-muted mt-1">Lowercase letters, numbers, hyphens only.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <select name="industryType" value={form.industryType} onChange={handleChange} className="input w-full">
                  {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Currency</label>
                <select name="defaultCurrency" value={form.defaultCurrency} onChange={handleChange} className="input w-full">
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Admin account */}
          <div className="space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <User className="w-5 h-5" /> Admin Account
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input name="adminFirstName" value={form.adminFirstName} onChange={handleChange} placeholder="John" className="input w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input name="adminLastName" value={form.adminLastName} onChange={handleChange} placeholder="Smith" className="input w-full" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Admin Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} placeholder="admin@yourcompany.com" className="input w-full pl-9" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} placeholder="Min. 8 characters" className="input w-full pl-9" required minLength={8} />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full flex items-center justify-center gap-2 py-3">
            {loading ? 'Creating...' : 'Create Organization'}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account? <Link to="/login" className="text-[var(--brand-primary,#c8a96b)] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
