import React, { useState, useEffect, useCallback } from 'react';
import { recurringAPI, waitlistAPI } from '../../api/recurring';
import { packagesAPI } from '../../api/packages';
import { useLanguage } from '../../context/LanguageContext';
import {
  RefreshCw, Plus, Pause, Play, Trash2, Calendar,
  Clock, Car, Repeat, X, AlertCircle,
} from 'lucide-react';

const UI = {
  en: {
    title: 'Recurring Bookings',
    waitlistTitle: 'My Waitlist',
    newRule: 'New Recurring Rule',
    noRules: 'No recurring rules set up yet.',
    noWaitlist: 'You have no waitlist entries.',
    frequency: 'Frequency',
    weekly: 'Weekly',
    monthly: 'Monthly',
    dayOfWeek: 'Day of Week',
    dayOfMonth: 'Day of Month',
    timeSlot: 'Preferred Time',
    packages: 'Packages',
    vehicle: 'Vehicle',
    address: 'Address',
    nextDate: 'Next booking',
    active: 'Active',
    paused: 'Paused',
    pause: 'Pause',
    resume: 'Resume',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save Rule',
    joinWaitlist: 'Join Waitlist',
    leaveWaitlist: 'Leave',
    waitlistDate: 'Date',
    waitlistSlot: 'Time (optional)',
    waitlistPkg: 'Package (optional)',
    waitlistStatus: 'Status',
    saving: 'Saving...',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    vehicleTypes: ['Sedan', 'SUV', 'Pickup', 'Motorcycle'],
  },
  de: {
    title: 'Wiederkehrende Buchungen',
    waitlistTitle: 'Meine Warteliste',
    newRule: 'Neue Regel',
    noRules: 'Keine wiederkehrenden Regeln.',
    noWaitlist: 'Keine Wartelisteneinträge.',
    frequency: 'Häufigkeit',
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    dayOfWeek: 'Wochentag',
    dayOfMonth: 'Tag des Monats',
    timeSlot: 'Bevorzugte Zeit',
    packages: 'Pakete',
    vehicle: 'Fahrzeug',
    address: 'Adresse',
    nextDate: 'Nächste Buchung',
    active: 'Aktiv',
    paused: 'Pausiert',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    delete: 'Löschen',
    cancel: 'Abbrechen',
    save: 'Regel speichern',
    joinWaitlist: 'Warteliste beitreten',
    leaveWaitlist: 'Verlassen',
    waitlistDate: 'Datum',
    waitlistSlot: 'Zeit (optional)',
    waitlistPkg: 'Paket (optional)',
    waitlistStatus: 'Status',
    saving: 'Speichern...',
    days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    vehicleTypes: ['Limousine', 'SUV', 'Pickup', 'Motorrad'],
  },
  ar: {
    title: 'الحجوزات المتكررة',
    waitlistTitle: 'قائمة الانتظار',
    newRule: 'قاعدة جديدة',
    noRules: 'لا توجد قواعد متكررة.',
    noWaitlist: 'لا توجد قيود في قائمة الانتظار.',
    frequency: 'التكرار',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    dayOfWeek: 'يوم الأسبوع',
    dayOfMonth: 'يوم الشهر',
    timeSlot: 'الوقت المفضل',
    packages: 'الباقات',
    vehicle: 'المركبة',
    address: 'العنوان',
    nextDate: 'الحجز التالي',
    active: 'نشط',
    paused: 'متوقف',
    pause: 'إيقاف',
    resume: 'استئناف',
    delete: 'حذف',
    cancel: 'إلغاء',
    save: 'حفظ القاعدة',
    joinWaitlist: 'انضم للقائمة',
    leaveWaitlist: 'غادر',
    waitlistDate: 'التاريخ',
    waitlistSlot: 'الوقت (اختياري)',
    waitlistPkg: 'الباقة (اختياري)',
    waitlistStatus: 'الحالة',
    saving: 'جاري الحفظ...',
    days: ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'],
    vehicleTypes: ['سيدان', 'SUV', 'بيكأب', 'دراجة'],
  },
};

