import { useState, useEffect } from 'react';
import { certificationsAPI } from '../../api/certifications';
import { authAPI } from '../../api/auth';

const emptyForm = {
  workerId: '',
  name: '',
  issuingBody: '',
  issuedDate: '',
  expiryDate: '',
  certificateUrl: '',
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpiringSoon(expiryDate, days = 30) {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate) - new Date();
  return diff > 0 && diff < days * 86400000;
}

function isExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

export default function AdminCertifications() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [certs, setCerts] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('worker'); // 'worker' | 'expiring'

  useEffect(() => {
    authAPI.getWorkers().then(d => setWorkers(d || [])).catch(() => {});
    loadExpiring();
  }, []);

  useEffect(() => {
    if (selectedWorker) loadCerts(selectedWorker);
    else setCerts([]);
  }, [selectedWorker]);

  async function loadCerts(workerId) {
    setLoading(true);
    try { setCerts(await certificationsAPI.getByWorker(workerId)); } catch { setError('Failed to load certifications.'); }
    setLoading(false);
  }

  async function loadExpiring() {
    try { setExpiring(await certificationsAPI.getExpiring(30)); } catch {}
  }

  function startEdit(c) {
    setEditId(c.id);
    setForm({
      workerId: c.workerId,
      name: c.name,
      issuingBody: c.issuingBody || '',
      issuedDate: c.issuedDate ? c.issuedDate.slice(0, 10) : '',
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
      certificateUrl: c.certificateUrl || '',
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ ...emptyForm, workerId: selectedWorker });
  }

  async function save() {
    if (!form.name.trim()) { setError('Certification name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const dto = {
        workerId: parseInt(form.workerId || selectedWorker),
        name: form.name.trim(),
        issuingBody: form.issuingBody || null,
        issuedDate: form.issuedDate || null,
        expiryDate: form.expiryDate || null,
        certificateUrl: form.certificateUrl || null,
      };
      if (editId) await certificationsAPI.update(editId, dto);
      else await certificationsAPI.create(dto);
      setEditId(null);
      setForm({ ...emptyForm, workerId: selectedWorker });
      if (selectedWorker) await loadCerts(selectedWorker);
      await loadExpiring();
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save.');
    }
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm('Delete this certification?')) return;
    try {
      await certificationsAPI.delete(id);
      if (selectedWorker) await loadCerts(selectedWorker);
      await loadExpiring();
    } catch { setError('Failed to delete.'); }
  }

  const workerName = (id) => {
    const w = workers.find(w => w.id === parseInt(id));
    return w ? `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email : `Worker #${id}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--heading-color)] mb-6">Staff Certifications</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['worker', 'expiring'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-primary text-white' : 'bg-white/5 text-[var(--muted-color)] hover:bg-white/10'}`}>
            {t === 'worker' ? 'By Worker' : `Expiring Soon (${expiring.length})`}
          </button>
        ))}
      </div>

      {tab === 'expiring' && (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
          {expiring.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-color)]">No certifications expiring within 30 days.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-white/[0.02]">
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Worker</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Certification</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Issuing Body</th>
                  <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Expires</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map(c => (
                  <tr key={c.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02]">
                    <td className="p-3 font-medium text-[var(--text-color)]">{workerName(c.workerId)}</td>
                    <td className="p-3 text-[var(--text-color)]">{c.name}</td>
                    <td className="p-3 text-[var(--muted-color)]">{c.issuingBody || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isExpired(c.expiryDate) ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {formatDate(c.expiryDate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'worker' && (
        <div className="space-y-6">
          {/* Worker selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Select Worker</label>
            <select
              value={selectedWorker}
              onChange={e => { setSelectedWorker(e.target.value); cancelEdit(); }}
              className="w-full max-w-xs px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">-- Choose worker --</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {`${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email}
                </option>
              ))}
            </select>
          </div>

          {selectedWorker && (
            <>
              {/* Form */}
              <div className="rounded-xl border border-[var(--border-color)] p-5">
                <h2 className="text-sm font-bold text-[var(--heading-color)] mb-4">{editId ? 'Edit Certification' : 'Add Certification'}</h2>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'name', label: 'Certification Name *', type: 'text' },
                    { key: 'issuingBody', label: 'Issuing Body', type: 'text' },
                    { key: 'issuedDate', label: 'Issue Date', type: 'date' },
                    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
                    { key: 'certificateUrl', label: 'Certificate URL', type: 'url' },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'certificateUrl' ? 'sm:col-span-2' : ''}>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{f.label}</label>
                      <input
                        type={f.type}
                        value={form[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={save} disabled={saving}
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
              ) : certs.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted-color)]">No certifications yet for this worker.</div>
              ) : (
                <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-white/[0.02]">
                        <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Name</th>
                        <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Issuing Body</th>
                        <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Issued</th>
                        <th className="text-left p-3 text-[var(--muted-color)] font-semibold">Expires</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {certs.map(c => (
                        <tr key={c.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02]">
                          <td className="p-3 font-medium text-[var(--text-color)]">
                            {c.certificateUrl ? (
                              <a href={c.certificateUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.name}</a>
                            ) : c.name}
                          </td>
                          <td className="p-3 text-[var(--muted-color)]">{c.issuingBody || '-'}</td>
                          <td className="p-3 text-[var(--muted-color)]">{formatDate(c.issuedDate)}</td>
                          <td className="p-3">
                            {c.expiryDate ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isExpired(c.expiryDate) ? 'bg-red-500/20 text-red-400' : isExpiringSoon(c.expiryDate) ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                                {formatDate(c.expiryDate)}
                              </span>
                            ) : <span className="text-[var(--muted-color)]">-</span>}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => startEdit(c)} className="text-xs px-3 py-1 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5">Edit</button>
                              <button onClick={() => remove(c.id)} className="text-xs px-3 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
