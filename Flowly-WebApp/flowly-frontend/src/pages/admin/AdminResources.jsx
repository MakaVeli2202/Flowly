import React, { useEffect, useState } from 'react';
import { resourcesAPI } from '../../api/resources';
import { Layers, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

const TYPE_COLORS = { Room: '#8b5cf6', Equipment: '#f59e0b', Vehicle: '#3b82f6' };
const TYPES = ['Room', 'Equipment', 'Vehicle'];

export default function AdminResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'Room', capacity: 1 });
  const [saving, setSaving] = useState(false);

  // Availability checker
  const [availDate, setAvailDate] = useState('');
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('10:00');
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);

  useEffect(() => { loadResources(); }, []);

  const loadResources = async () => {
    setLoading(true);
    try { setResources(await resourcesAPI.getAll()); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingId(null); setForm({ name: '', type: 'Room', capacity: 1 }); setShowForm(true); };
  const openEdit = (r) => { setEditingId(r.id); setForm({ name: r.name, type: r.type, capacity: r.capacity }); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await resourcesAPI.update(editingId, form);
      } else {
        await resourcesAPI.create(form);
      }
      setShowForm(false);
      loadResources();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await resourcesAPI.delete(id);
    loadResources();
  };

  const checkAvailability = async () => {
    if (!availDate) return;
    setCheckingAvail(true);
    try {
      const startAt = new Date(`${availDate}T${availStart}:00`);
      const endAt = new Date(`${availDate}T${availEnd}:00`);
      setAvailability(await resourcesAPI.getAvailability(startAt, endAt));
    } finally { setCheckingAvail(false); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={24} style={{ color: 'var(--cta-color)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>Resources</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--cta-color)' }}
        >
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {/* Availability Checker */}
      <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>Check Availability</p>
        <div className="flex gap-3 flex-wrap">
          <input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
          <input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
          <input type="time" value={availEnd} onChange={e => setAvailEnd(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
          <button onClick={checkAvailability} disabled={checkingAvail || !availDate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--cta-color)' }}>
            {checkingAvail ? 'Checking...' : 'Check'}
          </button>
        </div>
        {availability && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
            {availability.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-bg)' }}>
                {r.available
                  ? <CheckCircle size={15} style={{ color: '#22c55e' }} />
                  : <XCircle size={15} style={{ color: '#ef4444' }} />}
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-color)' }}>{r.name}</p>
                  {!r.available && <p className="text-xs" style={{ color: '#ef4444' }}>{r.conflictingBooking}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resources list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p style={{ color: 'var(--muted-color)' }}>Loading...</p>}
        {!loading && resources.length === 0 && <p style={{ color: 'var(--muted-color)' }}>No resources yet.</p>}
        {resources.map(r => (
          <div key={r.id} className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-1" style={{ background: (TYPE_COLORS[r.type] || '#6b7280') + '20', color: TYPE_COLORS[r.type] || '#6b7280' }}>
                  {r.type}
                </span>
                <p className="font-semibold text-sm" style={{ color: 'var(--heading-color)' }}>{r.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-color)' }}>Capacity: {r.capacity}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-[var(--surface-bg)]" style={{ color: 'var(--muted-color)' }}><Edit size={14} /></button>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-[var(--surface-bg)]" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--heading-color)' }}>{editingId ? 'Edit Resource' : 'Add Resource'}</h3>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bay 1, Pressure Washer"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--cta-color)' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
