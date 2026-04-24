// ManageServices.jsx
import React, { useState, useEffect, useRef } from 'react';
import { servicesAPI } from '../../api/services';
import { productsAPI } from '../../api/products';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, X, Wrench, Clock } from 'lucide-react';
import { formatQAR } from '../../utils/currency';
import AppModal from '../../components/shared/AppModal';

const PRISM_CSS = `
@keyframes holo-sweep { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
@keyframes prism-ray-sweep {
  0%{transform:translateX(-130%) skewX(-15deg);opacity:0} 10%{opacity:1}
  90%{opacity:1} 100%{transform:translateX(460%) skewX(-15deg);opacity:0}
}
@keyframes spectrum-float {
  0%,100%{transform:translate(0,0) rotate(0deg);opacity:.18}
  33%{transform:translate(12px,-14px) rotate(120deg);opacity:.30}
  66%{transform:translate(-7px,8px) rotate(240deg);opacity:.22}
}
@keyframes cta-rainbow-glow {
  0%,100%{box-shadow:0 0 0 1.5px rgba(255,80,80,.42),0 0 22px rgba(255,165,0,.15)}
  33%{box-shadow:0 0 0 1.5px rgba(0,200,255,.42),0 0 22px rgba(160,0,255,.15)}
  66%{box-shadow:0 0 0 1.5px rgba(0,255,120,.42),0 0 22px rgba(255,0,100,.15)}
}
@keyframes card-enter { from{transform:translateY(14px) scale(.988);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
.prism-cursor-blob{position:fixed;pointer-events:none;z-index:0;border-radius:50%;filter:blur(90px);mix-blend-mode:screen;will-change:transform,background}
.prism-ray{position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);
  background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%)}
.prism-glass{position:relative;overflow:hidden}
.prism-glass::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:radial-gradient(circle at var(--px,50%) var(--py,50%),rgba(255,200,80,.10) 0%,rgba(80,255,160,.07) 30%,rgba(40,130,255,.07) 55%,transparent 80%);
  opacity:0;transition:opacity .32s;mix-blend-mode:screen}
.prism-glass:hover::after{opacity:1}
.spectrum-line{height:1.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:.40}
.cta-prism-glow{animation:cta-rainbow-glow 5s ease-in-out infinite}
.card-stagger{animation:card-enter .52s cubic-bezier(.22,1,.36,1) both}
.field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem;transition:border-color .2s,box-shadow .2s;outline:none;resize:none}
.field-input:focus{border-color:rgba(200,169,107,.65);box-shadow:0 0 0 3px rgba(200,169,107,.12)}
.field-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my, rafId;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*.07; cy += (my-cy)*.07;
      const hue = (mx/window.innerWidth)*360;
      el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width:480, height:480, top:'-240px', left:'-240px' }} />;
}
function FormField({ label, children }) {
  return <div><label className="field-label">{label}</label>{children}</div>;
}
function FormDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-[var(--border-color)]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{label}</p>
      <div className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}

function ManageServices() {
  const [services,       setServices]       = useState([]);
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [modal, setModal] = useState({ open:false, title:'', message:'', variant:'danger', onConfirm:null });
  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open:true, title, message, variant, onConfirm });
  const closeModal = () => setModal(m => ({ ...m, open:false, onConfirm:null }));
  const [formData, setFormData] = useState({ name:'', description:'', defaultDurationMinutes:'', products:[] });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, productsData] = await Promise.all([servicesAPI.getAll(), productsAPI.getAll()]);
      setServices(servicesData); setProducts(productsData);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddProduct    = () =>
    setFormData({ ...formData, products: [...formData.products, { productId:'', quantityUsed:'' }] });
  const handleRemoveProduct = index =>
    setFormData({ ...formData, products: formData.products.filter((_,i) => i !== index) });
  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...formData.products];
    updatedProducts[index][field] = value;
    setFormData({ ...formData, products: updatedProducts });
  };

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const serviceData = {
        name: formData.name, description: formData.description,
        defaultDurationMinutes: parseInt(formData.defaultDurationMinutes),
        products: formData.products.map(p => ({ productId: parseInt(p.productId), quantityUsed: parseFloat(p.quantityUsed) })),
      };
      if (editingService) {
        await servicesAPI.update(editingService.id, serviceData);
        setSuccess('Service updated successfully');
      } else {
        await servicesAPI.create(serviceData);
        setSuccess('Service created successfully');
      }
      resetForm(); fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save service'); }
  };

  const handleEdit = service => {
    setEditingService(service);
    setFormData({
      name: service.name, description: service.description || '',
      defaultDurationMinutes: service.defaultDurationMinutes.toString(),
      products: service.products.map(p => ({ productId: p.productId.toString(), quantityUsed: p.quantityUsed.toString() })),
    });
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    showConfirm('Delete Service', `Are you sure you want to delete "${name}"? This cannot be undone.`, 'danger',
      async () => {
        closeModal();
        try { await servicesAPI.delete(id); setSuccess('Service deleted successfully'); fetchData(); }
        catch { setError('Failed to delete service'); }
      }
    );
  };

  const resetForm = () => {
    setFormData({ name:'', description:'', defaultDurationMinutes:'', products:[] });
    setEditingService(null); setShowForm(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading services…</p>
    </div>
  );

  const formAccent = editingService ? '#0ea5a0' : '#c8a96b';
  const inp = 'field-input';

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />
      <div className="min-h-screen py-10 relative" style={{
        background:`radial-gradient(circle at 7% 6%,rgba(200,169,107,.05) 0%,transparent 38%),
                   radial-gradient(circle at 93% 92%,rgba(14,165,160,.04) 0%,transparent 32%)`,
      }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background:'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter:'blur(85px)', animation:'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background:'linear-gradient(90deg,transparent,#c8a96b)' }} />
                <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">Admin Panel</p>
                <span className="h-px w-7" style={{ background:'linear-gradient(90deg,#c8a96b,transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                  <Wrench size={16} style={{ color:'#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Manage Services</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Create services and assign products</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button" onClick={() => setShowForm(p => !p)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? 'Close Form' : 'Add Service'}
              </button>
            </div>
          </div>

          {/* ── Alerts ── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300"><X size={14}/></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-4">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm font-semibold">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300"><X size={14}/></button>
            </div>
          )}

          {/* ── Form ── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background:`linear-gradient(180deg,${formAccent} 0%,${formAccent}44 60%,transparent 100%)` }} />
              <div className="prism-ray" style={{ left:'70%', width:'12%', animation:'prism-ray-sweep 18s ease-in-out 3s infinite' }} />
              <div className="p-7">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="h-px w-5" style={{ background:`linear-gradient(90deg,transparent,${formAccent})` }} />
                      <p className="text-[.58rem] font-bold uppercase tracking-[.24em]" style={{ color:formAccent }}>
                        {editingService ? 'Edit Mode' : 'New Service'}
                      </p>
                      <span className="h-px w-5" style={{ background:`linear-gradient(90deg,${formAccent},transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editingService ? `Editing: ${editingService.name}` : 'Create Service'}
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
                    <FormField label="Service Name *">
                      <input type="text" name="name" required value={formData.name} onChange={handleChange} className={inp} placeholder="e.g. Hand Wash" />
                    </FormField>
                    <FormField label="Duration (minutes) *">
                      <input type="number" name="defaultDurationMinutes" required value={formData.defaultDurationMinutes} onChange={handleChange} className={inp} placeholder="30" />
                    </FormField>
                    <div className="md:col-span-2">
                      <FormField label="Description">
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={inp} placeholder="Service description…" />
                      </FormField>
                    </div>
                  </div>

                  <FormDivider label={`Products — ${formData.products.length} assigned`} />

                  <div className="space-y-3">
                    {formData.products.map((product, index) => (
                      <div key={index} className="relative overflow-hidden rounded-xl border border-[var(--border-color)]"
                        style={{ background:'rgba(14,165,160,.04)' }}>
                        <div className="absolute top-0 left-0 w-[2px] h-full"
                          style={{ background:'linear-gradient(180deg,#0ea5a0,#0ea5a044)' }} />
                        <div className="p-4 flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1">
                            <label className="field-label">Product</label>
                            <select value={product.productId} onChange={e => handleProductChange(index,'productId',e.target.value)} required className={inp}>
                              <option value="">Select product</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({formatQAR(p.costPerUnit)}/{p.unit})</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-36 flex-shrink-0">
                            <label className="field-label">Quantity</label>
                            <input type="number" step="0.01" value={product.quantityUsed} onChange={e => handleProductChange(index,'quantityUsed',e.target.value)} required className={inp} placeholder="0.00" />
                          </div>
                          <button type="button" onClick={() => handleRemoveProduct(index)}
                            className="flex-shrink-0 w-8 h-8 rounded-lg border border-rose-500/28 text-rose-400 hover:bg-rose-500/8 transition flex items-center justify-center">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {formData.products.length === 0 && (
                      <div className="text-center py-6 rounded-xl border border-dashed border-[var(--border-color)]">
                        <p className="text-xs text-[var(--muted-color)]">No products added yet</p>
                      </div>
                    )}
                    <button type="button" onClick={handleAddProduct}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition"
                      style={{ borderColor:'rgba(14,165,160,.35)', color:'#0ea5a0' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(14,165,160,.08)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <Plus size={13} /> Add Product
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit" className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition">
                        <CheckCircle size={14} />
                        {editingService ? 'Update Service' : 'Create Service'}
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

          {/* ── Empty state ── */}
          {services.length === 0 && (
            <div className="glass-card relative overflow-hidden py-20 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
              <div className="prism-ray" style={{ left:'48%', width:'16%', animation:'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background:'rgba(200,169,107,.10)', border:'1px solid rgba(200,169,107,.22)' }}>
                <Wrench size={28} style={{ color:'#c8a96b' }} />
              </div>
              <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1.5">No services yet</h3>
              <p className="text-sm text-[var(--muted-color)]">Add your first service using the form above.</p>
            </div>
          )}

          {/* ── Service cards ── */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, idx) => (
              <div key={service.id}
                className="glass-card relative overflow-hidden card-stagger"
                style={{ animationDelay:`${idx*.06}s`, '--px':'50%', '--py':'50%' }}
                onMouseMove={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--px',`${((e.clientX-r.left)/r.width*100).toFixed(1)}%`);
                  e.currentTarget.style.setProperty('--py',`${((e.clientY-r.top)/r.height*100).toFixed(1)}%`);
                }}
              >
                <div className="absolute top-0 left-0 w-[3px] h-full"
                  style={{ background:'linear-gradient(180deg,#0ea5a0 0%,#0ea5a044 60%,transparent 100%)' }} />
                <div className="prism-ray" style={{ left:'66%', width:'11%', animation:`prism-ray-sweep ${16+idx*2}s ease-in-out ${idx*1.4}s infinite` }} />

                <div className="p-5">
                  <h3 className="text-lg font-black text-[var(--heading-color)] mb-2">{service.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background:'rgba(14,165,160,.10)', border:'1px solid rgba(14,165,160,.22)', color:'#0ea5a0' }}>
                      <Clock size={10} /> {service.defaultDurationMinutes} min
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background:'rgba(200,169,107,.10)', border:'1px solid rgba(200,169,107,.22)', color:'#c8a96b' }}>
                      {service.products.length} product{service.products.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {service.description && (
                    <p className="text-xs text-[var(--muted-color)] mb-4 leading-relaxed line-clamp-2">{service.description}</p>
                  )}

                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Products Used</p>
                    <div className="space-y-1.5">
                      {service.products.map((product, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 border border-[var(--border-color)]"
                          style={{ background:'rgba(14,165,160,.04)' }}>
                          <span className="text-xs text-[var(--text-color)]">{product.productName}</span>
                          <span className="text-xs font-bold" style={{ color:'#0ea5a0' }}>{product.quantityUsed} {product.unit}</span>
                        </div>
                      ))}
                      {service.products.length === 0 && (
                        <p className="text-xs text-[var(--muted-color)] italic px-1">No products assigned</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border mb-5"
                    style={{ background:'rgba(200,169,107,.05)', borderColor:'rgba(200,169,107,.22)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#c8a96b' }}>Est. Cost</p>
                    <p className="text-base font-black" style={{ color:'#c8a96b' }}>{formatQAR(service.estimatedCost)}</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(service)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                      <Edit2 size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(service.id, service.name)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <AppModal isOpen={modal.open} title={modal.title} message={modal.message} variant={modal.variant} confirmLabel="Confirm" onConfirm={modal.onConfirm} onClose={closeModal} />
    </>
  );
}
export default ManageServices;