const DEFAULT_FORM = {
  frequency: 'Weekly',
  dayOfWeek: 1,
  dayOfMonth: 1,
  preferredTimeSlot: '09:00',
  packageIds: [],
  vehicleType: 'Sedan',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  customerAddress: '',
};

const DEFAULT_WAITLIST = {
  requestedDate: '',
  preferredTimeSlot: '',
  packageId: '',
};

export default function RecurringBookings() {
  const { language } = useLanguage();
  const ui = UI[language] || UI.en;

  const [rules, setRules]               = useState([]);
  const [waitlist, setWaitlist]         = useState([]);
  const [packages, setPackages]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [form, setForm]                 = useState(DEFAULT_FORM);
  const [wForm, setWForm]               = useState(DEFAULT_WAITLIST);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, w, p] = await Promise.all([
        recurringAPI.getMyRules(),
        waitlistAPI.getMyEntries(),
        packagesAPI.getAll(),
      ]);
      setRules(r);
      setWaitlist(w);
      setPackages(p.filter(p => p.isActive !== false));
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveRule = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        dayOfWeek:  form.frequency === 'Weekly'  ? parseInt(form.dayOfWeek)  : null,
        dayOfMonth: form.frequency === 'Monthly' ? parseInt(form.dayOfMonth) : null,
        packageIds: form.packageIds.map(Number),
      };
      await recurringAPI.createRule(payload);
      setShowForm(false);
      setForm(DEFAULT_FORM);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    try {
      if (rule.isActive) await recurringAPI.pauseRule(rule.id);
      else await recurringAPI.resumeRule(rule.id);
      await load();
    } catch {
      setError('Action failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recurring rule?')) return;
    try {
      await recurringAPI.deleteRule(id);
      await load();
    } catch {
      setError('Delete failed.');
    }
  };

  const handleJoinWaitlist = async () => {
    setSaving(true);
    setError(null);
    try {
      await waitlistAPI.join({
        requestedDate: wForm.requestedDate,
        preferredTimeSlot: wForm.preferredTimeSlot || null,
        packageId: wForm.packageId ? parseInt(wForm.packageId) : null,
      });
      setShowWaitlistForm(false);
      setWForm(DEFAULT_WAITLIST);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to join waitlist.');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveWaitlist = async (id) => {
    try {
      await waitlistAPI.leave(id);
      await load();
    } catch {
      setError('Failed to leave waitlist.');
    }
  };

  const togglePackage = (id) => {
    setForm(f => ({
      ...f,
      packageIds: f.packageIds.includes(id)
        ? f.packageIds.filter(p => p !== id)
        : [...f.packageIds, id],
    }));
  };

  const statusBadge = (s) => {
    const map = { Waiting: 'bg-yellow-100 text-yellow-800', Notified: 'bg-blue-100 text-blue-800', Booked: 'bg-green-100 text-green-800', Expired: 'bg-gray-100 text-gray-500' };
    return map[s] || map.Waiting;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-[var(--muted-color)]" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Recurring Rules ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--heading-color)]">{ui.title}</h2>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--cta-bg)] text-[var(--cta-text)] text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {ui.newRule}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
          <div className="grid grid-cols-2 gap-3">
            {/* Frequency */}
            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.frequency}</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm">
                <option value="Weekly">{ui.weekly}</option>
                <option value="Monthly">{ui.monthly}</option>
              </select>
            </div>
            {form.frequency === 'Weekly' && (
              <div>
                <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.dayOfWeek}</label>
                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm">
                  {ui.days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.frequency === 'Monthly' && (
              <div>
                <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.dayOfMonth}</label>
                <input type="number" min={1} max={28} value={form.dayOfMonth}
                  onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.timeSlot}</label>
              <input type="time" value={form.preferredTimeSlot}
                onChange={e => setForm(f => ({ ...f, preferredTimeSlot: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.vehicle}</label>
              <select value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm">
                {['Sedan', 'SUV', 'Pickup', 'Motorcycle'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.address}</label>
              <input type="text" value={form.customerAddress}
                onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-color)] mb-2">{ui.packages}</label>
              <div className="flex flex-wrap gap-2">
                {packages.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => togglePackage(p.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${form.packageIds.includes(p.id) ? 'bg-[var(--cta-bg)] text-[var(--cta-text)] border-transparent' : 'border-[var(--border-color)] text-[var(--text-color)]'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSaveRule} disabled={saving || form.packageIds.length === 0}
              className="px-4 py-2 rounded-lg bg-[var(--cta-bg)] text-[var(--cta-text)] text-sm font-medium disabled:opacity-50">
              {saving ? ui.saving : ui.save}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-color)] text-sm">
              {ui.cancel}
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showForm ? (
        <p className="text-[var(--muted-color)] text-sm">{ui.noRules}</p>
      ) : (
        <div className="space-y-3 mb-8">
          {rules.map(rule => (
            <div key={rule.id} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] flex items-start gap-3">
              <Repeat className="w-5 h-5 mt-0.5 text-[var(--muted-color)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--heading-color)]">
                    {rule.frequency === 'Weekly' ? `${ui.weekly} - ${ui.days[rule.dayOfWeek]}` : `${ui.monthly} - ${rule.dayOfMonth}`}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.isActive ? ui.active : ui.paused}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-color)] flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rule.preferredTimeSlot}</span>
                  <span className="flex items-center gap-1"><Car className="w-3 h-3" />{rule.vehicleType}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                    {ui.nextDate}: {new Date(rule.nextScheduledDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(rule)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-bg)] transition" title={rule.isActive ? ui.pause : ui.resume}>
                  {rule.isActive ? <Pause className="w-4 h-4 text-[var(--muted-color)]" /> : <Play className="w-4 h-4 text-[var(--muted-color)]" />}
                </button>
                <button onClick={() => handleDelete(rule.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-bg)] transition" title={ui.delete}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Waitlist ── */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-xl font-semibold text-[var(--heading-color)]">{ui.waitlistTitle}</h2>
        <button
          onClick={() => { setShowWaitlistForm(true); setError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-color)] text-sm font-medium hover:bg-[var(--surface-bg)] transition"
        >
          <Plus className="w-4 h-4" /> {ui.joinWaitlist}
        </button>
      </div>

      {showWaitlistForm && (
        <div className="mb-6 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.waitlistDate}</label>
              <input type="date" value={wForm.requestedDate}
                onChange={e => setWForm(f => ({ ...f, requestedDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.waitlistSlot}</label>
              <input type="time" value={wForm.preferredTimeSlot}
                onChange={e => setWForm(f => ({ ...f, preferredTimeSlot: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-color)] mb-1">{ui.waitlistPkg}</label>
              <select value={wForm.packageId}
                onChange={e => setWForm(f => ({ ...f, packageId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2 text-sm">
                <option value="">Any</option>
                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleJoinWaitlist} disabled={saving || !wForm.requestedDate}
              className="px-4 py-2 rounded-lg bg-[var(--cta-bg)] text-[var(--cta-text)] text-sm font-medium disabled:opacity-50">
              {saving ? ui.saving : ui.joinWaitlist}
            </button>
            <button onClick={() => setShowWaitlistForm(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-color)] text-sm">
              {ui.cancel}
            </button>
          </div>
        </div>
      )}

      {waitlist.length === 0 && !showWaitlistForm ? (
        <p className="text-[var(--muted-color)] text-sm">{ui.noWaitlist}</p>
      ) : (
        <div className="space-y-2">
          {waitlist.map(entry => (
            <div key={entry.id} className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[var(--muted-color)] shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium text-[var(--heading-color)]">
                  {new Date(entry.requestedDate).toLocaleDateString()}
                </span>
                {entry.preferredTimeSlot && <span className="ml-2 text-[var(--muted-color)]">{entry.preferredTimeSlot}</span>}
                {entry.packageName && <span className="ml-2 text-[var(--muted-color)]">- {entry.packageName}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(entry.status)}`}>{entry.status}</span>
              {entry.status === 'Waiting' && (
                <button onClick={() => handleLeaveWaitlist(entry.id)}
                  className="p-1 rounded hover:bg-[var(--surface-bg)] transition" title={ui.leaveWaitlist}>
                  <X className="w-4 h-4 text-[var(--muted-color)]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
