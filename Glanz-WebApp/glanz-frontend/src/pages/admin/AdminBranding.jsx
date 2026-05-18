import React, { useEffect, useState } from 'react';
import { organizationsAPI } from '../../api/organizations';
import { Palette, Save, Loader, CheckCircle, AlertCircle } from 'lucide-react';

export default function AdminBranding() {
  const [form, setForm] = useState({
    logoUrl: '', faviconUrl: '', primaryColor: '#6366f1', secondaryColor: '#8b5cf6',
    customDomain: '', whiteLabelEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });

  useEffect(() => {
    organizationsAPI.getBranding()
      .then(d => {
        if (d) setForm({
          logoUrl: d.logoUrl || '',
          faviconUrl: d.faviconUrl || '',
          primaryColor: d.primaryColor || '#6366f1',
          secondaryColor: d.secondaryColor || '#8b5cf6',
          customDomain: d.customDomain || '',
          whiteLabelEnabled: d.whiteLabelEnabled || false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', ok: true });
    try {
      await organizationsAPI.updateBranding(form);
      setMsg({ text: 'Branding saved.', ok: true });
    } catch (err) {
      setMsg({ text: err?.response?.data?.message || 'Save failed.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
        <Palette size={24} className="text-[var(--color-primary)]" />
        Branding &amp; White-label
      </h1>

      <form onSubmit={handleSave} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6 space-y-5">

        {/* Preview strip */}
        <div
          className="h-12 rounded-xl flex items-center justify-center text-white text-sm font-medium"
          style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})` }}
        >
          Color Preview
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Primary Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.primaryColor} onChange={set('primaryColor')} className="w-10 h-10 rounded cursor-pointer border border-[var(--color-border)] bg-transparent" />
              <input type="text" value={form.primaryColor} onChange={set('primaryColor')} className="input flex-1" placeholder="#6366f1" />
            </div>
          </div>
          <div>
            <label className="label">Secondary Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.secondaryColor} onChange={set('secondaryColor')} className="w-10 h-10 rounded cursor-pointer border border-[var(--color-border)] bg-transparent" />
              <input type="text" value={form.secondaryColor} onChange={set('secondaryColor')} className="input flex-1" placeholder="#8b5cf6" />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Logo URL</label>
          <input type="url" value={form.logoUrl} onChange={set('logoUrl')} className="input w-full" placeholder="https://cdn.example.com/logo.png" />
          {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" className="mt-2 h-10 object-contain rounded" onError={e => e.target.style.display='none'} />}
        </div>

        <div>
          <label className="label">Favicon URL</label>
          <input type="url" value={form.faviconUrl} onChange={set('faviconUrl')} className="input w-full" placeholder="https://cdn.example.com/favicon.ico" />
        </div>

        <div>
          <label className="label">Custom Domain</label>
          <input type="text" value={form.customDomain} onChange={set('customDomain')} className="input w-full" placeholder="app.yourbusiness.com" />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Add a CNAME record pointing to <code className="bg-[var(--color-border)] px-1 rounded">app.flowly.io</code> before enabling.</p>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="whiteLabelEnabled" checked={form.whiteLabelEnabled} onChange={set('whiteLabelEnabled')} className="w-4 h-4 accent-[var(--color-primary)]" />
          <label htmlFor="whiteLabelEnabled" className="text-sm text-[var(--color-text)]">White-label mode (hide Flowly branding)</label>
        </div>

        {msg.text && (
          <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>
            {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          Save Branding
        </button>
      </form>
    </div>
  );
}
