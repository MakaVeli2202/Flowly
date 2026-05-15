// ManageProducts.jsx
import React, { useState, useEffect, useRef } from 'react';
import { productsAPI } from '../../api/products';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, X, Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';
import AppModal from '../../components/shared/AppModal';


function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 480, height: 480, top: '-240px', left: '-240px' }} />;
}

function FormField({ label, children }) {
  return <div><label className="field-label">{label}</label>{children}</div>;
}

/* Pure display helper — no logic */
const stockPill = (qty) => {
  if (qty > 100) return { color: '#22c55e', border: 'rgba(34,197,94,0.28)',   bg: 'rgba(34,197,94,0.08)'   };
  if (qty > 20)  return { color: '#f59e0b', border: 'rgba(245,158,11,0.28)',  bg: 'rgba(245,158,11,0.08)'  };
  return               { color: '#ef4444', border: 'rgba(239,68,68,0.28)',    bg: 'rgba(239,68,68,0.08)'   };
};

function ManageProducts() {
  const { t } = useLanguage();
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });

  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open: true, title, message, variant, onConfirm });
  const closeModal = () => setModal((m) => ({ ...m, open: false, onConfirm: null }));

  const [formData, setFormData] = useState({
    name: '', description: '', vendor: '', costPerUnit: '', unit: 'ml', stockQuantity: '',
  });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productsAPI.getAll();
      setProducts(data);
    } catch { setError('Failed to load products'); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const productData = {
        ...formData,
        costPerUnit:   parseFloat(formData.costPerUnit),
        stockQuantity: parseInt(formData.stockQuantity),
      };
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, productData);
        setSuccess('Product updated successfully');
      } else {
        await productsAPI.create(productData);
        setSuccess('Product created successfully');
      }
      resetForm(); fetchProducts();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save product'); }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name, description: product.description || '',
      vendor: product.vendor, costPerUnit: product.costPerUnit.toString(),
      unit: product.unit, stockQuantity: product.stockQuantity.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    showConfirm('Delete Product', `Are you sure you want to delete "${name}"? This cannot be undone.`, 'danger',
      async () => {
        closeModal();
        try { await productsAPI.delete(id); setSuccess('Product deleted successfully'); fetchProducts(); }
        catch { setError('Failed to delete product'); }
      }
    );
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', vendor: '', costPerUnit: '', unit: 'ml', stockQuantity: '' });
    setEditingProduct(null); setShowForm(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading products…</p>
    </div>
  );

  const formAccent = editingProduct ? '#0ea5a0' : '#c8a96b';
  const inp = 'field-input';

  return (
    <>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 7% 6%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 93% 92%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Header ───────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                  <Package size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Manage Products</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Chemical inventory and supplies</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button" onClick={() => setShowForm((p) => !p)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? 'Close Form' : 'Add Product'}
              </button>
            </div>
          </div>

          {/* ── Alerts ───────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300"><X size={14} /></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-4">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm font-semibold">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300"><X size={14} /></button>
            </div>
          )}

          {/* ── Low-stock alert banner ───────────────── */}
          {(() => {
            const lowStockItems = products.filter(p => p.isActive && p.stockQuantity <= 20);
            if (lowStockItems.length === 0) return null;
            return (
              <div className="flex items-start gap-3 rounded-xl border px-5 py-4"
                style={{ background:'rgba(239,68,68,.07)', borderColor:'rgba(239,68,68,.28)' }}>
                <AlertCircle size={16} style={{ color:'#f87171', flexShrink:0, marginTop:2 }} />
                <div>
                  <p className="text-sm font-bold" style={{ color:'#f87171' }}>
                    {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} running low
                  </p>
                  <p className="text-xs text-[var(--muted-color)] mt-0.5">
                    {lowStockItems.map(p => `${p.name} (${p.stockQuantity} ${p.unit})`).join(' · ')}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* ── Form ─────────────────────────────────── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: `linear-gradient(180deg, ${formAccent} 0%, ${formAccent}44 60%, transparent 100%)` }} />
              <div className="prism-ray" style={{ left: '70%', width: '12%', animation: 'prism-ray-sweep 18s ease-in-out 3s infinite' }} />

              <div className="p-7">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, transparent, ${formAccent})` }} />
                      <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em]" style={{ color: formAccent }}>
                        {editingProduct ? 'Edit Mode' : 'New Product'}
                      </p>
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, ${formAccent}, transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editingProduct ? `Editing: ${editingProduct.name}` : 'Create Product'}
                    </h2>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 transition">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-5"><div className="spectrum-line" /></div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <FormField label="Product Name *">
                      <input type="text" name="name" required value={formData.name} onChange={handleChange}
                        className={inp} placeholder="e.g. Premium Car Shampoo" />
                    </FormField>
                    <FormField label="Vendor *">
                      <input type="text" name="vendor" required value={formData.vendor} onChange={handleChange}
                        className={inp} placeholder="e.g. Meguiar's" />
                    </FormField>
                    <FormField label="Cost Per Unit (QAR) *">
                      <input type="number" step="0.01" name="costPerUnit" required value={formData.costPerUnit} onChange={handleChange}
                        className={inp} placeholder="0.00" />
                    </FormField>
                    <FormField label="Unit *">
                      <select name="unit" required value={formData.unit} onChange={handleChange} className={inp}>
                        <option value="ml">ml</option>
                        <option value="item">item</option>
                        <option value="piece">piece</option>
                        <option value="bottle">bottle</option>
                      </select>
                    </FormField>
                    <FormField label="Stock Quantity *">
                      <input type="number" name="stockQuantity" required value={formData.stockQuantity} onChange={handleChange}
                        className={inp} placeholder="0" />
                    </FormField>
                    <div className="md:col-span-2">
                      <FormField label="Description">
                        <textarea name="description" value={formData.description} onChange={handleChange}
                          rows={3} className={inp} placeholder="Product description…" />
                      </FormField>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit"
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition">
                        <CheckCircle size={14} />
                        {editingProduct ? 'Update Product' : 'Create Product'}
                      </button>
                    </div>
                    <button type="button" onClick={resetForm}
                      className="px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Empty state ───────────────────────────── */}
          {products.length === 0 && (
            <div className="glass-card relative overflow-hidden py-20 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="prism-ray" style={{ left: '48%', width: '16%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)' }}>
                <Package size={28} style={{ color: '#c8a96b' }} />
              </div>
              <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1.5">No products yet</h3>
              <p className="text-sm text-[var(--muted-color)]">Add your first product using the form above.</p>
            </div>
          )}

          {/* ── Products table ────────────────────────── */}
          {products.length > 0 && (
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.06s' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #c8a96b44 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '62%', width: '13%', animation: 'prism-ray-sweep 22s ease-in-out 5s infinite' }} />

              <div className="px-7 pt-6 pb-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Inventory</h2>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)', color: '#c8a96b' }}>
                    {products.length} product{products.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>
              </div>

              <div className="overflow-x-auto pb-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Name', 'Vendor', 'Cost / Unit', 'Stock', 'Actions'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {products.map((product) => {
                      const sp = stockPill(product.stockQuantity);
                      return (
                        <tr key={product.id} className="hover:bg-white/[0.015] transition">
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-[var(--heading-color)]">{product.name}</p>
                            {product.description && (
                              <p className="text-[11px] text-[var(--muted-color)] mt-0.5 max-w-[220px] truncate">{product.description}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                              style={{ background: 'rgba(14,165,160,0.10)', border: '1px solid rgba(14,165,160,0.22)', color: '#0ea5a0' }}>
                              {product.vendor}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-primary">{formatQAR(product.costPerUnit)}</span>
                            <span className="text-xs text-[var(--muted-color)] ml-1">/ {product.unit}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                              style={{ background: sp.bg, border: `1px solid ${sp.border}`, color: sp.color }}>
                              {product.stockQuantity} {product.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => handleEdit(product)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                                <Edit2 size={11} /> Edit
                              </button>
                              <button onClick={() => handleDelete(product.id, product.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition">
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      <AppModal
        isOpen={modal.open} title={modal.title} message={modal.message}
        variant={modal.variant} confirmLabel="Confirm"
        onConfirm={modal.onConfirm} onClose={closeModal}
      />
    </>
  );
}

export default ManageProducts;