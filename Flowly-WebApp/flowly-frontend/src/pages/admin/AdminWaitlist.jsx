import React, { useEffect, useState } from 'react';
import { waitlistAPI } from '../../api/waitlist';
import { Clock, Bell, Calendar, User, Package, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  Waiting:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Notified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Booked:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Expired:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function AdminWaitlist() {
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await waitlistAPI.getAll(date || undefined);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleNotify = async () => {
    if (!date) { setMsg('Select a date first.'); return; }
    setNotifying(true);
    setMsg('');
    try {
      const res = await waitlistAPI.notify(date);
      setMsg(`Notified ${res.notified} customer(s).`);
      load();
    } catch {
      setMsg('Notify failed.');
    } finally {
      setNotifying(false);
    }
  };

  const waiting = entries.filter(e => e.status === 'Waiting').length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
        <Clock size={24} className="text-[var(--color-primary)]" />
        Waitlist Queue
      </h1>

      {/* Filters + actions */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input"
        />
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button
          onClick={handleNotify}
          disabled={notifying || waiting === 0}
          className="btn-primary flex items-center gap-2"
        >
          <Bell size={15} /> Notify Waiting ({waiting})
        </button>
      </div>

      {msg && <p className="text-sm text-[var(--color-primary)] mb-4">{msg}</p>}

      {/* Table */}
      {entries.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">No waitlist entries{date ? ` for ${formatDate(date)}` : ''}.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-surface)]">
                  <User size={16} className="text-[var(--color-text-muted)]" />
                </div>
                <div>
                  <p className="font-medium text-sm text-[var(--color-text)]">
                    {entry.customerName || `Customer #${entry.userId}`}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(entry.requestedDate)}
                    </span>
                    {entry.preferredTimeSlot && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {entry.preferredTimeSlot}
                      </span>
                    )}
                    {entry.packageName && (
                      <span className="flex items-center gap-1">
                        <Package size={11} /> {entry.packageName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[entry.status] || STATUS_COLORS.Expired}`}>
                {entry.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
