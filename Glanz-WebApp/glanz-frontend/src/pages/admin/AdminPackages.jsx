import React, { useState, useEffect, useRef } from 'react';
import { packagesAPI } from '../../api/packages';
import { servicesAPI } from '../../api/services';
import {
  Plus, Edit2, Trash2, AlertCircle, CheckCircle, Check,
  Eye, EyeOff, X, ShoppingBag, TrendingUp, Clock,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';
import AppModal from '../../components/shared/AppModal';

/* ── Tier colour map ─────────────────────────────────────────── */
const TIER_STYLES = {
  Standard: { color: '#3b82f6' },
  Gold:     { color: '#c8a96b' },
  Platinum: { color: '#94a3b8' },
  Premium:  { color: '#8b5cf6' },
};

const UI_BY_LANG = {
  en: {
    loading: 'Loading packages...',
    loadFail: 'Failed to load data',
    selectService: 'Please select at least one service',
    updateOk: 'Package updated successfully',
    createOk: 'Package created successfully',
    saveFail: 'Failed to save package',
    deleteTitle: 'Delete Package',
    deleteMsg: (name) => `Are you sure you want to delete "${name}"? This cannot be undone.`,
    deleteOk: 'Package deleted successfully',
    deleteFail: 'Failed to delete package',
    activateTitle: 'Activate Package',
    deactivateTitle: 'Deactivate Package',
    activateMsg: (name) => `Are you sure you want to activate "${name}"?`,
    deactivateMsg: (name) => `Are you sure you want to deactivate "${name}"?`,
    toggled: (active) => `Package ${active ? 'deactivated' : 'activated'} successfully`,
    toggleFail: 'Failed to update package status',
    title: 'Manage Packages',
    subtitle: 'Build packages and set pricing',
    closeForm: 'Close Form',
    addPackage: 'Add Package',
    editMode: 'Edit Mode',
    newPackage: 'New Package',
    createPackage: 'Create Package',
    packageName: 'Package Name *',
    tier: 'Tier *',
    price: 'Price (QAR) *',
    duration: 'Duration (minutes) *',
    imageUrl: 'Image URL',
    description: 'Description',
    servicesSelected: (count) => `Services - ${count} selected`,
  },
  ar: {
    loading: 'جارٍ تحميل الباقات...',
    loadFail: 'فشل تحميل البيانات',
    selectService: 'يرجى اختيار خدمة واحدة على الأقل',
    updateOk: 'تم تحديث الباقة بنجاح',
    createOk: 'تم إنشاء الباقة بنجاح',
    saveFail: 'فشل حفظ الباقة',
    deleteTitle: 'حذف الباقة',
    deleteMsg: (name) => `هل تريد حذف "${name}"؟ لا يمكن التراجع.`,
    deleteOk: 'تم حذف الباقة بنجاح',
    deleteFail: 'فشل حذف الباقة',
    activateTitle: 'تفعيل الباقة',
    deactivateTitle: 'تعطيل الباقة',
    activateMsg: (name) => `هل تريد تفعيل "${name}"؟`,
    deactivateMsg: (name) => `هل تريد تعطيل "${name}"؟`,
    toggled: (active) => `تم ${active ? 'تعطيل' : 'تفعيل'} الباقة بنجاح`,
    toggleFail: 'فشل تحديث حالة الباقة',
    title: 'إدارة الباقات',
    subtitle: 'إنشاء الباقات وتحديد الأسعار',
    closeForm: 'إغلاق النموذج',
    addPackage: 'إضافة باقة',
    editMode: 'وضع التعديل',
    newPackage: 'باقة جديدة',
    createPackage: 'إنشاء باقة',
    packageName: 'اسم الباقة *',
    tier: 'الفئة *',
    price: 'السعر (ر.ق) *',
    duration: 'المدة (دقائق) *',
    imageUrl: 'رابط الصورة',
    description: 'الوصف',
    servicesSelected: (count) => `الخدمات - ${count} مختارة`,
  },
  de: {
    loading: 'Pakete werden geladen...',
    loadFail: 'Daten konnten nicht geladen werden',
    selectService: 'Bitte mindestens einen Service auswahlen',
    updateOk: 'Paket erfolgreich aktualisiert',
    createOk: 'Paket erfolgreich erstellt',
    saveFail: 'Paket konnte nicht gespeichert werden',
    deleteTitle: 'Paket loschen',
    deleteMsg: (name) => `Mochten Sie "${name}" wirklich loschen?`,
    deleteOk: 'Paket erfolgreich geloscht',
    deleteFail: 'Paket konnte nicht geloscht werden',
    activateTitle: 'Paket aktivieren',
    deactivateTitle: 'Paket deaktivieren',
    activateMsg: (name) => `"${name}" aktivieren?`,
    deactivateMsg: (name) => `"${name}" deaktivieren?`,
    toggled: (active) => `Paket erfolgreich ${active ? 'deaktiviert' : 'aktiviert'}`,
    toggleFail: 'Paketstatus konnte nicht aktualisiert werden',
    title: 'Pakete verwalten',
    subtitle: 'Pakete erstellen und Preise festlegen',
    closeForm: 'Formular schlieBen',
    addPackage: 'Paket hinzufugen',
    editMode: 'Bearbeitungsmodus',
    newPackage: 'Neues Paket',
    createPackage: 'Paket erstellen',
    packageName: 'Paketname *',
    tier: 'Stufe *',
    price: 'Preis (QAR) *',
    duration: 'Dauer (Minuten) *',
    imageUrl: 'Bild-URL',
    description: 'Beschreibung',
    servicesSelected: (count) => `Services - ${count} ausgewahlt`,
  },
};

/* ── PRISM CSS ─────────────────────────────────────────────── */

/* ── Cursor orb ─────────────────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my, rafId;
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

/* ── FormField ───────────────────────────────────────────────── */
function FormField({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

/* ── FormDivider ─────────────────────────────────────────────── */
function FormDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-[var(--border-color)]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{label}</p>
      <div className="flex-1 h-px bg-[var(--border-color)]" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MANAGE PACKAGES
════════════════════════════════════════════════════════════ */
function ManagePackages() {
  const { t, lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
  /* ── State & logic: identical to original ─────────────────── */
  const [packages,          setPackages]          = useState([]);
  const [services,          setServices]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState('');
  const [success,           setSuccess]           = useState('');
  const [showForm,          setShowForm]          = useState(false);
  const [editingPackage,    setEditingPackage]    = useState(null);
  const [togglingPackageId, setTogglingPackageId] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
  const [reordering, setReordering] = useState(false);

  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open: true, title, message, variant, onConfirm });
  const closeModal = () => setModal((m) => ({ ...m, open: false, onConfirm: null }));

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', tier: 'Standard',
    estimatedDurationMinutes: '', imageUrl: '', serviceIds: [],
  });

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true);
      const [packagesData, servicesData] = await Promise.all([
        packagesAPI.getAllAdmin(),
        servicesAPI.getAll(),
      ]);
      setPackages(packagesData);
      setServices(servicesData);
    } catch { setError(ui.loadFail); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleServiceToggle = (serviceId) => {
    if (formData.serviceIds.includes(serviceId)) {
      setFormData({ ...formData, serviceIds: formData.serviceIds.filter((id) => id !== serviceId) });
    } else {
      setFormData({ ...formData, serviceIds: [...formData.serviceIds, serviceId] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (formData.serviceIds.length === 0) { setError(ui.selectService); return; }
    try {
      const packageData = {
        name: formData.name, description: formData.description,
        price: parseFloat(formData.price), tier: formData.tier,
        estimatedDurationMinutes: parseInt(formData.estimatedDurationMinutes),
        imageUrl: formData.imageUrl || null, serviceIds: formData.serviceIds,
      };
      if (editingPackage) {
        await packagesAPI.update(editingPackage.id, packageData);
        setSuccess(ui.updateOk);
      } else {
        await packagesAPI.create(packageData);
        setSuccess(ui.createOk);
      }
      resetForm(); fetchData();
    } catch (err) { setError(err.response?.data?.message || ui.saveFail); }
  };

  const movePackage = async (idx, dir) => {
    const next = [...packages];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const reordered = next.map((p, i) => ({ ...p, sortOrder: i }));
    setPackages(reordered);
    setReordering(true);
    try {
      await packagesAPI.reorder(reordered.map((p, i) => ({ id: p.id, sortOrder: i })));
    } catch { fetchData(); }
    finally { setReordering(false); }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name, description: pkg.description || '',
      price: pkg.price.toString(), tier: pkg.tier,
      estimatedDurationMinutes: pkg.estimatedDurationMinutes.toString(),
      imageUrl: pkg.imageUrl || '',
      serviceIds: pkg.services.map((s) => s.serviceId),
    });
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    showConfirm(ui.deleteTitle, ui.deleteMsg(name), 'danger',
      async () => {
        closeModal();
        try { await packagesAPI.delete(id); setSuccess(ui.deleteOk); fetchData(); }
        catch { setError(ui.deleteFail); }
      }
    );
  };

  const handleToggleActive = (id, isCurrentlyActive, name) => {
    showConfirm(
      isCurrentlyActive ? ui.deactivateTitle : ui.activateTitle,
      isCurrentlyActive ? ui.deactivateMsg(name) : ui.activateMsg(name),
      isCurrentlyActive ? 'warning' : 'info',
      async () => {
        closeModal(); setError(''); setSuccess('');
        setTogglingPackageId(id);
        try {
          await packagesAPI.toggleActive(id);
          setSuccess(ui.toggled(isCurrentlyActive));
          fetchData();
        } catch { setError(ui.toggleFail); }
        finally { setTogglingPackageId(null); }
      }
    );
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', tier: 'Standard', estimatedDurationMinutes: '', imageUrl: '', serviceIds: [] });
    setEditingPackage(null);
    setShowForm(false);
  };

  const calculateEstimatedCost = () =>
    formData.serviceIds.reduce((total, serviceId) => {
      const service = services.find((s) => s.id === serviceId);
      return total + (service?.estimatedCost || 0);
    }, 0);

  const estimatedCost   = calculateEstimatedCost();
  const estimatedProfit = parseFloat(formData.price || 0) - estimatedCost;
  const profitMargin    = formData.price ? (estimatedProfit / parseFloat(formData.price)) * 100 : 0;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">{ui.loading}</p>
    </div>
  );

  const formAccent = editingPackage ? '#0ea5a0' : '#c8a96b';
  const inp = 'field-input';

  /* ── RENDER ────────────────────────────────────────────────── */
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
        {/* Backdrop orb */}
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Page header ──────────────────────────────── */}
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
                  <ShoppingBag size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.title}</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">{ui.subtitle}</p>
            </div>
            <div className={showForm ? '' : 'cta-prism-glow rounded-xl'}>
              <button type="button" onClick={() => setShowForm((prev) => !prev)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                {showForm ? <X size={15} /> : <Plus size={15} />}
                {showForm ? ui.closeForm : ui.addPackage}
              </button>
            </div>
          </div>

          {/* ── Alerts ───────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300 transition"><X size={14} /></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-4">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm font-semibold">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-300 transition"><X size={14} /></button>
            </div>
          )}

          {/* ── Create / Edit form ───────────────────────── */}
          {showForm && (
            <div className="glass-card relative overflow-hidden card-stagger">
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: `linear-gradient(180deg, ${formAccent} 0%, ${formAccent}44 60%, transparent 100%)` }} />
              <div className="prism-ray" style={{ left: '70%', width: '12%', animation: 'prism-ray-sweep 18s ease-in-out 3s infinite' }} />

              <div className="p-7">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, transparent, ${formAccent})` }} />
                      <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em]" style={{ color: formAccent }}>
                        {editingPackage ? ui.editMode : ui.newPackage}
                      </p>
                      <span className="h-px w-5" style={{ background: `linear-gradient(90deg, ${formAccent}, transparent)` }} />
                    </div>
                    <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">
                      {editingPackage ? `Editing: ${editingPackage.name}` : ui.createPackage}
                    </h2>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-8 h-8 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:bg-white/5 transition">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-5"><div className="spectrum-line" /></div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Core fields */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <FormField label={ui.packageName}>
                      <input type="text" name="name" required value={formData.name} onChange={handleChange}
                        className={inp} placeholder="e.g. Gold Package" />
                    </FormField>
                    <FormField label={ui.tier}>
                      <select name="tier" required value={formData.tier} onChange={handleChange} className={inp}>
                        <option value="Standard">Standard</option>
                        <option value="Gold">Gold</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Premium">Premium</option>
                      </select>
                    </FormField>
                    <FormField label={ui.price}>
                      <input type="number" step="0.01" name="price" required value={formData.price} onChange={handleChange}
                        className={inp} placeholder="299.00" />
                    </FormField>
                    <FormField label={ui.duration}>
                      <input type="number" name="estimatedDurationMinutes" required value={formData.estimatedDurationMinutes} onChange={handleChange}
                        className={inp} placeholder="120" />
                    </FormField>
                    <div className="md:col-span-2">
                      <FormField label={ui.imageUrl}>
                        <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange}
                          className={inp} placeholder="https://..." />
                      </FormField>
                    </div>
                    <div className="md:col-span-2">
                      <FormField label={ui.description}>
                        <textarea name="description" value={formData.description} onChange={handleChange}
                          rows={3} className={inp} placeholder="Package description…" />
                      </FormField>
                    </div>
                  </div>

                  <FormDivider label={ui.servicesSelected(formData.serviceIds.length)} />

                  {/* Service selector */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {services.map((service) => {
                      const selected = formData.serviceIds.includes(service.id);
                      return (
                        <div key={service.id} onClick={() => handleServiceToggle(service.id)}
                          className="relative overflow-hidden rounded-xl border cursor-pointer transition-all duration-200"
                          style={{
                            borderColor: selected ? 'rgba(200,169,107,0.60)' : 'var(--border-color)',
                            background:  selected ? 'rgba(200,169,107,0.07)' : 'var(--card-bg)',
                          }}
                        >
                          <div className="p-4 flex items-start gap-3">
                            <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all duration-200"
                              style={{
                                background:   selected ? '#c8a96b' : 'transparent',
                                borderColor:  selected ? '#c8a96b' : 'var(--border-color)',
                              }}>
                              {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-[var(--heading-color)]">{service.name}</p>
                              {service.description && (
                                <p className="text-xs text-[var(--muted-color)] mt-0.5 leading-relaxed line-clamp-2">{service.description}</p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-[var(--muted-color)]">{service.defaultDurationMinutes} min</span>
                                <span className="text-xs font-bold" style={{ color: '#c8a96b' }}>
                                  Cost: {formatQAR(service.estimatedCost)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {selected && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px]"
                              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b, transparent)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Profitability panel */}
                  {formData.price && formData.serviceIds.length > 0 && (
                    <div className="relative overflow-hidden rounded-xl border border-[var(--border-color)]"
                      style={{ background: 'rgba(200,169,107,0.04)' }}>
                      <div className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp size={13} style={{ color: '#c8a96b' }} />
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c8a96b' }}>
                            Profitability Analysis
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          {[
                            { label: 'Price',       value: formatQAR(parseFloat(formData.price)),  color: 'text-primary'  },
                            { label: 'Est. Cost',   value: formatQAR(estimatedCost),               color: 'text-rose-400' },
                            { label: 'Est. Profit', value: formatQAR(estimatedProfit),             color: estimatedProfit > 0 ? 'text-green-400' : 'text-rose-400' },
                          ].map(({ label, value, color }) => (
                            <div key={label}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{label}</p>
                              <p className={`text-lg font-black ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-[var(--border-color)]">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Profit Margin</p>
                          <p className={`text-3xl font-black ${
                            profitMargin > 30 ? 'text-green-400' : profitMargin > 15 ? 'text-amber-400' : 'text-rose-400'
                          }`}>{profitMargin.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit / Cancel */}
                  <div className="flex gap-3 pt-2">
                    <div className="cta-prism-glow rounded-xl">
                      <button type="submit"
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition">
                        <CheckCircle size={14} />
                        {editingPackage ? 'Update Package' : 'Create Package'}
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

          {/* ── Empty state ───────────────────────────────── */}
          {packages.length === 0 && !loading && (
            <div className="glass-card relative overflow-hidden py-20 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="prism-ray" style={{ left: '48%', width: '16%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)' }}>
                <ShoppingBag size={28} style={{ color: '#c8a96b' }} />
              </div>
              <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1.5">No packages yet</h3>
              <p className="text-sm text-[var(--muted-color)]">Create your first package using the form above.</p>
            </div>
          )}

          {/* ── Package cards ─────────────────────────────── */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg, idx) => {
              const tierStyle = TIER_STYLES[pkg.tier] || TIER_STYLES.Standard;
              return (
                <div key={pkg.id}
                  className="glass-card overflow-hidden prism-glass card-stagger"
                  style={{ animationDelay: `${idx * 0.06}s`, '--px': '50%', '--py': '50%' }}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                    e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                  }}
                >
                  {/* ── Image ── */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={pkg.imageUrl || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400'}
                      alt={pkg.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0"
                      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.52) 100%)' }} />
                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide"
                        style={{
                          background: `${tierStyle.color}22`, border: `1px solid ${tierStyle.color}55`,
                          color: tierStyle.color, backdropFilter: 'blur(8px)',
                        }}>
                        {pkg.tier}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide backdrop-blur-sm ${
                        pkg.isActive
                          ? 'bg-green-500/20 border border-green-400/40 text-green-300'
                          : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
                      }`}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {/* Tier accent line at base of image */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${tierStyle.color}, transparent)` }} />
                  </div>

                  {/* ── Body ── */}
                  <div className="p-5 relative">
                    {/* Left accent bar */}
                    <div className="absolute top-0 left-0 w-[3px] h-full"
                      style={{ background: `linear-gradient(180deg, ${tierStyle.color} 0%, ${tierStyle.color}33 55%, transparent 100%)` }} />
                    {/* Prism ray */}
                    <div className="prism-ray"
                      style={{ left: '66%', width: '11%', animation: `prism-ray-sweep ${16 + idx * 2}s ease-in-out ${idx * 1.4}s infinite` }} />

                    {/* Name + description */}
                    <h3 className="text-lg font-black text-[var(--heading-color)] mb-1">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-xs text-[var(--muted-color)] leading-relaxed mb-4 line-clamp-2">{pkg.description}</p>
                    )}

                    {/* Price / Profit */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="rounded-xl border border-[var(--border-color)] p-3"
                        style={{ background: 'rgba(200,169,107,0.05)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-0.5">Price</p>
                        <p className="text-base font-black text-primary">{formatQAR(pkg.price)}</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border-color)] p-3"
                        style={{ background: 'rgba(34,197,94,0.04)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-0.5">Profit</p>
                        <p className="text-base font-black text-green-400">{formatQAR(pkg.estimatedProfit)}</p>
                      </div>
                    </div>

                    {/* Margin / Cost row */}
                    <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] px-3 py-2.5 mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">Margin</p>
                        <p className={`text-lg font-black ${
                          pkg.profitMarginPercent > 30 ? 'text-green-400'
                          : pkg.profitMarginPercent > 15 ? 'text-amber-400'
                          : 'text-rose-400'
                        }`}>{pkg.profitMarginPercent.toFixed(1)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">Cost</p>
                        <p className="text-sm font-bold text-rose-400">{formatQAR(pkg.estimatedCost)}</p>
                      </div>
                    </div>

                    {/* Services list */}
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">
                        Includes ({pkg.services.length})
                      </p>
                      <ul className="space-y-1.5">
                        {pkg.services.slice(0, 3).map((service, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-color)]">
                            <Check size={11} className="text-green-400 flex-shrink-0" strokeWidth={3} />
                            {service.serviceName}
                          </li>
                        ))}
                        {pkg.services.length > 3 && (
                          <li className="text-xs text-[var(--muted-color)] pl-[19px]">
                            +{pkg.services.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Duration chip */}
                    <div className="flex items-center gap-1.5 mb-5">
                      <Clock size={11} style={{ color: tierStyle.color }} />
                      <span className="text-xs font-semibold text-[var(--muted-color)]">
                        {pkg.estimatedDurationMinutes} min est.
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={reordering || idx === 0}
                          onClick={() => movePackage(idx, -1)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40 hover:text-primary transition disabled:opacity-30"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={reordering || idx === packages.length - 1}
                          onClick={() => movePackage(idx, 1)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40 hover:text-primary transition disabled:opacity-30"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <button onClick={() => handleEdit(pkg)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(pkg.id, pkg.isActive, pkg.name)}
                        disabled={togglingPackageId === pkg.id}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition ${
                          togglingPackageId === pkg.id
                            ? 'opacity-50 cursor-not-allowed border-[var(--border-color)] text-[var(--muted-color)]'
                            : pkg.isActive
                              ? 'border-orange-500/30 text-orange-400 hover:bg-orange-500/8'
                              : 'border-green-500/30 text-green-400 hover:bg-green-500/8'
                        }`}
                      >
                        {togglingPackageId === pkg.id
                          ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                          : pkg.isActive
                            ? <><EyeOff size={12} /> Deactivate</>
                            : <><Eye size={12} /> Activate</>
                        }
                      </button>
                      <button onClick={() => handleDelete(pkg.id, pkg.name)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      <AppModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        confirmLabel="Confirm"
        onConfirm={modal.onConfirm}
        onClose={closeModal}
      />
    </>
  );
}

export default ManagePackages;