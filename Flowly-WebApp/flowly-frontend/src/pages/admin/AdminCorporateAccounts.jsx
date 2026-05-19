import { useState, useEffect } from 'react';
import { corporateAccountsAPI } from '../../api/corporateAccounts';
import { authAPI } from '../../api/auth';
import { formatQAR } from '../../utils/currency';

const emptyForm = {
  companyName: '', billingEmail: '', billingPhone: '',
  notes: '', creditLimit: 0, discountPercent: 0, isActive: true,
};

export default function AdminCorporateAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // selected account detail
  const [detailTab, setDetailTab] = useState('bookings'); // 'bookings' | 'members'
  const [bookingsData, setBookingsData] = useState(null);
  const [members, setMembers] = useState([]);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setAccounts(await corporateAccountsAPI.getAll()); } catch { setError('Failed to load accounts.'); }
    setLoading(false);
  }

  async function openDetail(account) {
    const detail = await corporateAccountsAPI.get(account.id);
    setSelected(detail);
    setMembers(detail.members || []);
    loadBookings(account.id);
  }

  async function loadBookings(id, year, month) {
    setBookingsData(null);
    try {
      const data = await corporateAccountsAPI.getBookings(id, year || 0, month || 0);
      setBookingsData(data);
    } catch { setBookingsData({ bookings: [], total: 0, count: 0 }); }
  }

  function startEdit(a) {
    setEditId(a.id);
    setForm({
      companyName: a.companyName, billingEmail: a.billingEmail || '',
      billingPhone: a.billingPhone || '', notes: a.notes || '',
      creditLimit: a.creditLimit, discountPercent: a.discountPercent, isActive: a.isActive,
    });
  }

  function cancelEdit() { setEditId(null); setForm(emptyForm); }

  async function save() {
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError('');
    try {
      const dto = {
        ...form,
        creditLimit: parseFloat(form.creditLimit) || 0,
        discountPercent: parseFloat(form.discountPercent) || 0,
      };
      if (editId) await corporateAccountsAPI.update(editId, dto);
      else await corporateAccountsAPI.create(dto);
      setEditId(null); setForm(emptyForm);
      await load();
    } catch (e) { setError(e?.response?.data?.message || 'Failed to save.'); }
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm('Deactivate this account?')) return;
    try { await corporateAccountsAPI.delete(id); await load(); } catch { setError('Failed to delete.'); }
  }

  async function handleDownloadInvoice() {
    if (!selected) return;
    setInvoiceLoading(true);
    try {
      const res = await corporateAccountsAPI.downloadInvoice(selected.id, invoiceYear, invoiceMonth);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${selected.companyName}-${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Failed to generate invoice.'); }
    setInvoiceLoading(false);
  }

  async function searchUsers(q) {
    if (!q || q.length < 2) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    try {
      const users = await authAPI.getUsers?.({ q }) || [];
      setUserSearchResults(users.slice(0, 10));
    } catch { setUserSearchResults([]); }
    setUserSearchLoading(false);
  }

  async function addMember(userId) {
    if (!selected) return;
    try {
      await corporateAccountsAPI.addMember(selected.id, { userId });
      const detail = await corporateAccountsAPI.get(selected.id);
      setMembers(detail.members || []);
      setSelected(detail);
      setAddUserSearch('');
      setUserSearchResults([]);
    } catch (e) { setError(e?.response?.data?.message || 'Failed to add member.'); }
  }

  async function removeMember(memberId) {
    if (!selected) return;
    try {
      await corporateAccountsAPI.removeMember(selected.id, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { setError('Failed to remove member.'); }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--heading-color)] mb-6">Corporate / Fleet Accounts</h1>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="grid lg:grid-cols-5 gap-6">

        {/* Left: form + list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Form */}
          <div className="rounded-xl border border-[var(--border-color)] p-5">
            <h2 className="text-sm font-bold text-[var(--heading-color)] mb-4">
              {editId ? 'Edit Account' : 'New Account'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Company Name *</label>
                <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.companyName} onChange={e => set('companyName', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Billing Email</label>
                <input type="email" className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.billingEmail} onChange={e => set('billingEmail', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Billing Phone</label>
                <input className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.billingPhone} onChange={e => set('billingPhone', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Credit Limit (QAR)</label>
                  <input type="number" min="0" step="100" className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Discount %</label>
                  <input type="number" min="0" max="100" step="0.5" className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Notes</label>
                <textarea rows={2} className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                <label htmlFor="isActive" className="text-sm text-[var(--text-color)]">Active</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || !form.companyName}
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

          {/* Account list */}
          {loading ? (
            <div className="text-center py-8 text-[var(--muted-color)]">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-color)]">No accounts yet.</div>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id}
                  className={`rounded-xl border p-4 cursor-pointer transition ${selected?.id === a.id ? 'border-primary/50 bg-primary/5' : 'border-[var(--border-color)] hover:bg-white/[0.02]'}`}
                  onClick={() => openDetail(a)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-[var(--text-color)]">{a.companyName}</div>
                      {a.billingEmail && <div className="text-xs text-[var(--muted-color)]">{a.billingEmail}</div>}
                      <div className="flex gap-2 mt-1">
                        <span className="text-[11px] text-[var(--muted-color)]">{a.memberCount} members</span>
                        {a.discountPercent > 0 && (
                          <span className="text-[11px] text-green-400">{a.discountPercent}% off</span>
                        )}
                        {!a.isActive && (
                          <span className="text-[11px] text-red-400">Inactive</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); startEdit(a); }}
                        className="text-xs px-2 py-1 rounded border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5">
                        Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); remove(a.id); }}
                        className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="rounded-xl border border-[var(--border-color)] p-8 text-center text-[var(--muted-color)]">
              Select an account to view details.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
              {/* Detail header */}
              <div className="p-5 border-b border-[var(--border-color)]">
                <h2 className="text-lg font-bold text-[var(--heading-color)]">{selected.companyName}</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-[var(--muted-color)]">
                  {selected.billingEmail && <span>{selected.billingEmail}</span>}
                  {selected.billingPhone && <span>{selected.billingPhone}</span>}
                  {selected.creditLimit > 0 && (
                    <span>Credit: {formatQAR(selected.usedCredit)} / {formatQAR(selected.creditLimit)}</span>
                  )}
                  {selected.discountPercent > 0 && (
                    <span className="text-green-400">{selected.discountPercent}% discount</span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--border-color)]">
                {['bookings', 'members'].map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-5 py-3 text-sm font-semibold capitalize ${detailTab === tab ? 'text-primary border-b-2 border-primary' : 'text-[var(--muted-color)] hover:text-[var(--text-color)]'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Bookings tab */}
              {detailTab === 'bookings' && (
                <div className="p-5">
                  {/* Filter + invoice */}
                  <div className="flex flex-wrap gap-3 mb-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Year</label>
                      <input type="number" value={invoiceYear} min="2020" max="2030"
                        onChange={e => setInvoiceYear(parseInt(e.target.value) || 0)}
                        className="w-24 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Month</label>
                      <select value={invoiceMonth} onChange={e => setInvoiceMonth(parseInt(e.target.value))}
                        className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none">
                        <option value={0}>All months</option>
                        {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <button onClick={() => loadBookings(selected.id, invoiceYear, invoiceMonth)}
                      className="px-4 py-2 rounded-lg bg-white/10 text-[var(--text-color)] text-sm font-semibold hover:bg-white/15">
                      Load
                    </button>
                    <button onClick={handleDownloadInvoice} disabled={invoiceLoading}
                      className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30 text-sm font-semibold hover:bg-violet-500/30 disabled:opacity-50">
                      {invoiceLoading ? 'Generating...' : 'Download Invoice PDF'}
                    </button>
                  </div>

                  {!bookingsData ? (
                    <div className="text-center py-8 text-[var(--muted-color)]">Loading bookings...</div>
                  ) : bookingsData.bookings.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted-color)]">No bookings for this period.</div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-[var(--border-color)] overflow-hidden mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-color)] bg-white/[0.02]">
                              {['Booking #', 'Customer', 'Date', 'Status', 'Amount'].map(h => (
                                <th key={h} className="text-left p-3 text-[var(--muted-color)] font-semibold text-xs">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bookingsData.bookings.map(b => (
                              <tr key={b.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02]">
                                <td className="p-3 font-mono text-xs text-[var(--text-color)]">{b.bookingNumber}</td>
                                <td className="p-3 text-[var(--text-color)]">{b.customerName}</td>
                                <td className="p-3 text-[var(--muted-color)]">{new Date(b.scheduledDate).toLocaleDateString()}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    b.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                                    b.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                                    'bg-blue-500/20 text-blue-400'
                                  }`}>{b.status}</span>
                                </td>
                                <td className="p-3 font-semibold text-[var(--text-color)]">{formatQAR(b.totalAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end">
                        <div className="text-sm font-bold text-[var(--heading-color)]">
                          Total: {formatQAR(bookingsData.total)} ({bookingsData.count} bookings)
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Members tab */}
              {detailTab === 'members' && (
                <div className="p-5">
                  {/* Add member search */}
                  <div className="mb-4 relative">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Add Member by Name/Email</label>
                    <input
                      value={addUserSearch}
                      onChange={e => { setAddUserSearch(e.target.value); searchUsers(e.target.value); }}
                      placeholder="Search customer..."
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {userSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-xl overflow-hidden">
                        {userSearchResults.map(u => (
                          <button key={u.id} onClick={() => addMember(u.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center justify-between">
                            <div>
                              <div className="text-sm text-[var(--text-color)]">{u.firstName} {u.lastName}</div>
                              <div className="text-xs text-[var(--muted-color)]">{u.email}</div>
                            </div>
                            <span className="text-xs text-primary">+ Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {userSearchLoading && <p className="text-xs text-[var(--muted-color)] mt-1">Searching...</p>}
                  </div>

                  {members.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted-color)]">No members yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-color)]">
                          <div>
                            <div className="font-medium text-[var(--text-color)]">{m.userName || `User #${m.userId}`}</div>
                            <div className="text-xs text-[var(--muted-color)]">{m.userEmail}</div>
                          </div>
                          <button onClick={() => removeMember(m.id)}
                            className="text-xs px-3 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
