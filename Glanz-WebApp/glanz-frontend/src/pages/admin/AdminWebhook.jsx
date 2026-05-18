import React, { useEffect, useState } from 'react';
import { webhookAPI } from '../../api/webhook';
import { Webhook, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const EVENT_TYPES = ['booking.created', 'booking.completed', 'booking.cancelled', 'payment.processed'];

const formatDate = (d) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const EMPTY_FORM = { eventType: 'booking.created', targetUrl: '', secret: '' };

export default function AdminWebhook() {
  const [subs, setSubs] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('subscriptions');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [filterEvent, setFilterEvent] = useState('');

  const loadSubs = async () => {
    try { setSubs(await webhookAPI.getSubscriptions()); }
    catch { setSubs([]); }
  };

  const loadDeliveries = async () => {
    try { setDeliveries(await webhookAPI.getDeliveries(filterEvent || undefined)); }
    catch { setDeliveries([]); }
  };

  useEffect(() => {
    Promise.all([loadSubs(), loadDeliveries()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (tab === 'deliveries') loadDeliveries();
  }, [filterEvent]); // eslint-disable-line

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setMsg({ text: '', ok: true });
    try {
      await webhookAPI.createSubscription(form);
      await loadSubs();
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setMsg({ text: 'Subscription created.', ok: true });
    } catch (err) {
      setMsg({ text: err?.response?.data?.message || 'Create failed.', ok: false });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this webhook subscription?')) return;
    try {
      await webhookAPI.deleteSubscription(id);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch {
      setMsg({ text: 'Delete failed.', ok: false });
    }
  };

  if (loading) return <div className="p-6 text-[var(--color-text-muted)]">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
        <Webhook size={24} className="text-[var(--color-primary)]" />
        Webhooks
      </h1>

      {msg.text && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>
          {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {['subscriptions', 'deliveries'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--color-text)]">Active Subscriptions ({subs.length})</h2>
            <button onClick={() => setShowAdd(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={15} /> Add Endpoint
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
              <div>
                <label className="label">Event Type</label>
                <select className="input w-full" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                  {EVENT_TYPES.map(et => <option key={et}>{et}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target URL <span className="text-red-500">*</span></label>
                <input required type="url" className="input w-full" placeholder="https://example.com/hooks/flowly" value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))} />
              </div>
              <div>
                <label className="label">Secret (optional)</label>
                <input type="password" className="input w-full" placeholder="Used to sign payloads with HMAC-SHA256" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Signature sent as <code className="bg-[var(--color-border)] px-1 rounded">X-Flowly-Signature: sha256=...</code></p>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={adding} className="btn-primary flex items-center gap-2">
                  {adding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Create
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          {subs.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No active subscriptions. Add an endpoint to receive events.</p>
          ) : (
            <div className="space-y-2">
              {subs.map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text)]">{sub.targetUrl}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      <span className="inline-block bg-[var(--color-border)] rounded px-1.5 py-0.5 mr-2">{sub.eventType}</span>
                      Added {formatDate(sub.createdAt)}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deliveries tab */}
      {tab === 'deliveries' && (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-semibold text-[var(--color-text)]">Delivery Log</h2>
            <select className="input text-sm" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
              <option value="">All events</option>
              {EVENT_TYPES.map(et => <option key={et}>{et}</option>)}
            </select>
            <button onClick={loadDeliveries} className="btn-secondary flex items-center gap-1 text-sm">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {deliveries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    {d.success
                      ? <CheckCircle size={15} className="text-green-500 shrink-0" />
                      : <XCircle size={15} className="text-red-500 shrink-0" />
                    }
                    <div>
                      <p className="text-sm text-[var(--color-text)]">
                        <span className="inline-block bg-[var(--color-border)] rounded px-1.5 py-0.5 mr-2 text-xs">{d.eventType}</span>
                        {d.responseStatusCode ? `HTTP ${d.responseStatusCode}` : 'No response'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{formatDate(d.createdAt)} · {d.attemptCount} attempt(s)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1">
        <p className="font-medium text-[var(--color-text)]">Available events</p>
        <p>- <code className="bg-[var(--color-border)] px-1 rounded">booking.created</code> - fired when a new booking is placed</p>
        <p>- <code className="bg-[var(--color-border)] px-1 rounded">booking.completed</code> - fired when a booking is marked complete</p>
        <p>- <code className="bg-[var(--color-border)] px-1 rounded">booking.cancelled</code> - fired when a booking is cancelled</p>
        <p>- <code className="bg-[var(--color-border)] px-1 rounded">payment.processed</code> - fired after a successful payment</p>
      </div>
    </div>
  );
}
