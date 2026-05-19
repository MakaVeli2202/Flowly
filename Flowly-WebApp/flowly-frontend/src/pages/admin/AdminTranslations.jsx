import React, { useMemo, useState, useCallback } from 'react';
import { Languages, RefreshCw, Save, Wand2, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { translationsAPI } from '../../api/translations';

const LANGS = [
  { code: 'ar', label: 'Arabic', dir: 'rtl' },
  { code: 'de', label: 'German', dir: 'ltr' },
];

function isUntranslated(row) {
  return !row.ar.name.trim() || !row.de.name.trim();
}

function exportCSV(rows, entityType) {
  const headers = ['ID', 'Source Name', 'Source Description', 'Arabic Name', 'Arabic Description', 'German Name', 'German Description'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => [r.id, r.sourceName, r.sourceDescription, r.ar.name, r.ar.description, r.de.name, r.de.description].map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translations-${entityType}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTranslations() {
  const [entityType, setEntityType] = useState('packages');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [filterUntranslated, setFilterUntranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState('');
  const [savedMap, setSavedMap] = useState({});

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listFn = entityType === 'packages' ? translationsAPI.listPackages : translationsAPI.listServices;
      const [arData, deData] = await Promise.all([listFn('ar'), listFn('de')]);

      const arMap = Object.fromEntries((arData || []).map(r => [r.id, r]));
      const deMap = Object.fromEntries((deData || []).map(r => [r.id, r]));
      const ids = [...new Set([...(arData || []).map(r => r.id), ...(deData || []).map(r => r.id)])];

      setRows(ids.map(id => ({
        id,
        sourceName: arMap[id]?.sourceName || deMap[id]?.sourceName || '',
        sourceDescription: arMap[id]?.sourceDescription || deMap[id]?.sourceDescription || '',
        ar: { name: arMap[id]?.name || '', description: arMap[id]?.description || '' },
        de: { name: deMap[id]?.name || '', description: deMap[id]?.description || '' },
      })));
      setSavedMap({});
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load translations');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  React.useEffect(() => { loadRows(); }, [loadRows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterUntranslated) result = result.filter(isUntranslated);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(r =>
      r.sourceName.toLowerCase().includes(q) ||
      r.ar.name.toLowerCase().includes(q) ||
      r.de.name.toLowerCase().includes(q)
    );
    return result;
  }, [rows, search, filterUntranslated]);

  const patchRow = (id, lang, key, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [lang]: { ...r[lang], [key]: value } } : r));
    setSavedMap(prev => ({ ...prev, [id]: false }));
  };

  const saveRowFn = async (entityType, id, lang, payload) => {
    if (entityType === 'packages') return translationsAPI.savePackage(id, lang, payload);
    return translationsAPI.saveService(id, lang, payload);
  };

  const saveRow = async (row) => {
    if (!row.ar.name.trim() && !row.de.name.trim()) {
      setError('At least one translated name is required to save');
      return;
    }
    setSavingId(row.id);
    setError('');
    try {
      await Promise.all(
        LANGS.map(l => row[l.code].name.trim()
          ? saveRowFn(entityType, row.id, l.code, { name: row[l.code].name, description: row[l.code].description })
          : Promise.resolve()
        )
      );
      setSavedMap(prev => ({ ...prev, [row.id]: true }));
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
        for (const l of LANGS) {
          if (row[l.code].name.trim()) {
            await saveRowFn(entityType, row.id, l.code, { name: row[l.code].name, description: row[l.code].description });
          }
        }
      }
      setSavedMap(Object.fromEntries(filteredRows.map(r => [r.id, true])));
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

  const untranslatedCount = rows.filter(isUntranslated).length;

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto text-[var(--text-color)]">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm font-bold uppercase tracking-[0.18em] mb-2">
            <Languages size={16} /> Translation Manager
          </div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)]">Database Translations</h1>
          <p className="text-sm text-[var(--muted-color)] mt-1">
            Manage English source, Arabic and German translations side-by-side.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportCSV(filteredRows, entityType)}
            disabled={loading || filteredRows.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm hover:bg-white/5 disabled:opacity-50 transition"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm hover:bg-white/5 disabled:opacity-50 transition"
          >
            {backfilling ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />} Backfill
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={savingAll || loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-[#0b0d12] text-sm font-semibold disabled:opacity-50 transition"
          >
            {savingAll ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-color)] mb-1">Entity</label>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
          >
            <option value="packages">Packages</option>
            <option value="services">Services</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-color)] mb-1">Search</label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search source or translated text…"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() => setFilterUntranslated(v => !v)}
            className={`h-[38px] inline-flex items-center justify-center gap-2 px-3 rounded-lg border text-sm font-semibold transition ${
              filterUntranslated
                ? 'border-amber-500/50 bg-amber-500/12 text-amber-400'
                : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-amber-500/40'
            }`}
          >
            <AlertCircle size={14} />
            Untranslated ({untranslatedCount})
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>
      )}

      {/* Stats bar */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-xs text-[var(--muted-color)]">
          <span><strong className="text-[var(--text-color)]">{rows.length}</strong> items</span>
          {untranslatedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertCircle size={12} />
              <strong>{untranslatedCount}</strong> untranslated
            </span>
          )}
          {untranslatedCount === 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 size={12} /> All translated
            </span>
          )}
        </div>
      )}

      {/* Table header */}
      <div className="hidden md:grid grid-cols-12 gap-0 px-4 py-2 rounded-t-xl border border-[var(--border-color)] bg-[var(--surface-bg-alt)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-color)]">
        <div className="col-span-3">English (Source)</div>
        <div className="col-span-4">Arabic</div>
        <div className="col-span-4">German</div>
        <div className="col-span-1 text-right">Save</div>
      </div>

      {/* Rows */}
      <div className="rounded-b-xl md:rounded-t-none rounded-xl md:border-t-0 border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-color)]">
        {loading ? (
          <div className="p-8 text-sm text-center text-[var(--muted-color)]">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2 opacity-50" />
            Loading translations…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-sm text-center text-[var(--muted-color)]">
            {filterUntranslated ? 'All items are translated.' : 'No items found.'}
          </div>
        ) : (
          filteredRows.map(row => {
            const untranslated = isUntranslated(row);
            const saved = savedMap[row.id];
            const saving = savingId === row.id;
            return (
              <div
                key={row.id}
                className={`md:grid md:grid-cols-12 gap-0 px-4 py-4 transition ${
                  untranslated ? 'bg-amber-500/4' : ''
                }`}
              >
                {/* English source */}
                <div className="md:col-span-3 md:pr-4 mb-4 md:mb-0">
                  <div className="flex items-start gap-2 mb-1">
                    {untranslated && (
                      <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                    )}
                    <p className="text-sm font-semibold text-[var(--heading-color)] leading-snug">{row.sourceName}</p>
                  </div>
                  {row.sourceDescription && (
                    <p className="text-xs text-[var(--muted-color)] leading-relaxed line-clamp-3 pl-3.5">{row.sourceDescription}</p>
                  )}
                </div>

                {/* Arabic */}
                <div className="md:col-span-4 md:pr-3 mb-4 md:mb-0 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] md:hidden">Arabic</p>
                  <input
                    value={row.ar.name}
                    onChange={e => patchRow(row.id, 'ar', 'name', e.target.value)}
                    placeholder="Arabic name…"
                    dir="rtl"
                    className={`w-full rounded-md border px-2 py-1.5 text-sm bg-[var(--surface-bg)] text-right ${
                      !row.ar.name.trim()
                        ? 'border-amber-500/40 placeholder:text-amber-500/50'
                        : 'border-[var(--border-color)]'
                    }`}
                  />
                  <textarea
                    value={row.ar.description}
                    onChange={e => patchRow(row.id, 'ar', 'description', e.target.value)}
                    placeholder="Arabic description… (optional)"
                    dir="rtl"
                    rows={2}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-bg)] px-2 py-1.5 text-sm resize-y text-right"
                  />
                </div>

                {/* German */}
                <div className="md:col-span-4 md:pr-3 mb-4 md:mb-0 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] md:hidden">German</p>
                  <input
                    value={row.de.name}
                    onChange={e => patchRow(row.id, 'de', 'name', e.target.value)}
                    placeholder="German name…"
                    className={`w-full rounded-md border px-2 py-1.5 text-sm bg-[var(--surface-bg)] ${
                      !row.de.name.trim()
                        ? 'border-amber-500/40 placeholder:text-amber-500/50'
                        : 'border-[var(--border-color)]'
                    }`}
                  />
                  <textarea
                    value={row.de.description}
                    onChange={e => patchRow(row.id, 'de', 'description', e.target.value)}
                    placeholder="German description… (optional)"
                    rows={2}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-bg)] px-2 py-1.5 text-sm resize-y"
                  />
                </div>

                {/* Save */}
                <div className="md:col-span-1 flex md:flex-col items-center md:items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => saveRow(row)}
                    disabled={saving}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
                      saved
                        ? 'border-green-500/35 bg-green-500/10 text-green-400'
                        : 'border-[var(--border-color)] hover:border-primary/40 hover:text-primary text-[var(--muted-color)]'
                    }`}
                  >
                    {saving
                      ? <RefreshCw size={12} className="animate-spin" />
                      : saved
                        ? <><CheckCircle2 size={12} /> Saved</>
                        : <><Save size={12} /> Save</>}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
