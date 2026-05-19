import { useState } from 'react';
import { clientAssetsAPI } from '../../api/clientAssets';
import { formatQAR } from '../../utils/currency';

export default function AdminAssetSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyModal, setHistoryModal] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setResults(await clientAssetsAPI.adminSearch(query));
    } catch {
      setError('Search failed.');
    }
    setLoading(false);
  }

  async function openHistory(asset) {
    setHistoryModal({ asset, bookings: null });
    setHistoryLoading(true);
    try {
      const data = await clientAssetsAPI.adminGetHistory(asset.id);
      setHistoryModal({ asset: data.asset, bookings: data.bookings });
    } catch {
      setHistoryModal(null);
    }
    setHistoryLoading(false);
  }

  function parseAttributes(json) {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--heading-color)] mb-6">Asset / Plate Lookup</h1>

      <form onSubmit={search} className="flex gap-3 mb-6">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by plate, label, customer name or phone..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button type="submit" disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {results !== null && (
        results.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted-color)]">No assets found.</div>
        ) : (
          <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-white/[0.02]">
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Label / Plate</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Details</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Customer</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Category</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map(a => {
                  const attrs = parseAttributes(a.attributesJson);
                  const detailParts = attrs
                    ? [attrs.make, attrs.model, attrs.year].filter(Boolean)
                    : [];
                  return (
                    <tr key={a.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02]">
                      <td className="p-3 font-semibold text-[var(--text-color)]">{a.label}</td>
                      <td className="p-3 text-[var(--muted-color)]">
                        {detailParts.length > 0 ? detailParts.join(' ') : '-'}
                      </td>
                      <td className="p-3">
                        {a.customer ? (
                          <>
                            <div className="text-[var(--text-color)] font-medium">{a.customer.name}</div>
                            <div className="text-[11px] text-[var(--muted-color)]">{a.customer.phone}</div>
                          </>
                        ) : <span className="text-[var(--muted-color)]">-</span>}
                      </td>
                      <td className="p-3 text-[var(--muted-color)]">{a.categoryName || '-'}</td>
                      <td className="p-3">
                        <button onClick={() => openHistory(a)}
                          className="text-xs px-3 py-1 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5">
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHistoryModal(null)}>
          <div className="bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-color)] w-full max-w-2xl max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--heading-color)]">{historyModal.asset?.label}</h3>
                {historyModal.asset?.customerName && (
                  <p className="text-xs text-[var(--muted-color)]">{historyModal.asset.customerName} · {historyModal.asset.customerPhone}</p>
                )}
              </div>
              <button onClick={() => setHistoryModal(null)} className="text-[var(--muted-color)] hover:text-[var(--text-color)]">✕</button>
            </div>
            <div className="p-5">
              {historyLoading ? (
                <p className="text-center text-[var(--muted-color)] py-8">Loading...</p>
              ) : !historyModal.bookings || historyModal.bookings.length === 0 ? (
                <p className="text-center text-[var(--muted-color)] py-8">No booking history.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Booking #', 'Date', 'Time', 'Status', 'Amount'].map(h => (
                        <th key={h} className="text-left pb-2 text-[var(--muted-color)] font-semibold text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.bookings.map(b => (
                      <tr key={b.id} className="border-b border-[var(--border-color)]/50">
                        <td className="py-2 font-mono text-xs text-[var(--text-color)]">{b.bookingNumber}</td>
                        <td className="py-2 text-[var(--text-color)]">{new Date(b.scheduledDate).toLocaleDateString()}</td>
                        <td className="py-2 text-[var(--muted-color)]">{b.timeSlot}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            b.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                            b.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{b.status}</span>
                        </td>
                        <td className="py-2 font-semibold text-[var(--text-color)]">{formatQAR(b.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
