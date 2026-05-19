import React, { useEffect, useState } from 'react';
import { purchaseOrdersAPI } from '../../api/purchaseOrders';
import { productsAPI } from '../../api/products';
import {
  Package, Plus, Truck, ChevronDown, ChevronUp, Edit, Trash2,
  CheckCircle, XCircle, Send, Clock
} from 'lucide-react';

const STATUS_COLORS = {
  Draft: 'var(--muted-color)',
  Sent: '#3b82f6',
  Received: '#22c55e',
  Cancelled: '#ef4444',
};

const STATUS_ORDER = ['Draft', 'Sent', 'Received', 'Cancelled'];

const formatCurrency = (v) => `QAR ${Number(v || 0).toFixed(2)}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '-';

export default function AdminPurchaseOrders() {
  const [tab, setTab] = useState('orders'); // orders | suppliers
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  // New Order form
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ supplierId: '', expectedDelivery: '', notes: '', items: [] });
  const [orderSaving, setOrderSaving] = useState(false);

  // New Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '', address: '', contactPerson: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  useEffect(() => { loadData(); }, [tab, statusFilter]); // eslint-disable-line

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'orders') {
        const [o, s] = await Promise.all([
          purchaseOrdersAPI.getOrders(statusFilter || undefined),
          purchaseOrdersAPI.getSuppliers(),
        ]);
        setOrders(o);
        setSuppliers(s);
      } else {
        setSuppliers(await purchaseOrdersAPI.getSuppliers());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderForm.supplierId || orderForm.items.length === 0) return;
    setOrderSaving(true);
    try {
      await purchaseOrdersAPI.createOrder({
        supplierId: Number(orderForm.supplierId),
        expectedDelivery: orderForm.expectedDelivery || null,
        notes: orderForm.notes || null,
        items: orderForm.items.map(i => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          productId: i.productId ? Number(i.productId) : null,
        })),
      });
      setShowOrderForm(false);
      setOrderForm({ supplierId: '', expectedDelivery: '', notes: '', items: [] });
      loadData();
    } finally {
      setOrderSaving(false);
    }
  };

  const handleStatusChange = async (orderId, status) => {
    await purchaseOrdersAPI.updateStatus(orderId, status);
    loadData();
  };

  const handleSaveSupplier = async () => {
    setSupplierSaving(true);
    try {
      if (editingSupplier) {
        await purchaseOrdersAPI.updateSupplier(editingSupplier.id, supplierForm);
      } else {
        await purchaseOrdersAPI.createSupplier(supplierForm);
      }
      setShowSupplierForm(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', email: '', phone: '', address: '', contactPerson: '' });
      loadData();
    } finally {
      setSupplierSaving(false);
    }
  };

  const openEditSupplier = (s) => {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '', contactPerson: s.contactPerson || '' });
    setShowSupplierForm(true);
  };

  const addOrderItem = () =>
    setOrderForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unitCost: 0, productId: '' }] }));

  const updateOrderItem = (idx, field, value) =>
    setOrderForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item) }));

  const removeOrderItem = (idx) =>
    setOrderForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const orderTotal = orderForm.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitCost)), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package size={24} style={{ color: 'var(--cta-color)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>Purchase Orders</h1>
        </div>
        <button
          onClick={() => tab === 'orders' ? setShowOrderForm(true) : setShowSupplierForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--cta-color)' }}
        >
          <Plus size={16} />
          {tab === 'orders' ? 'New Order' : 'New Supplier'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {['orders', 'suppliers'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? 'border-[var(--cta-color)]' : 'border-transparent'}`}
            style={{ color: tab === t ? 'var(--cta-color)' : 'var(--muted-color)' }}
          >
            {t === 'orders' ? 'Purchase Orders' : 'Suppliers'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {['', ...STATUS_ORDER].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? 'border-transparent text-white' : 'border-[var(--border-color)]'}`}
                style={statusFilter === s ? { background: STATUS_COLORS[s] || 'var(--cta-color)', color: 'white' } : { color: 'var(--text-color)' }}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Orders list */}
          <div className="space-y-3">
            {loading && <p style={{ color: 'var(--muted-color)' }}>Loading...</p>}
            {!loading && orders.length === 0 && <p style={{ color: 'var(--muted-color)' }}>No purchase orders found.</p>}
            {orders.map(po => (
              <div key={po.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--surface-bg)]"
                  onClick={() => setExpandedOrder(expandedOrder === po.id ? null : po.id)}
                >
                  <div className="flex items-center gap-4">
                    <Truck size={18} style={{ color: STATUS_COLORS[po.status] }} />
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--heading-color)' }}>{po.orderNumber}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{po.supplier?.name || 'No supplier'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_COLORS[po.status] + '20', color: STATUS_COLORS[po.status] }}>
                      {po.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold" style={{ color: 'var(--heading-color)' }}>{formatCurrency(po.totalAmount)}</span>
                    <span className="text-xs" style={{ color: 'var(--muted-color)' }}>{formatDate(po.createdAt)}</span>
                    {expandedOrder === po.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expandedOrder === po.id && (
                  <div className="border-t p-4 space-y-4" style={{ borderColor: 'var(--border-color)' }}>
                    {po.notes && <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{po.notes}</p>}
                    <div className="grid grid-cols-3 gap-3 text-xs" style={{ color: 'var(--muted-color)' }}>
                      <div><span className="font-medium">Ordered:</span> {formatDate(po.orderedAt)}</div>
                      <div><span className="font-medium">Expected:</span> {formatDate(po.expectedDelivery)}</div>
                      <div><span className="font-medium">Received:</span> {formatDate(po.receivedAt)}</div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: 'var(--muted-color)' }}>
                          <th className="text-left py-1">Item</th>
                          <th className="text-right py-1">Qty</th>
                          <th className="text-right py-1">Unit Cost</th>
                          <th className="text-right py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(po.items || []).map(i => (
                          <tr key={i.id} style={{ color: 'var(--text-color)' }}>
                            <td className="py-1">{i.description}</td>
                            <td className="text-right py-1">{i.quantity}</td>
                            <td className="text-right py-1">{formatCurrency(i.unitCost)}</td>
                            <td className="text-right py-1">{formatCurrency(i.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Status actions */}
                    <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      {po.status === 'Draft' && (
                        <button onClick={() => handleStatusChange(po.id, 'Sent')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: '#3b82f6' }}>
                          <Send size={13} /> Mark Sent
                        </button>
                      )}
                      {po.status === 'Sent' && (
                        <button onClick={() => handleStatusChange(po.id, 'Received')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: '#22c55e' }}>
                          <CheckCircle size={13} /> Mark Received
                        </button>
                      )}
                      {(po.status === 'Draft' || po.status === 'Sent') && (
                        <button onClick={() => handleStatusChange(po.id, 'Cancelled')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: '#ef4444' }}>
                          <XCircle size={13} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'suppliers' && (
        <div className="space-y-3">
          {loading && <p style={{ color: 'var(--muted-color)' }}>Loading...</p>}
          {!loading && suppliers.length === 0 && <p style={{ color: 'var(--muted-color)' }}>No suppliers yet.</p>}
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--heading-color)' }}>{s.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
                  {[s.contactPerson, s.email, s.phone].filter(Boolean).join(' - ')}
                </p>
              </div>
              <button
                onClick={() => openEditSupplier(s)}
                className="p-2 rounded-lg hover:bg-[var(--surface-bg)]"
                style={{ color: 'var(--muted-color)' }}
              >
                <Edit size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Order Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl my-8 rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--heading-color)' }}>New Purchase Order</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Supplier *</label>
                <select value={orderForm.supplierId} onChange={e => setOrderForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Expected Delivery</label>
                <input type="date" value={orderForm.expectedDelivery} onChange={e => setOrderForm(f => ({ ...f, expectedDelivery: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>Notes</label>
              <input type="text" value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-color)' }}>Items *</label>
                <button onClick={addOrderItem} className="text-xs font-medium" style={{ color: 'var(--cta-color)' }}>+ Add Item</button>
              </div>
              <div className="space-y-2">
                {orderForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input placeholder="Description" value={item.description} onChange={e => updateOrderItem(idx, 'description', e.target.value)}
                      className="col-span-5 px-2 py-1.5 rounded-lg border text-sm"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                    <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={e => updateOrderItem(idx, 'quantity', e.target.value)}
                      className="col-span-2 px-2 py-1.5 rounded-lg border text-sm"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                    <input type="number" placeholder="Unit Cost" min="0" step="0.01" value={item.unitCost} onChange={e => updateOrderItem(idx, 'unitCost', e.target.value)}
                      className="col-span-3 px-2 py-1.5 rounded-lg border text-sm"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                    <button onClick={() => removeOrderItem(idx)} className="col-span-2 flex justify-center" style={{ color: '#ef4444' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              {orderForm.items.length > 0 && (
                <p className="text-right text-sm font-semibold mt-2" style={{ color: 'var(--heading-color)' }}>
                  Total: {formatCurrency(orderTotal)}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowOrderForm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>Cancel</button>
              <button onClick={handleCreateOrder} disabled={orderSaving || !orderForm.supplierId || orderForm.items.length === 0}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--cta-color)' }}>
                {orderSaving ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--heading-color)' }}>{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h3>
            {[
              { key: 'name', label: 'Name *', placeholder: 'Supplier name' },
              { key: 'contactPerson', label: 'Contact Person', placeholder: 'John Doe' },
              { key: 'email', label: 'Email', placeholder: 'supplier@email.com' },
              { key: 'phone', label: 'Phone', placeholder: '+974 ...' },
              { key: 'address', label: 'Address', placeholder: 'Street, City' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{f.label}</label>
                <input
                  value={supplierForm[f.key]} onChange={e => setSupplierForm(sf => ({ ...sf, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowSupplierForm(false); setEditingSupplier(null); }} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>Cancel</button>
              <button onClick={handleSaveSupplier} disabled={supplierSaving || !supplierForm.name}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--cta-color)' }}>
                {supplierSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
