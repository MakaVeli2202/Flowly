import React, { useMemo, useState } from 'react';
import { Languages, RefreshCw, Save, Wand2 } from 'lucide-react';
import { translationsAPI } from '../../api/translations';

const EDITABLE_LANGS = [
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
];

export default function AdminTranslations() {
  const [entityType, setEntityType] = useState('packages');
  const [lang, setLang] = useState('ar');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState('');
  const [savedMap, setSavedMap] = useState({});

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const data = entityType === 'packages'
        ? await translationsAPI.listPackages(lang)
        : await translationsAPI.listServices(lang);
      setRows((data || []).map((r) => ({
        ...r,
        name: r.name || '',
        description: r.description || '',
      })));
      setSavedMap({});
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load translations');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadRows();
  }, [entityType, lang]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.sourceName || '').toLowerCase().includes(q)
      || (r.sourceDescription || '').toLowerCase().includes(q)
      || (r.name || '').toLowerCase().includes(q)
      || (r.description || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const patchRow = (id, key, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setSavedMap((prev) => ({ ...prev, [id]: false }));
  };

  const saveRow = async (row) => {
    if (!row.name.trim()) {
      setError('Translated name is required');
      return;
    }

    setSavingId(row.id);
    setError('');
    try {
      if (entityType === 'packages') {
        await translationsAPI.savePackage(row.id, lang, {
          name: row.name,
          description: row.description,
        });
      } else {
        await translationsAPI.saveService(row.id, lang, {
          name: row.name,
          description: row.description,
        });
      }
      setSavedMap((prev) => ({ ...prev, [row.id]: true }));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save translation');
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    setError('');
    try {
      for (const row of filteredRows) {
        if (!row.name.trim()) continue;
        if (entityType === 'packages') {
          await translationsAPI.savePackage(row.id, lang, {
            name: row.name,
            description: row.description,
          });
        } else {
          await translationsAPI.saveService(row.id, lang, {
            name: row.name,
            description: row.description,
          });
        }
      }
      setSavedMap(Object.fromEntries(filteredRows.map((r) => [r.id, true])));
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save all rows');
    } finally {
      setSavingAll(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setError('');
    try {
      await translationsAPI.backfill();
      await loadRows();
    } catch (e) {
      setError(e?.response?.data?.message || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto text-[var(--text-color)]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-bold uppercase tracking-[0.18em] mb-2">
            <Languages size={16} /> Translation Manager
          </div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)]">Database Translations</h1>
          <p className="text-sm text-[var(--muted-color)] mt-1">Edit service and package translations for Arabic and German.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfilling}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm hover:bg-white/5 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">{backfilling ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />} Backfill</span>
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={savingAll || loading}
            className="px-3 py-2 rounded-lg bg-primary text-[#0b0d12] text-sm font-semibold disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">{savingAll ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save All</span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <div className="md:col-span-1">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-color)] mb-1">Entity</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
          >
            <option value="packages">Packages</option>
            <option value="services">Services</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-color)] mb-1">Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
          >
            {EDITABLE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-color)] mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source or translated text"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>
      )}

      <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
        <div className="grid grid-cols-12 gap-0 px-3 py-2 bg-[var(--surface-bg-alt)] text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-color)]">
          <div className="col-span-3">Source</div>
          <div className="col-span-4">Source Description</div>
          <div className="col-span-2">Translated Name</div>
          <div className="col-span-2">Translated Description</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[var(--muted-color)]">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-sm text-[var(--muted-color)]">No rows found.</div>
        ) : (
          filteredRows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 px-3 py-3 border-t border-[var(--border-color)]">
              <div className="col-span-3 text-sm font-semibold text-[var(--heading-color)]">{row.sourceName}</div>
              <div className="col-span-4 text-xs text-[var(--muted-color)] line-clamp-3">{row.sourceDescription || '-'}</div>
              <div className="col-span-2">
                <input
                  value={row.name}
                  onChange={(e) => patchRow(row.id, 'name', e.target.value)}
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-bg)] px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2">
                <textarea
                  value={row.description}
                  onChange={(e) => patchRow(row.id, 'description', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-bg)] px-2 py-1.5 text-sm resize-y"
                />
              </div>
              <div className="col-span-1 flex items-start justify-end">
                <button
                  type="button"
                  onClick={() => saveRow(row)}
                  disabled={savingId === row.id}
                  className="px-2 py-1 rounded-md text-xs font-semibold border border-[var(--border-color)] hover:bg-white/5 disabled:opacity-50"
                >
                  {savingId === row.id ? '...' : savedMap[row.id] ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
