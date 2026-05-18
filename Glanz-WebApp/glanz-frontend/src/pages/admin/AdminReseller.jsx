import React, { useEffect, useState } from 'react';
import { resellerAPI } from '../../api/reseller';
import { Building2, Plus, Trash2, Save, Loader, AlertCircle, CheckCircle } from 'lucide-react';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function AdminReseller() {
  const [profile, setProfile] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReseller, setNotReseller] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ slug: '', name: '', industryType: 'service_business', billingEmail: '', defaultLocale: 'en', defaultCurrency: 'QAR' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);// eslint-disable-line

  const load = async () => {
    try {
      const [p, o] = await Promise.all([resellerAPI.getProfile(), resellerAPI.getManagedOrgs()]);
      setProfile(p);
      setOrgs(o);
    } catch (e) {
      if (e?.response?.status === 404) setNotReseller(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await resellerAPI.saveProfile(profile);
      setMsg({ text: 'Profile saved.', ok: true });
    } catch {
      setMsg({ text: 'Save failed.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const org = await resellerAPI.createManagedOrg(addForm);
      setOrgs(prev => [...prev, org]);
      setShowAdd(false);
      setAddForm({ slug: '', name: '', industryType: 'service_business', billingEmail: '', defaultLocale: 'en', defaultCurrency: 'QAR' });
      setMsg({ text: 'Organization created and linked.', ok: true });
    } catch (e) {
      setMsg({ text: e?.response?.data?.message || 'Create failed.', ok: false });
    } finally {
      setAdding(false);
    }
  };

  const handleUnlink = async (orgId) => {
    if (!window.confirm('Unlink this organization from your reseller account?')) return;
    try {
      await resellerAPI.unlinkManagedOrg(orgId);
      setOrgs(prev => prev.filter(o => o.id !== orgId));
    } catch {
      setMsg({ text: 'Unlink failed.', ok: false });
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;
  if (notReseller) return (
    <div className="p-6 max-w-lg mx-auto text-center">
      <Building2 size={48} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Reseller Access Not Enabled</h2>
      <p className="text-sm text-[var(--color-text-muted)]">Your account does not have reseller access. Contact Flowly support to enable it.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
        <Building2 size={24} className="text-[var(--color-primary)]" />
        Reseller Console
      </h1>

      {msg.text && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>
          {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* Profile */}
      <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <h2 className="font-semibold text-[var(--color-text)] mb-4">Reseller Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="label">Company Name</label>
            <input className="input w-full" value={profile?.companyName || ''} onChange={e => setProfile(p => ({ ...p, companyName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Billing Email</label>
            <input type="email" className="input w-full" value={profile?.billingEmail || ''} onChange={e => setProfile(p => ({ ...p, billingEmail: e.target.value }))} />
          </div>
          <div>
            <label className="label">Revenue Share (%)</label>
            <input type="number" min="0" max="100" step="0.5" className="input w-full" value={profile?.revenueSharePercent || 0} onChange={e => setProfile(p => ({ ...p, revenueSharePercent: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
            Save Profile
          </button>
        </form>
      </div>

      {/* Managed orgs */}
      <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--color-text)]">Managed Organizations ({orgs.length})</h2>
          <button onClick={() => setShowAdd(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Org
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="mb-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Slug</label>
                <input required className="input w-full" placeholder="acme-detailing" value={addForm.slug} onChange={e => setAddForm(f => ({ ...f, slug: e.target.value }))} />
              </div>
              <div>
                <label className="label">Business Name</label>
                <input required className="input w-full" placeholder="Acme Detailing" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Billing Email</label>
                <input type="email" className="input w-full" value={addForm.billingEmail} onChange={e => setAddForm(f => ({ ...f, billingEmail: e.target.value }))} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input w-full" value={addForm.defaultCurrency} onChange={e => setAddForm(f => ({ ...f, defaultCurrency: e.target.value }))}>
                  <option>QAR</option><option>USD</option><option>EUR</option><option>GBP</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={adding} className="btn-primary flex items-center gap-2">
                {adding ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        )}

        {orgs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No managed organizations yet.</p>
        ) : (
          <div className="space-y-2">
            {orgs.map(org => (
              <div key={org.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <div>
                  <p className="font-medium text-sm text-[var(--color-text)]">{org.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{org.slug} · {org.industryType} · Added {formatDate(org.createdAt)}</p>
                </div>
                <button onClick={() => handleUnlink(org.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
