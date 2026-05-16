import React, { useEffect, useState } from 'react';
import { Building2, Palette, Globe, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { organizationsAPI } from '../../api/organizations';
import { useTenant } from '../../context/TenantContext';

const INDUSTRIES = [
  { value: 'automotive_detailing', label: 'Automotive Detailing' },
  { value: 'salon',                label: 'Salon & Beauty' },
  { value: 'cleaning',             label: 'Cleaning Services' },
  { value: 'workshop',             label: 'Workshop & Repair' },
  { value: 'other',                label: 'Other' },
];

const CURRENCIES = ['QAR', 'EUR', 'USD', 'GBP', 'AED'];
const LOCALES    = [{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }, { value: 'de', label: 'German' }];
const TIMEZONES  = ['UTC', 'Asia/Qatar', 'Europe/Vienna', 'America/New_York', 'Asia/Dubai'];

export default function AdminOrgSettings() {
  const { org, branding, updateBranding } = useTenant();

  const [orgForm, setOrgForm] = useState({ name: '', billingEmail: '', defaultLocale: 'en', defaultCurrency: 'QAR', defaultTimezone: 'UTC' });
  const [brandForm, setBrandForm] = useState({ logoUrl: '', faviconUrl: '', primaryColor: '#c8a96b', secondaryColor: '#0ea5a0', customDomain: '' });

  const [orgLoading, setOrgLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [orgStatus, setOrgStatus] = useState(null); // 'saved' | 'error'
  const [brandStatus, setBrandStatus] = useState(null);

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name || '',
        billingEmail: org.billingEmail || '',
        defaultLocale: org.defaultLocale || 'en',
        defaultCurrency: org.defaultCurrency || 'QAR',
        defaultTimezone: org.defaultTimezone || 'UTC',
      });
    }
  }, [org]);

  useEffect(() => {
    if (branding) {
      setBrandForm({
        logoUrl: branding.logoUrl || '',
        faviconUrl: branding.faviconUrl || '',
        primaryColor: branding.primaryColor || '#c8a96b',
        secondaryColor: branding.secondaryColor || '#0ea5a0',
        customDomain: branding.customDomain || '',
      });
    }
  }, [branding]);

  const handleOrgSave = async (e) => {
    e.preventDefault();
    setOrgLoading(true);
    setOrgStatus(null);
    try {
      await organizationsAPI.updateMe({
        name: orgForm.name.trim() || undefined,
        billingEmail: orgForm.billingEmail.trim() || undefined,
        defaultLocale: orgForm.defaultLocale,
        defaultCurrency: orgForm.defaultCurrency,
        defaultTimezone: orgForm.defaultTimezone,
      });
      setOrgStatus('saved');
      setTimeout(() => setOrgStatus(null), 3000);
    } catch {
      setOrgStatus('error');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleBrandSave = async (e) => {
    e.preventDefault();
    setBrandLoading(true);
    setBrandStatus(null);
    try {
      await updateBranding({
        logoUrl: brandForm.logoUrl.trim() || undefined,
        faviconUrl: brandForm.faviconUrl.trim() || undefined,
        primaryColor: brandForm.primaryColor || undefined,
        secondaryColor: brandForm.secondaryColor || undefined,
        customDomain: brandForm.customDomain.trim() || undefined,
      });
      setBrandStatus('saved');
      setTimeout(() => setBrandStatus(null), 3000);
    } catch {
      setBrandStatus('error');
    } finally {
      setBrandLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[var(--brand-primary,#c8a96b)]" /> Organization Settings
        </h1>
        <p className="text-muted text-sm">Manage your organization details and branding.</p>
      </div>

      {/* Org details */}
      <form onSubmit={handleOrgSave} className="bg-surface-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Details</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Organization Name</label>
          <input
            value={orgForm.name}
            onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))}
            className="input w-full"
            placeholder="Acme Detailing"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Billing Email</label>
          <input
            type="email"
            value={orgForm.billingEmail}
            onChange={(e) => setOrgForm((p) => ({ ...p, billingEmail: e.target.value }))}
            className="input w-full"
            placeholder="billing@yourcompany.com"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select value={orgForm.defaultLocale} onChange={(e) => setOrgForm((p) => ({ ...p, defaultLocale: e.target.value }))} className="input w-full">
              {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select value={orgForm.defaultCurrency} onChange={(e) => setOrgForm((p) => ({ ...p, defaultCurrency: e.target.value }))} className="input w-full">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <select value={orgForm.defaultTimezone} onChange={(e) => setOrgForm((p) => ({ ...p, defaultTimezone: e.target.value }))} className="input w-full">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <StatusBar status={orgStatus} />

        <button type="submit" disabled={orgLoading} className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {orgLoading ? 'Saving...' : 'Save Details'}
        </button>
      </form>

      {/* Branding */}
      <form onSubmit={handleBrandSave} className="bg-surface-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Branding</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              value={brandForm.logoUrl}
              onChange={(e) => setBrandForm((p) => ({ ...p, logoUrl: e.target.value }))}
              className="input w-full"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Favicon URL</label>
            <input
              value={brandForm.faviconUrl}
              onChange={(e) => setBrandForm((p) => ({ ...p, faviconUrl: e.target.value }))}
              className="input w-full"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandForm.primaryColor}
                onChange={(e) => setBrandForm((p) => ({ ...p, primaryColor: e.target.value }))}
                className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                value={brandForm.primaryColor}
                onChange={(e) => setBrandForm((p) => ({ ...p, primaryColor: e.target.value }))}
                className="input flex-1 font-mono text-sm"
                placeholder="#c8a96b"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandForm.secondaryColor}
                onChange={(e) => setBrandForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                value={brandForm.secondaryColor}
                onChange={(e) => setBrandForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                className="input flex-1 font-mono text-sm"
                placeholder="#0ea5a0"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Custom Domain</label>
          <input
            value={brandForm.customDomain}
            onChange={(e) => setBrandForm((p) => ({ ...p, customDomain: e.target.value }))}
            className="input w-full"
            placeholder="mybusiness.com"
          />
          <p className="text-xs text-muted mt-1">Point your domain's CNAME to app.flowly.io first.</p>
        </div>

        {/* Color preview */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
          <div className="w-8 h-8 rounded-full" style={{ background: brandForm.primaryColor }} />
          <div className="w-8 h-8 rounded-full" style={{ background: brandForm.secondaryColor }} />
          <span className="text-sm text-muted">Brand color preview</span>
        </div>

        <StatusBar status={brandStatus} />

        <button type="submit" disabled={brandLoading} className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {brandLoading ? 'Saving...' : 'Save Branding'}
        </button>
      </form>
    </div>
  );
}

function StatusBar({ status }) {
  if (!status) return null;
  if (status === 'saved') return (
    <div className="flex items-center gap-2 text-green-500 text-sm">
      <CheckCircle className="w-4 h-4" /> Saved successfully.
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-red-500 text-sm">
      <AlertCircle className="w-4 h-4" /> Failed to save. Please try again.
    </div>
  );
}
