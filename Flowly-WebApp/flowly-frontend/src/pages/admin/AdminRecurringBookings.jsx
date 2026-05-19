import React, { useEffect, useState } from 'react';
import { recurringAPI } from '../../api/recurring';
import { RefreshCw, Pause, Play, Calendar, Clock, User } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const UI = {
  en: {
    title: 'Recurring Bookings',
    subtitle: 'All active auto-booking schedules across customers',
    loading: 'Loading...',
    empty: 'No recurring schedules found.',
    frequency: 'Frequency',
    nextDate: 'Next Date',
    timeSlot: 'Time',
    status: 'Status',
    customer: 'Customer',
    vehicle: 'Vehicle',
    active: 'Active',
    paused: 'Paused',
    weekly: 'Weekly',
    monthly: 'Monthly',
    day: 'Day',
    packages: 'Packages',
    error: 'Failed to load recurring bookings.',
  },
  ar: {
    title: 'الحجوزات المتكررة',
    subtitle: 'جميع جداول الحجز التلقائي عبر العملاء',
    loading: 'جارٍ التحميل...',
    empty: 'لا توجد جداول متكررة.',
    frequency: 'التكرار',
    nextDate: 'التاريخ القادم',
    timeSlot: 'الوقت',
    status: 'الحالة',
    customer: 'العميل',
    vehicle: 'المركبة',
    active: 'نشط',
    paused: 'موقوف',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    day: 'اليوم',
    packages: 'الباقات',
    error: 'فشل تحميل الحجوزات المتكررة.',
  },
  de: {
    title: 'Wiederkehrende Buchungen',
    subtitle: 'Alle automatischen Buchungspläne aller Kunden',
    loading: 'Laden...',
    empty: 'Keine wiederkehrenden Pläne gefunden.',
    frequency: 'Häufigkeit',
    nextDate: 'Nächstes Datum',
    timeSlot: 'Zeit',
    status: 'Status',
    customer: 'Kunde',
    vehicle: 'Fahrzeug',
    active: 'Aktiv',
    paused: 'Pausiert',
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    day: 'Tag',
    packages: 'Pakete',
    error: 'Wiederkehrende Buchungen konnten nicht geladen werden.',
  },
};

export default function AdminRecurringBookings() {
  const lang = localStorage.getItem('lang') || 'en';
  const ui = UI[lang] || UI.en;

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    recurringAPI.getAdminAll()
      .then(data => setRules(data || []))
      .catch(() => setError(ui.error))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rules.filter(r => {
    if (filter === 'active' && !r.isActive) return false;
    if (filter === 'paused' && r.isActive) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (r.vehicleMake || '').toLowerCase().includes(q) ||
      (r.vehicleModel || '').toLowerCase().includes(q) ||
      (r.preferredTimeSlot || '').includes(q)
    );
  });

  const freqLabel = r => {
    if (r.frequency === 'Weekly') return `${ui.weekly} - ${DAYS[r.dayOfWeek ?? 0]}`;
    if (r.frequency === 'Monthly') return `${ui.monthly} - ${ui.day} ${r.dayOfMonth}`;
    return r.frequency;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-bg)' }}>
      <RefreshCw size={24} className="animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-bg)' }}>
      <p className="text-red-400">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--surface-bg)' }}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)]">{ui.title}</h1>
          <p className="text-sm text-[var(--muted-color)] mt-1">{ui.subtitle}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-sm w-48"
          />
          {['all', 'active', 'paused'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f ? 'bg-primary text-white' : 'bg-[var(--card-bg)] text-[var(--muted-color)] border border-[var(--border-color)]'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="text-xs text-[var(--muted-color)] ml-auto">{filtered.length} rules</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted-color)]">{ui.empty}</div>
        ) : (
          <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                  {[ui.frequency, ui.nextDate, ui.timeSlot, ui.vehicle, ui.packages, ui.status].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--muted-color)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg)] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw size={13} className="text-primary" />
                        <span className="font-medium text-[var(--text-color)]">{freqLabel(r)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[var(--text-color)]">
                        <Calendar size={13} className="text-[var(--muted-color)]" />
                        {new Date(r.nextScheduledDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[var(--text-color)]">
                        <Clock size={13} className="text-[var(--muted-color)]" />
                        {r.preferredTimeSlot}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-color)]">
                      {[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ') || r.vehicleType}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-color)] text-xs">
                      {r.packageIds?.length > 0 ? `${r.packageIds.length} pkg` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${r.isActive ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {r.isActive ? <Play size={10} /> : <Pause size={10} />}
                        {r.isActive ? ui.active : ui.paused}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
