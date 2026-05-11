// AdminJobPositions.jsx — Admin CRUD for job positions
import React, { useEffect, useState, useRef } from 'react';
import { Briefcase, Plus, Trash2, Edit3, Save, X, Check, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const STORAGE_KEY = 'adminJobPositions';

const PRISM_CSS = `
@keyframes card-enter{from{transform:translateY(14px) scale(.988);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
@keyframes spectrum-float{0%,100%{transform:translate(0,0) rotate(0deg);opacity:.18}33%{transform:translate(12px,-14px) rotate(120deg);opacity:.30}66%{transform:translate(-7px,8px) rotate(240deg);opacity:.22}}
@keyframes prism-ray-sweep{0%{transform:translateX(-130%) skewX(-15deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(460%) skewX(-15deg);opacity:0}}
@keyframes holo-sweep{0%{background-position:0% 50%}100%{background-position:300% 50%}}
.prism-ray{position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%)}
.card-stagger{animation:card-enter .52s cubic-bezier(.22,1,.36,1) both}
.spectrum-line{height:1.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:.40}
.field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem;transition:border-color .2s,box-shadow .2s;outline:none}
.field-input:focus{border-color:rgba(200,169,107,.65);box-shadow:0 0 0 3px rgba(200,169,107,.12)}
.field-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePositions(positions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  window.dispatchEvent(new CustomEvent('jobPositionsChanged'));
}

const EMPTY_FORM = { title: '', department: '', type: 'Full-Time', location: '', description: '', isOpen: true };

export default function AdminJobPositions() {
  const { t, lang } = useLanguage();
  const uiByLang = {
    en: {
      titleRequired: 'Position title is required.',
      deleteConfirm: 'Delete this position?',
      jobPositions: 'Job Positions',
      addPosition: 'Add Position',
      subtitle: 'Manage open job positions shown on the public Careers page.',
      editPosition: 'Edit Position',
      newPosition: 'New Position',
      positionTitle: 'Position Title *',
      department: 'Department',
      type: 'Type',
      location: 'Location',
      openApplications: 'Open for Applications',
      jobDescription: 'Job Description',
      updatePosition: 'Update Position',
      savePosition: 'Save Position',
      cancel: 'Cancel',
      noPositions: 'No positions yet. Click "Add Position" to get started.',
      open: 'Open',
      closed: 'Closed',
      closePosition: 'Close position',
      openPosition: 'Open position',
    },
    ar: {
      titleRequired: 'عنوان الوظيفة مطلوب.',
      deleteConfirm: 'هل تريد حذف هذه الوظيفة؟',
      jobPositions: 'الوظائف',
      addPosition: 'إضافة وظيفة',
      subtitle: 'إدارة الوظائف المفتوحة المعروضة في صفحة الوظائف العامة.',
      editPosition: 'تعديل الوظيفة',
      newPosition: 'وظيفة جديدة',
      positionTitle: 'عنوان الوظيفة *',
      department: 'القسم',
      type: 'النوع',
      location: 'الموقع',
      openApplications: 'مفتوحة للتقديم',
      jobDescription: 'وصف الوظيفة',
      updatePosition: 'تحديث الوظيفة',
      savePosition: 'حفظ الوظيفة',
      cancel: 'إلغاء',
      noPositions: 'لا توجد وظائف بعد. اضغط "إضافة وظيفة" للبدء.',
      open: 'مفتوحة',
      closed: 'مغلقة',
      closePosition: 'إغلاق الوظيفة',
      openPosition: 'فتح الوظيفة',
    },
    de: {
      titleRequired: 'Stellentitel ist erforderlich.',
      deleteConfirm: 'Diese Stelle loschen?',
      jobPositions: 'Stellen',
      addPosition: 'Stelle hinzufugen',
      subtitle: 'Verwalten Sie offene Stellen auf der offentlichen Karriereseite.',
      editPosition: 'Stelle bearbeiten',
      newPosition: 'Neue Stelle',
      positionTitle: 'Stellentitel *',
      department: 'Abteilung',
      type: 'Typ',
      location: 'Standort',
      openApplications: 'Fur Bewerbungen offen',
      jobDescription: 'Stellenbeschreibung',
      updatePosition: 'Stelle aktualisieren',
      savePosition: 'Stelle speichern',
      cancel: 'Abbrechen',
      noPositions: 'Noch keine Stellen. Klicken Sie auf "Stelle hinzufugen".',
      open: 'Offen',
      closed: 'Geschlossen',
      closePosition: 'Stelle schlieBen',
      openPosition: 'Stelle offnen',
    },
  };
  const ui = uiByLang[lang] || uiByLang.en;
  const [positions, setPositions] = useState(loadPositions);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  const persist = (updated) => {
    setPositions(updated);
    savePositions(updated);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { setError(ui.titleRequired); return; }
    setError('');
    if (editId !== null) {
      persist(positions.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      persist([...positions, { ...form, id: Date.now() }]);
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (pos) => {
    setForm({ title: pos.title, department: pos.department || '', type: pos.type || 'Full-Time', location: pos.location || '', description: pos.description || '', isOpen: pos.isOpen !== false });
    setEditId(pos.id);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleDelete = (id) => {
    if (window.confirm(ui.deleteConfirm)) persist(positions.filter(p => p.id !== id));
  };

  const handleToggleOpen = (id) => {
    persist(positions.map(p => p.id === id ? { ...p, isOpen: !p.isOpen } : p));
  };

  return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="min-h-screen py-10 relative"
        style={{ background: 'radial-gradient(circle at 7% 6%, rgba(200,169,107,.05) 0%, transparent 38%), radial-gradient(circle at 93% 92%, rgba(14,165,160,.04) 0%, transparent 32%)' }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg, rgba(200,169,107,.06), rgba(14,165,160,.04), rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 max-w-3xl relative z-10 space-y-6">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">{t('adminPanel')}</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.24)' }}>
                  <Briefcase size={16} style={{ color: '#f59e0b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.jobPositions}</h1>
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}
              >
                <Plus size={15} />
                {ui.addPosition}
              </button>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">{ui.subtitle}</p>
          </div>

          {/* Add / Edit Form */}
          {showForm && (
            <div ref={formRef} className="glass-card relative overflow-hidden card-stagger">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg,transparent,#f59e0b 38%,#0ea5a0 62%,transparent)' }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[var(--heading-color)] text-lg">{editId ? ui.editPosition : ui.newPosition}</h2>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(''); }} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--muted-color)]">
                    <X size={16} />
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 mb-4">
                    <AlertCircle size={13} className="text-rose-400" />
                    <p className="text-rose-300 text-sm">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="field-label">{ui.positionTitle}</label>
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="field-input" placeholder="e.g. Senior Detailer" />
                  </div>
                  <div>
                    <label className="field-label">{ui.department}</label>
                    <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="field-input" placeholder="e.g. Operations" />
                  </div>
                  <div>
                    <label className="field-label">{ui.type}</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="field-input">
                      {['Full-Time', 'Part-Time', 'Contract', 'Internship'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">{ui.location}</label>
                    <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="field-input" placeholder="e.g. Doha, Qatar" />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="field-label mb-0">{ui.openApplications}</label>
                    <button type="button" onClick={() => setForm(f => ({ ...f, isOpen: !f.isOpen }))}>
                      {form.isOpen
                        ? <ToggleRight size={24} style={{ color: '#10b981' }} />
                        : <ToggleLeft size={24} className="text-[var(--muted-color)]" />}
                    </button>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label">{ui.jobDescription}</label>
                    <textarea rows={6} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="field-input resize-none" placeholder="Describe responsibilities, requirements, benefits…" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={handleSubmit}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}>
                    <Save size={14} />
                    {editId ? ui.updatePosition : ui.savePosition}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); setError(''); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--text-color)] transition">
                    {ui.cancel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Positions list */}
          {positions.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Briefcase size={40} className="mx-auto mb-3 text-[var(--muted-color)] opacity-40" />
              <p className="text-[var(--muted-color)] text-sm">{ui.noPositions}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map(pos => (
                <div key={pos.id} className="glass-card relative overflow-hidden card-stagger">
                  <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: 'linear-gradient(90deg,transparent,#f59e0b 38%,#0ea5a0 62%,transparent)' }} />
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[var(--heading-color)]">{pos.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${pos.isOpen !== false ? 'text-emerald-400 bg-emerald-400/10' : 'text-[var(--muted-color)] bg-[var(--border-color)]/30'}`}>
                          {pos.isOpen !== false ? ui.open : ui.closed}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-color)]">
                        {pos.department && <span>{pos.department}</span>}
                        {pos.type && <span>· {pos.type}</span>}
                        {pos.location && <span>· {pos.location}</span>}
                      </div>
                      {pos.description && (
                        <p className="text-sm text-[var(--muted-color)] mt-1 line-clamp-2">{pos.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" onClick={() => handleToggleOpen(pos.id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition text-[var(--muted-color)] hover:text-[var(--text-color)]"
                        title={pos.isOpen !== false ? ui.closePosition : ui.openPosition}>
                        {pos.isOpen !== false ? <ToggleRight size={18} style={{ color: '#10b981' }} /> : <ToggleLeft size={18} />}
                      </button>
                      <button type="button" onClick={() => handleEdit(pos)}
                        className="p-2 rounded-lg hover:bg-white/10 transition text-[var(--muted-color)] hover:text-primary">
                        <Edit3 size={15} />
                      </button>
                      <button type="button" onClick={() => handleDelete(pos.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 transition text-[var(--muted-color)] hover:text-rose-400">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
