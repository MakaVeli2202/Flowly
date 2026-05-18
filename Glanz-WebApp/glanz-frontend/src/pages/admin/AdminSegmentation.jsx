import React, { useState } from 'react';
import { crmAPI } from '../../api/crm';
import { Users, Download, Search, RefreshCw, Tag, AlertCircle } from 'lucide-react';

const SEGMENTS = ['All', 'VIP', 'At-Risk', 'Active', 'Inactive'];

const empty = { segment: 'All', minSpend: '', maxSpend: '', minBookings: '', maxBookings: '', lastBookingAfter: '', lastBookingBefore: '', tags: '' };

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const formatQar = (n) => `QAR ${Number(n).toLocaleString('en', { minimumFractionDigits: 0 })}`;

export default function AdminSegmentation() {
  const [filters, setFilters] = useState(empty);
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));

  const buildFilters = () => {
    const f = {};
    if (filters.segment && filters.segment !== 'All') f.segment = filters.segment;
    if (filters.minSpend !== '') f.minSpend = Number(filters.minSpend);
    if (filters.maxSpend !== '') f.maxSpend = Number(filters.maxSpend);
    if (filters.minBookings !== '') f.minBookings = Number(filters.minBookings);
    if (filters.maxBookings !== '') f.maxBookings = Number(filters.maxBookings);
    if (filters.lastBookingAfter) f.lastBookingAfter = filters.lastBookingAfter;
    if (filters.lastBookingBefore) f.lastBookingBefore = filters.lastBookingBefore;
    if (filters.tags.trim()) f.tags = filters.tags.trim();
    return f;
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmAPI.getSegmentedCustomers(buildFilters());
      setCustomers(res.filter(Boolean));
    } catch {
      setError('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await crmAPI.exportSegmentedCsv(buildFilters()); }
    catch { setError('Export failed.'); }
    finally { setExporting(false); }
  };

  const handleReset = () => { setFilters(empty); setCustomers(null); setError(''); };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
        <Users size={24} className="text-[var(--color-primary)]" />
        Customer Segmentation
      </h1>

      {/* Filter panel */}
      <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
        <h2 className="font-semibold text-[var(--color-text)] text-sm">Filters</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Segment</label>
            <select value={filters.segment} onChange={set('segment')} className="input w-full">
              {SEGMENTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Min Spend (QAR)</label>
            <input type="number" min="0" value={filters.minSpend} onChange={set('minSpend')} className="input w-full" placeholder="0" />
          </div>
          <div>
            <label className="label">Max Spend (QAR)</label>
            <input type="number" min="0" value={filters.maxSpend} onChange={set('maxSpend')} className="input w-full" placeholder="Any" />
          </div>
          <div>
            <label className="label">Min Bookings</label>
            <input type="number" min="0" value={filters.minBookings} onChange={set('minBookings')} className="input w-full" placeholder="0" />
          </div>
          <div>
            <label className="label">Max Bookings</label>
            <input type="number" min="0" value={filters.maxBookings} onChange={set('maxBookings')} className="input w-full" placeholder="Any" />
          </div>
          <div>
            <label className="label">Last Booking After</label>
            <input type="date" value={filters.lastBookingAfter} onChange={set('lastBookingAfter')} className="input w-full" />
          </div>
          <div>
            <label className="label">Last Booking Before</label>
            <input type="date" value={filters.lastBookingBefore} onChange={set('lastBookingBefore')} className="input w-full" />
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input type="text" value={filters.tags} onChange={set('tags')} className="input w-full" placeholder="VIP, Fleet" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
          <button onClick={handleReset} className="btn-secondary text-sm">Reset</button>
          {customers !== null && (
            <button onClick={handleExport} disabled={exporting} className="ml-auto btn-secondary flex items-center gap-2 text-sm">
              {exporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              Export CSV ({customers.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results table */}
      {customers !== null && (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text)]">{customers.length} customers matched</span>
          </div>
          {customers.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-text-muted)]">No customers match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Name</th>
                    <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Email</th>
                    <th className="text-right px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Total Spent</th>
                    <th className="text-right px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Bookings</th>
                    <th className="text-center px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Segment</th>
                    <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Last Booking</th>
                    <th className="text-left px-4 py-2.5 text-[var(--color-text-muted)] font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">{c.name}</td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{c.email}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-text)]">{formatQar(c.totalSpent)}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)]">{c.totalBookings}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.segment === 'VIP' ? 'bg-purple-100 text-purple-700' :
                          c.segment === 'At-Risk' ? 'bg-red-100 text-red-700' :
                          c.segment === 'Loyal' ? 'bg-green-100 text-green-700' :
                          c.segment === 'New' ? 'bg-blue-100 text-blue-700' :
                          'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}>{c.segment}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatDate(c.lastBookedDate)}</td>
                      <td className="px-4 py-2.5">
                        {c.tags ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                              <span key={t} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                                <Tag size={9} /> {t}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-[var(--color-text-muted)]">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
