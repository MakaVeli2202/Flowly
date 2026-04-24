import React, { useEffect, useState } from 'react';
import {
  Calendar, RefreshCw, CheckCircle, XCircle, Clock,
  AlertCircle, ChevronDown, User, Package,
} from 'lucide-react';
import { subscriptionsAPI } from '../../api/subscriptions';
import { formatQAR } from '../../utils/currency';

const STATUS_COLORS = {
  Pending:   { bg: 'rgba(245,158,11,.12)',  color: '#f59e0b' },
  Confirmed: { bg: 'rgba(59,130,246,.12)',  color: '#3b82f6' },
  InProgress:{ bg: 'rgba(168,85,247,.12)',  color: '#a855f7' },
  Completed: { bg: 'rgba(16,185,129,.12)',  color: '#10b981' },
  Cancelled: { bg: 'rgba(239,68,68,.12)',   color: '#ef4444' },
};

const STATUS_OPTIONS = ['', 'Pending', 'Confirmed', 'InProgress', 'Completed', 'Cancelled'];

export default function AdminSubscriptionBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [updateForm, setUpdateForm] = useState({});

  const load = async (st = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const data = await subscriptionsAPI.getAllBookings(st ? { status: st } : {});
      setBookings(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusFilter = (v) => {
    setStatusFilter(v);
    load(v);
  };

  const toggleExpand = (id) => {
    setExpanded(exp => exp === id ? null : id);
    setUpdateForm({});
  };

  const handleUpdate = async (id) => {
    setUpdatingId(id);
    try {
      const updated = await subscriptionsAPI.updateBooking(id, updateForm);
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
      setExpanded(null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update booking.');
    } finally {
      setUpdatingId(null);
    }
  };

  const STATUS_ICON = { Pending: Clock, Confirmed: CheckCircle, InProgress: RefreshCw, Completed: CheckCircle, Cancelled: XCircle };

  return (
    <div className="min-h-screen py-12 px-4 relative"
      style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
      <div className="container mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Admin</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)]">Subscription Bookings</h1>
          </div>
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={e => handleStatusFilter(e.target.value)}
              className="bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none focus:border-primary">
              {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{s || 'All Statuses'}</option>)}
            </select>
            <button onClick={() => load()} className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-white/5 transition text-[var(--muted-color)]">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
            <AlertCircle size={14} className="text-rose-400 mt-0.5" />
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Calendar size={40} className="mx-auto mb-3 opacity-40 text-[var(--muted-color)]" />
            <p className="text-[var(--muted-color)]">No subscription bookings found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const sc = STATUS_COLORS[b.status] || STATUS_COLORS.Pending;
              const SIcon = STATUS_ICON[b.status] || Clock;
              const isOpen = expanded === b.id;
              return (
                <div key={b.id} className="glass-card overflow-hidden">
                  <button onClick={() => toggleExpand(b.id)} className="w-full p-5 text-left flex items-center gap-4">
                    {/* Status chip */}
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
                      style={{ background: sc.bg, color: sc.color }}>
                      <SIcon size={11} /> {b.status}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[var(--heading-color)] text-sm">{b.bookingNumber}</p>
                        {b.planName && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b' }}>
                            {b.planName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <p className="text-xs text-[var(--muted-color)] flex items-center gap-1">
                          <User size={10} /> {b.customerName || `User #${b.userId}`}
                        </p>
                        {b.packageName && (
                          <p className="text-xs text-[var(--muted-color)] flex items-center gap-1">
                            <Package size={10} /> {b.packageName}
                          </p>
                        )}
                        <p className="text-xs text-[var(--muted-color)] flex items-center gap-1">
                          <Calendar size={10} /> {new Date(b.scheduledDate).toLocaleDateString()} {b.timeSlot?.split('-')[0]}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-[var(--heading-color)]">{formatQAR(b.finalAmount)}</p>
                      {b.discountAmount > 0 && (
                        <p className="text-xs text-green-400">-{formatQAR(b.discountAmount)}</p>
                      )}
                    </div>

                    <ChevronDown size={16} className={`text-[var(--muted-color)] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-[var(--border-color)] pt-4">
                      <div className="grid sm:grid-cols-2 gap-4 mb-5 text-sm">
                        <Detail label="Customer" value={`${b.customerName || '—'} (${b.customerEmail || '—'})`} />
                        <Detail label="Plan" value={b.planName || '—'} />
                        <Detail label="Package" value={b.packageName || '—'} />
                        <Detail label="Scheduled" value={`${new Date(b.scheduledDate).toLocaleDateString()} at ${b.timeSlot?.split('-')[0]}`} />
                        <Detail label="Worker" value={b.workerName || 'Not assigned'} />
                        <Detail label="Notes" value={b.notes || '—'} />
                        <Detail label="Original" value={formatQAR(b.originalAmount)} />
                        <Detail label="Discount" value={formatQAR(b.discountAmount)} />
                        <Detail label="Final" value={formatQAR(b.finalAmount)} bold />
                      </div>

                      {/* Update form */}
                      <div className="grid sm:grid-cols-3 gap-3 mb-3">
                        <select value={updateForm.status || ''}
                          onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
                          className="bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none">
                          <option value="" className="bg-[#1a1a2e]">— Change Status —</option>
                          {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s} className="bg-[#1a1a2e]">{s}</option>)}
                        </select>
                        <input value={updateForm.workerId || ''}
                          onChange={e => setUpdateForm(f => ({ ...f, workerId: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder="Worker ID"
                          className="bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none placeholder-[var(--muted-color)]" />
                        <input value={updateForm.notes || ''}
                          onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Notes"
                          className="bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-color)] focus:outline-none placeholder-[var(--muted-color)]" />
                      </div>
                      <button onClick={() => handleUpdate(b.id)} disabled={updatingId === b.id}
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)' }}>
                        {updatingId === b.id ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, bold }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-color)] mb-0.5">{label}</p>
      <p className={`text-sm ${bold ? 'font-bold text-[var(--heading-color)]' : 'text-[var(--text-color)]'}`}>{value}</p>
    </div>
  );
}
