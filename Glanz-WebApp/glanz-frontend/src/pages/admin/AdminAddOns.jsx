import { useState, useEffect } from 'react';
import { addOnsAPI } from '../../api/addons';
import { formatQAR } from '../../utils/currency';

const emptyForm = { name: '', description: '', price: '', durationIncreaseMinutes: 0, isActive: true, sortOrder: 0 };

export default function AdminAddOns() {
  const [addOns, setAddOns] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setAddOns(await addOnsAPI.getAll()); } catch { setError('Failed to load add-ons.'); }
    setLoading(false);
  }

  function startEdit(a) {
    setEditId(a.id);
    setForm({ name: a.name, description: a.description || '', price: a.price, durationIncreaseMinutes: a.durationIncreaseMinutes, isActive: a.isActive, sortOrder: a.sortOrder });
  }

  function cancelEdit() { setEditId(null); setForm(emptyForm); }

  async function save() {
    if (!form.name.trim() || !form.price) { setError('Name and price are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const dto = { ...form, price: parseFloat(form.price), durationIncreaseMinutes: parseInt(form.durationIncreaseMinutes) || 0, sortOrder: parseInt(form.sortOrder) || 0 };
      if (editId) await addOnsAPI.update(editId, dto);
      else await addOnsAPI.create(dto);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch (e) { setError(e?.response?.data?.message || 'Failed to save.'); }
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm('Delete this add-on?')) return;
    try { await addOnsAPI.delete(id); await load(); } catch { setError('Failed to delete.'); }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--heading-color)] mb-6">Service Add-Ons</h1>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Form */}
      <div className="rounded-xl border border-[var(--border-color)] p-5 mb-6">
        <h2 className="text-sm font-bold text-[var(--heading-color)] mb-4">{editId ? 'Edit Add-On' : 'New Add-On'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Name *</label>
            <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Engine Bay Clean" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Price (QAR) *</label>
            <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Duration Increase (min)</label>
            <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              type="number" min="0" step="5" value={form.durationIncreaseMinutes} onChange={e => set('durationIncreaseMinutes', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Sort Order</label>
            <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              type="number" min="0" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Description</label>
            <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="rounded" />
            <label htmlFor="isActive" className="text-sm text-[var(--text-color)]">Active</label>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={save} disabled={saving || !form.name || !form.price}
            className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
          </button>
          {editId && (
            <button onClick={cancelEdit}
              className="px-5 py-2 rounded-xl border border-[var(--border-color)] text-[var(--muted-color)] text-sm font-semibold hover:bg-white/5">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-[var(--muted-color)]">Loading...</div>
      ) : addOns.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted-color)]">No add-ons yet. Add one above.</div>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-white/[0.02]">
                <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Name</th>
                <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Price</th>
                <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Duration</th>
                <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {addOns.map(a => (
                <tr key={a.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="font-medium text-[var(--text-color)]">{a.name}</div>
                    {a.description && <div className="text-[11px] text-[var(--muted-color)]">{a.description}</div>}
                  </td>
                  <td className="p-3 font-semibold text-[var(--text-color)]">{formatQAR(a.price)}</td>
                  <td className="p-3 text-[var(--muted-color)]">{a.durationIncreaseMinutes > 0 ? `+${a.durationIncreaseMinutes} min` : '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-[var(--muted-color)]'}`}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => startEdit(a)} className="text-xs px-3 py-1 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5">Edit</button>
                      <button onClick={() => remove(a.id)} className="text-xs px-3 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
