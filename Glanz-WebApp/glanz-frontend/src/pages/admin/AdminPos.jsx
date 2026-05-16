import React, { useEffect, useState, useRef } from 'react';
import { posAPI } from '../../api/pos';
import { packagesAPI } from '../../api/packages';
import { ShoppingCart, Search, User, Calendar, Clock, DollarSign, CheckCircle } from 'lucide-react';

const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];
const PAYMENT_METHODS = ['Cash', 'Card', 'QPay', 'Dibsy', 'Other'];
const formatCurrency = (v) => `QAR ${Number(v || 0).toFixed(2)}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

export default function AdminPos() {
  const [tab, setTab] = useState('walkIn'); // walkIn | summary
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', customerAddress: '',
    userId: null, packageId: '', vehicleType: 'Sedan',
    scheduledDate: new Date().toISOString().split('T')[0],
    timeSlot: '09:00-10:00', paymentMethod: 'Cash', amountOverride: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Customer lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupTimeout, setLookupTimeout] = useState(null);

  // Summary
  const [summary, setSummary] = useState(null);
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    packagesAPI.getAll().then(p => setPackages(p.filter(pkg => pkg.isActive)));
  }, []);

  useEffect(() => {
    if (tab === 'summary') loadSummary();
  }, [tab, summaryDate]); // eslint-disable-line

  const loadSummary = async () => {
    setSummary(await posAPI.getDailySummary(summaryDate ? new Date(summaryDate) : null));
  };

  const handleLookup = (q) => {
    setLookupQuery(q);
    if (lookupTimeout) clearTimeout(lookupTimeout);
    if (q.length < 2) { setLookupResults([]); return; }
    setLookupTimeout(setTimeout(async () => {
      try { setLookupResults(await posAPI.customerLookup(q)); } catch { setLookupResults([]); }
    }, 300));
  };

  const selectCustomer = (c) => {
    setForm(f => ({
      ...f,
      userId: c.id,
      customerName: `${c.firstName} ${c.lastName}`,
      customerEmail: c.email || '',
      customerPhone: c.phone || '',
    }));
    setLookupQuery('');
    setLookupResults([]);
  };

  const selectedPackage = packages.find(p => p.id === Number(form.packageId));
  const multiplier = { Motorcycle: 0.8, Sedan: 1.0, SUV: 1.25, Pickup: 1.5 }[form.vehicleType] || 1.0;
  const calculatedTotal = selectedPackage ? (selectedPackage.price * multiplier).toFixed(2) : '0.00';
  const displayTotal = form.amountOverride || calculatedTotal;

  const handleSubmit = async () => {
    if (!form.customerName || !form.packageId || !form.scheduledDate || !form.timeSlot) return;
    setSubmitting(true);
    try {
      const res = await posAPI.createWalkIn({
        userId: form.userId || null,
        customerName: form.customerName,
        customerEmail: form.customerEmail || null,
        customerPhone: form.customerPhone || null,
        customerAddress: form.customerAddress || null,
        packageId: Number(form.packageId),
        vehicleType: form.vehicleType,
        scheduledDate: new Date(form.scheduledDate).toISOString(),
        timeSlot: form.timeSlot,
        paymentMethod: form.paymentMethod,
        amountOverride: form.amountOverride ? Number(form.amountOverride) : null,
        notes: form.notes || null,
      });
      setResult(res);
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setForm({ customerName: '', customerEmail: '', customerPhone: '', customerAddress: '', userId: null, packageId: '', vehicleType: 'Sedan', scheduledDate: new Date().toISOString().split('T')[0], timeSlot: '09:00-10:00', paymentMethod: 'Cash', amountOverride: '', notes: '' });
    setResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingCart size={24} style={{ color: 'var(--cta-color)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>POS - Walk-In</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {[{ id: 'walkIn', label: 'New Walk-In' }, { id: 'summary', label: 'Daily Summary' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-[var(--cta-color)]' : 'border-transparent'}`}
            style={{ color: tab === t.id ? 'var(--cta-color)' : 'var(--muted-color)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'walkIn' && (
        result ? (
          /* Success screen */
          <div className="flex flex-col items-center gap-4 py-12">
            <CheckCircle size={56} style={{ color: '#22c55e' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--heading-color)' }}>Booking Created</h2>
            <div className="text-center space-y-1">
              <p className="text-sm font-mono" style={{ color: 'var(--cta-color)' }}>{result.bookingNumber}</p>
              <p className="text-lg font-bold" style={{ color: 'var(--heading-color)' }}>{formatCurrency(result.totalAmount)}</p>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>Payment: {result.paymentMethod} - {result.paymentStatus}</p>
            </div>
            <button onClick={resetForm} className="px-6 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--cta-color)' }}>
              New Walk-In
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Customer + Service */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>Customer</p>
                {/* Lookup */}
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                    <Search size={15} style={{ color: 'var(--muted-color)' }} />
                    <input value={lookupQuery} onChange={e => handleLookup(e.target.value)}
                      placeholder="Search existing customer..."
                      className="flex-1 text-sm bg-transparent outline-none" style={{ color: 'var(--text-color)' }} />
                  </div>
                  {lookupResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 rounded-lg mt-1 shadow-lg overflow-hidden" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
                      {lookupResults.map(c => (
                        <button key={c.id} onClick={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--card-bg)] flex items-center gap-2">
                          <User size={13} style={{ color: 'var(--muted-color)' }} />
                          <span style={{ color: 'var(--text-color)' }}>{c.firstName} {c.lastName}</span>
                          <span className="text-xs" style={{ color: 'var(--muted-color)' }}>{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {[
                  { key: 'customerName', label: 'Name *', type: 'text', placeholder: 'John Doe' },
                  { key: 'customerEmail', label: 'Email', type: 'email', placeholder: 'john@email.com' },
                  { key: 'customerPhone', label: 'Phone', type: 'tel', placeholder: '+974 ...' },
                  { key: 'customerAddress', label: 'Address', type: 'text', placeholder: 'Street / Bay' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(sf => ({ ...sf, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>Service</p>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Package *</label>
                  <select value={form.packageId} onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                    <option value="">Select package</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name} - QAR {p.price}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Vehicle Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {VEHICLE_TYPES.map(v => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, vehicleType: v }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${form.vehicleType === v ? 'border-transparent text-white' : 'border-[var(--border-color)]'}`}
                        style={form.vehicleType === v ? { background: 'var(--cta-color)' } : { color: 'var(--text-color)' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Schedule + Payment */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>Schedule</p>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Date *</label>
                  <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Time Slot *</label>
                  <input type="text" value={form.timeSlot} onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}
                    placeholder="09:00-10:00"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any special instructions..."
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                </div>
              </div>

              <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>Payment</p>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Method</label>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${form.paymentMethod === m ? 'border-transparent text-white' : 'border-[var(--border-color)]'}`}
                        style={form.paymentMethod === m ? { background: 'var(--cta-color)' } : { color: 'var(--text-color)' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Amount Override (optional)</label>
                  <input type="number" min="0" step="0.01" value={form.amountOverride} onChange={e => setForm(f => ({ ...f, amountOverride: e.target.value }))}
                    placeholder={`Calculated: QAR ${calculatedTotal}`}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>Total</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--heading-color)' }}>{formatCurrency(displayTotal)}</span>
                </div>

                <button onClick={handleSubmit}
                  disabled={submitting || !form.customerName || !form.packageId || !form.scheduledDate}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: 'var(--cta-color)' }}>
                  {submitting ? 'Processing...' : `Confirm & Collect ${formatCurrency(displayTotal)}`}
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="date" value={summaryDate} onChange={e => setSummaryDate(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
            <button onClick={loadSummary} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--cta-color)' }}>Refresh</button>
          </div>
          {summary && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Walk-Ins', value: summary.walkInCount, icon: User },
                  { label: 'Revenue', value: formatCurrency(summary.totalRevenue), icon: DollarSign },
                  { label: 'Paid', value: summary.paidCount, icon: CheckCircle },
                ].map(card => (
                  <div key={card.label} className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <card.icon size={16} style={{ color: 'var(--cta-color)' }} />
                      <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{card.label}</p>
                    </div>
                    <p className="text-xl font-bold" style={{ color: 'var(--heading-color)' }}>{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-bg)', color: 'var(--muted-color)' }}>
                      <th className="text-left py-3 px-4">Booking #</th>
                      <th className="text-left py-3 px-4">Customer</th>
                      <th className="text-left py-3 px-4">Time</th>
                      <th className="text-right py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.bookings.map(b => (
                      <tr key={b.id} className="border-t" style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                        <td className="py-3 px-4 font-mono text-xs">{b.bookingNumber}</td>
                        <td className="py-3 px-4">{b.customerName}</td>
                        <td className="py-3 px-4">{b.timeSlot}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(b.totalAmount)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: b.paymentStatus === 'Paid' ? '#22c55e20' : '#f59e0b20', color: b.paymentStatus === 'Paid' ? '#22c55e' : '#f59e0b' }}>
                            {b.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
