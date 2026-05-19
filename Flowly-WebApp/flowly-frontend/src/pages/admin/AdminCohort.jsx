import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../../api/reports';
import { Users, RefreshCw } from 'lucide-react';

const MONTHS_OPTIONS = [3, 6, 12];

function heatColor(pct) {
  if (pct === null || pct === undefined) return 'bg-[var(--color-surface)] text-[var(--color-text-muted)]';
  if (pct >= 60) return 'bg-green-600 text-white';
  if (pct >= 40) return 'bg-green-400 text-white';
  if (pct >= 20) return 'bg-yellow-400 text-gray-900';
  if (pct >= 5)  return 'bg-orange-300 text-gray-900';
  return 'bg-red-200 text-red-900';
}

export default function AdminCohort() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsAPI.getCohortRetention(months);
      setData(res);
    } catch {
      setError('Failed to load cohort data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [months]); // eslint-disable-line

  const cohorts = data?.cohorts || [];
  const maxOffset = cohorts.reduce((max, c) => Math.max(max, (c.retentionByMonth?.length || 0)), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
        <Users size={24} className="text-[var(--color-primary)]" />
        Cohort Retention
      </h1>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-[var(--color-text-muted)]">Window:</span>
        {MONTHS_OPTIONS.map(m => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              months === m
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
            }`}
          >
            {m} months
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading && !data && (
        <div className="text-[var(--color-text-muted)] text-sm">Loading...</div>
      )}

      {cohorts.length > 0 && (
        <>
          {/* Legend */}
          <div className="flex gap-3 mb-4 flex-wrap text-xs">
            {[['>=60%','bg-green-600 text-white'],['40-59%','bg-green-400 text-white'],['20-39%','bg-yellow-400 text-gray-900'],['5-19%','bg-orange-300 text-gray-900'],['<5%','bg-red-200 text-red-900'],['n/a','bg-[var(--color-surface)] text-[var(--color-text-muted)]']].map(([label,cls]) => (
              <span key={label} className={`px-2 py-0.5 rounded ${cls}`}>{label}</span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)] font-medium whitespace-nowrap">Cohort</th>
                  <th className="text-center py-2 px-2 text-[var(--color-text-muted)] font-medium whitespace-nowrap">Size</th>
                  {Array.from({ length: maxOffset }, (_, i) => (
                    <th key={i} className="text-center py-2 px-1 text-[var(--color-text-muted)] font-medium whitespace-nowrap">
                      M+{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohortMonth}>
                    <td className="py-1.5 pr-4 text-[var(--color-text)] font-medium whitespace-nowrap">{c.cohortMonth}</td>
                    <td className="text-center py-1.5 px-2 text-[var(--color-text-muted)]">{c.cohortSize}</td>
                    {Array.from({ length: maxOffset }, (_, i) => {
                      const pct = c.retentionByMonth?.[i];
                      return (
                        <td key={i} className="py-1 px-1">
                          <div className={`text-center rounded py-1 px-1 min-w-[40px] ${heatColor(pct)}`}>
                            {pct !== null && pct !== undefined ? `${pct}%` : '-'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mt-4">
            Each cell shows % of the cohort that made at least one booking in that calendar month.
          </p>
        </>
      )}

      {!loading && cohorts.length === 0 && !error && (
        <p className="text-[var(--color-text-muted)] text-sm">Not enough booking history to build cohorts yet.</p>
      )}
    </div>
  );
}
