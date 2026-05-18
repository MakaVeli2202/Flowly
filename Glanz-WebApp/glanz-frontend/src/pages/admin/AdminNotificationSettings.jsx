import React, { useEffect, useState } from 'react';
import { notificationConfigAPI } from '../../api/notificationConfig';
import { Bell, Save, Loader, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-[var(--color-text)]">{title}</span>
        {open ? <ChevronUp size={16} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={16} className="text-[var(--color-text-muted)]" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-[var(--color-border)] pt-4">{children}</div>}
    </div>
  );
};

const Toggle = ({ label, description, checked, onChange }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
      {description && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="space-y-1">
    <label className="label">{label}</label>
    {children}
    {hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
  </div>
);

const defaults = {
  birthdayOfferEnabled: true, birthdayDiscountPct: 20,
  birthdayMessageTemplate: 'Happy Birthday {firstName}! Enjoy {discount}% off your next booking this week.',
  anniversaryOfferEnabled: true, anniversaryDiscountPct: 15,
  anniversaryMessageTemplate: "It's been a year since your first booking! Here's {discount}% off as a thank you.",
  reviewRequestEnabled: true, reviewRequestDelayHours: 2,
  reviewRequestTemplate: "How was your experience today? We'd love a quick review - it means a lot to our team!",
  reminderEnabled: true, reminderHoursBefore: 24,
  reminderTemplate: 'Reminder: your booking is tomorrow at {time}. We look forward to seeing you!',
  escalationEnabled: true, escalationHoursBefore: 2,
  escalationTemplate: 'Your appointment is in {hours} hours. Please confirm or call us to reschedule.',
};

export default function AdminNotificationSettings() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });

  useEffect(() => {
    notificationConfigAPI.get()
      .then(d => setForm({ ...defaults, ...d }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setNum = (k) => (e) => set(k, Number(e.target.value));
  const setStr = (k) => (e) => set(k, e.target.value);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', ok: true });
    try {
      await notificationConfigAPI.update(form);
      setMsg({ text: 'Settings saved.', ok: true });
    } catch (err) {
      setMsg({ text: err?.response?.data?.message || 'Save failed.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
        <Bell size={24} className="text-[var(--color-primary)]" />
        Notification Settings
      </h1>

      <p className="text-sm text-[var(--color-text-muted)]">
        All notifications are delivered via push to the customer's mobile app.
        Use <code className="bg-[var(--color-surface)] px-1 rounded text-xs">{'{firstName}'}</code>,{' '}
        <code className="bg-[var(--color-surface)] px-1 rounded text-xs">{'{discount}'}</code>,{' '}
        <code className="bg-[var(--color-surface)] px-1 rounded text-xs">{'{time}'}</code>,{' '}
        <code className="bg-[var(--color-surface)] px-1 rounded text-xs">{'{hours}'}</code> as placeholders.
      </p>

      <form onSubmit={handleSave} className="space-y-4">

        <Section title="Birthday Offer">
          <Toggle
            label="Enable birthday offers"
            description="Sends a push with a discount code on the customer's birthday."
            checked={form.birthdayOfferEnabled}
            onChange={v => set('birthdayOfferEnabled', v)}
          />
          {form.birthdayOfferEnabled && (
            <>
              <Field label="Discount (%)">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} step={5} value={form.birthdayDiscountPct} onChange={setNum('birthdayDiscountPct')} className="flex-1 accent-[var(--color-primary)]" />
                  <span className="w-12 text-center font-semibold text-[var(--color-primary)]">{form.birthdayDiscountPct}%</span>
                </div>
              </Field>
              <Field label="Message template" hint="Use {firstName} and {discount}">
                <textarea value={form.birthdayMessageTemplate} onChange={setStr('birthdayMessageTemplate')} rows={2} className="input w-full resize-none" />
              </Field>
            </>
          )}
        </Section>

        <Section title="First-Booking Anniversary Offer">
          <Toggle
            label="Enable anniversary offers"
            description="Sends a push on the anniversary of the customer's first booking."
            checked={form.anniversaryOfferEnabled}
            onChange={v => set('anniversaryOfferEnabled', v)}
          />
          {form.anniversaryOfferEnabled && (
            <>
              <Field label="Discount (%)">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} step={5} value={form.anniversaryDiscountPct} onChange={setNum('anniversaryDiscountPct')} className="flex-1 accent-[var(--color-primary)]" />
                  <span className="w-12 text-center font-semibold text-[var(--color-primary)]">{form.anniversaryDiscountPct}%</span>
                </div>
              </Field>
              <Field label="Message template" hint="Use {firstName} and {discount}">
                <textarea value={form.anniversaryMessageTemplate} onChange={setStr('anniversaryMessageTemplate')} rows={2} className="input w-full resize-none" />
              </Field>
            </>
          )}
        </Section>

        <Section title="Review Request">
          <Toggle
            label="Enable review request"
            description="Sends a push after a booking is completed asking for a review."
            checked={form.reviewRequestEnabled}
            onChange={v => set('reviewRequestEnabled', v)}
          />
          {form.reviewRequestEnabled && (
            <>
              <Field label="Delay after completion (hours)" hint="Recommended: 2 hours.">
                <input type="number" min={0} max={72} value={form.reviewRequestDelayHours} onChange={setNum('reviewRequestDelayHours')} className="input w-28" />
              </Field>
              <Field label="Message template">
                <textarea value={form.reviewRequestTemplate} onChange={setStr('reviewRequestTemplate')} rows={2} className="input w-full resize-none" />
              </Field>
            </>
          )}
        </Section>

        <Section title="Booking Reminder">
          <Toggle
            label="Enable booking reminder"
            description="Sends a push before an upcoming booking."
            checked={form.reminderEnabled}
            onChange={v => set('reminderEnabled', v)}
          />
          {form.reminderEnabled && (
            <>
              <Field label="Hours before booking">
                <input type="number" min={1} max={72} value={form.reminderHoursBefore} onChange={setNum('reminderHoursBefore')} className="input w-28" />
              </Field>
              <Field label="Message template" hint="Use {time}">
                <textarea value={form.reminderTemplate} onChange={setStr('reminderTemplate')} rows={2} className="input w-full resize-none" />
              </Field>
            </>
          )}
        </Section>

        <Section title="Escalation (No-Show Prevention)">
          <Toggle
            label="Enable escalation push"
            description="Sends a second push close to booking time if customer hasn't confirmed."
            checked={form.escalationEnabled}
            onChange={v => set('escalationEnabled', v)}
          />
          {form.escalationEnabled && (
            <>
              <Field label="Hours before booking (must be less than reminder window)">
                <input type="number" min={1} max={24} value={form.escalationHoursBefore} onChange={setNum('escalationHoursBefore')} className="input w-28" />
              </Field>
              <Field label="Message template" hint="Use {hours} and {time}">
                <textarea value={form.escalationTemplate} onChange={setStr('escalationTemplate')} rows={2} className="input w-full resize-none" />
              </Field>
            </>
          )}
        </Section>

        {msg.text && (
          <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>
            {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          Save Notification Settings
        </button>
      </form>
    </div>
  );
}
