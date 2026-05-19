import React, { useEffect, useState } from 'react';
import { gdprAPI } from '../../api/gdpr';
import { ShieldCheck, Download, Trash2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function AdminGdpr() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    try { setRequests(await gdprAPI.getDeletionRequests()); }
    catch { setRequests([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleHardDelete = async (id, name) => {
    if (!window.confirm(`Permanently anonymise data for ${name}? This cannot be undone.`)) return;
    setDeleting(id);
    setMsg({ text: '', ok: true });
    try {
      await gdprAPI.hardDelete(id);
      setMsg({ text: `Data anonymised for user ${id}.`, ok: true });
      load();
    } catch (e) {
      setMsg({ text: e?.response?.data?.message || 'Hard delete failed.', ok: false });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
        <ShieldCheck size={24} className="text-[var(--color-primary)]" />
        GDPR / Data Management
      </h1>

      {msg.text && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>
          {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--color-text)]">Deletion Requests ({requests.length})</h2>
          <button onClick={load} className="btn-secondary flex items-center gap-1 text-sm">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No pending deletion requests.</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <div>
                  <p className="font-medium text-sm text-[var(--color-text)]">{r.firstName} {r.lastName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {r.email} · Requested {formatDate(r.deletionRequestedAt)} · Hard delete {formatDate(r.scheduledHardDelete)}
                  </p>
                </div>
                <button
                  onClick={() => handleHardDelete(r.id, `${r.firstName} ${r.lastName}`)}
                  disabled={!r.readyForDeletion || deleting === r.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    r.readyForDeletion
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-not-allowed'
                  }`}
                  title={r.readyForDeletion ? 'Anonymise now' : '30-day window not yet elapsed'}
                >
                  {deleting === r.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {r.readyForDeletion ? 'Anonymise' : 'Pending'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)] space-y-1.5">
        <p className="font-medium text-[var(--color-text)]">How it works</p>
        <p>- Customers request deletion from their profile page. Their account is immediately deactivated.</p>
        <p>- After 30 days the "Anonymise" button becomes available. Personal data (name, email, phone, address) is replaced with anonymised values.</p>
        <p>- Booking records are preserved with anonymised user data to maintain financial history integrity.</p>
        <p className="flex items-center gap-1 text-[var(--color-primary)]">
          <Download size={11} /> Customers can export their data at any time from their profile.
        </p>
      </div>
    </div>
  );
}
