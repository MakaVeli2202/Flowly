import React, { useEffect, useState } from 'react';
import { ssoAPI } from '../../api/sso';
import { Shield, Save, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function AdminSSO() {
  const [form, setForm] = useState({
    provider: 'AzureAD',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    additionalScopes: '',
    enabled: true,
  });
  const [hasSecret, setHasSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ssoAPI.getConfig()
      .then(data => {
        if (data?.clientId) {
          setForm(f => ({
            ...f,
            provider: data.provider || 'AzureAD',
            tenantId: data.tenantId || '',
            clientId: data.clientId || '',
            additionalScopes: data.additionalScopes || '',
            enabled: data.enabled ?? true,
          }));
          setHasSecret(data.hasSecret);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await ssoAPI.saveConfig(form);
      setSuccess('SSO configuration saved successfully.');
      setHasSecret(!!form.clientSecret || hasSecret);
      setForm(f => ({ ...f, clientSecret: '' }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
        <Shield size={24} className="text-[var(--color-primary)]" />
        Single Sign-On (SSO)
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Allow your team to sign in using their corporate Azure AD credentials.
      </p>

      <form onSubmit={handleSave} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6 space-y-4">

        <div>
          <label className="label">Provider</label>
          <select value={form.provider} onChange={set('provider')} className="input w-full">
            <option value="AzureAD">Azure AD (Microsoft)</option>
            <option value="Generic">Generic OpenID Connect</option>
          </select>
        </div>

        <div>
          <label className="label">Azure AD Tenant ID</label>
          <input type="text" value={form.tenantId} onChange={set('tenantId')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="input w-full" />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Leave blank to allow any Microsoft tenant (multi-tenant mode).</p>
        </div>

        <div>
          <label className="label">Client ID <span className="text-red-500">*</span></label>
          <input type="text" value={form.clientId} onChange={set('clientId')} placeholder="Application (client) ID" className="input w-full" required />
        </div>

        <div>
          <label className="label">
            Client Secret
            {hasSecret && <span className="ml-2 text-xs text-green-500">(saved - enter new value to replace)</span>}
          </label>
          <input
            type="password"
            value={form.clientSecret}
            onChange={set('clientSecret')}
            placeholder={hasSecret ? 'Leave blank to keep current secret' : 'Paste client secret value'}
            className="input w-full"
          />
        </div>

        <div>
          <label className="label">Additional Scopes</label>
          <input type="text" value={form.additionalScopes} onChange={set('additionalScopes')} placeholder="e.g. User.Read offline_access" className="input w-full" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="ssoEnabled" checked={form.enabled} onChange={set('enabled')} className="w-4 h-4 accent-[var(--color-primary)]" />
          <label htmlFor="ssoEnabled" className="text-sm text-[var(--color-text)]">SSO Enabled</label>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          Save SSO Config
        </button>
      </form>

      <div className="mt-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1">
        <p className="font-medium text-[var(--color-text)]">Setup instructions</p>
        <p>1. In Azure Portal, go to App Registrations and create a new app.</p>
        <p>2. Under Authentication, add redirect URI: <code className="bg-[var(--color-border)] px-1 rounded">https://yourdomain.com/api/sso/callback</code></p>
        <p>3. Copy the Application (client) ID and Directory (tenant) ID above.</p>
        <p>4. Under Certificates &amp; Secrets, create a new client secret and paste it here.</p>
        <p>5. Enable SSO and save. Your team can now sign in at <code className="bg-[var(--color-border)] px-1 rounded">/api/sso/your-org-slug/login</code></p>
      </div>
    </div>
  );
}
