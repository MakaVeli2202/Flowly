// AdminSkills.jsx — Detailer Skill System
import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../../api/auth';
import { Zap, Plus, Trash2, Save, CheckCircle, AlertCircle, X, User } from 'lucide-react';

const STORAGE_KEY_SKILLS = 'adminSkills';

/* ── Default skill categories ── */
const DEFAULT_SKILLS = [
  { id: 1, name: 'Exterior Wash & Dry',     category: 'Exterior' },
  { id: 2, name: 'Machine Polish',          category: 'Exterior' },
  { id: 3, name: 'Paint Correction',        category: 'Exterior' },
  { id: 4, name: 'Ceramic Coating',         category: 'Exterior' },
  { id: 5, name: 'Paint Protection Film',   category: 'Exterior' },
  { id: 6, name: 'Headlight Restoration',   category: 'Exterior' },
  { id: 7, name: 'Interior Deep Clean',     category: 'Interior' },
  { id: 8, name: 'Seat & Upholstery Care',  category: 'Interior' },
  { id: 9, name: 'Stain & Odor Removal',    category: 'Interior' },
  { id: 10, name: 'Dashboard Detailing',    category: 'Interior' },
  { id: 11, name: 'Interior Ceramic Coat',  category: 'Interior' },
  { id: 12, name: 'Engine Bay Cleaning',    category: 'Specialty' },
  { id: 13, name: 'Rim & Wheel Detailing',  category: 'Specialty' },
  { id: 14, name: 'Glass Sealing',          category: 'Specialty' },
];

const CATEGORIES = ['Exterior', 'Interior', 'Specialty', 'Other'];
const CATEGORY_COLORS = { Exterior: '#0ea5a0', Interior: '#c8a96b', Specialty: '#a855f7', Other: '#6366f1' };

/* ── Minimal localStorage helpers ── */
function loadSkills() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SKILLS)) || DEFAULT_SKILLS; } catch { return DEFAULT_SKILLS; }
}
function saveSkills(skills) {
  localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(skills));
}
function loadWorkerSkills() {
  try { return JSON.parse(localStorage.getItem('adminWorkerSkills')) || {}; } catch { return {}; }
}
function saveWorkerSkills(ws) {
  localStorage.setItem('adminWorkerSkills', JSON.stringify(ws));
  window.dispatchEvent(new CustomEvent('workerSkillsChanged', { detail: ws }));
}

/* ── PRISM CSS ── */
const PRISM_CSS = `
@keyframes holo-sweep{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes prism-ray-sweep{0%{transform:translateX(-130%) skewX(-15deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(460%) skewX(-15deg);opacity:0}}
@keyframes spectrum-float{0%,100%{transform:translate(0,0) rotate(0deg);opacity:.18}33%{transform:translate(12px,-14px) rotate(120deg);opacity:.30}66%{transform:translate(-7px,8px) rotate(240deg);opacity:.22}}
@keyframes cta-rainbow-glow{0%,100%{box-shadow:0 0 0 1.5px rgba(255,80,80,.42),0 0 22px rgba(255,165,0,.15)}33%{box-shadow:0 0 0 1.5px rgba(0,200,255,.42),0 0 22px rgba(160,0,255,.15)}66%{box-shadow:0 0 0 1.5px rgba(0,255,120,.42),0 0 22px rgba(255,0,100,.15)}}
@keyframes card-enter{from{transform:translateY(14px) scale(.988);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.prism-ray{position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%)}
.spectrum-line{height:1.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:.40}
.cta-prism-glow{animation:cta-rainbow-glow 5s ease-in-out infinite}
.card-enter{animation:card-enter .48s cubic-bezier(.22,1,.36,1) both}
.field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem;transition:border-color .2s,box-shadow .2s;outline:none}
.field-input:focus{border-color:rgba(168,85,247,.65);box-shadow:0 0 0 3px rgba(168,85,247,.12)}
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
      el.style.background = `conic-gradient(from ${hue}deg,rgba(168,85,247,.09),rgba(99,102,241,.07),rgba(0,255,100,.07),rgba(168,85,247,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} style={{ position:'fixed', pointerEvents:'none', zIndex:0, borderRadius:'50%', filter:'blur(90px)', mixBlendMode:'screen', willChange:'transform,background', width:480, height:480, top:'-240px', left:'-240px' }} />;
}

export default function AdminSkills() {
  const [skills,        setSkills]        = useState(loadSkills);
  const [workerSkills,  setWorkerSkills]  = useState(loadWorkerSkills);
  const [workers,       setWorkers]       = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // New skill form
  const [newSkillName, setNewSkillName]   = useState('');
  const [newSkillCat,  setNewSkillCat]    = useState('Exterior');
  const [addError,     setAddError]       = useState('');
  const [addSuccess,   setAddSuccess]     = useState('');

  // Worker assignment
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assignSaved,    setAssignSaved]    = useState(false);

  useEffect(() => {
    authAPI.getWorkers()
      .then(d => setWorkers(d || []))
      .catch(() => {})
      .finally(() => setLoadingWorkers(false));
  }, []);

  /* ── Skill CRUD ── */
  const handleAddSkill = () => {
    setAddError(''); setAddSuccess('');
    const name = newSkillName.trim();
    if (!name) { setAddError('Skill name is required.'); return; }
    if (skills.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      setAddError('A skill with this name already exists.'); return;
    }
    const id = Date.now();
    const updated = [...skills, { id, name, category: newSkillCat }];
    setSkills(updated);
    saveSkills(updated);
    setNewSkillName('');
    setAddSuccess(`"${name}" added.`);
    setTimeout(() => setAddSuccess(''), 2500);
  };

  const handleDeleteSkill = (id) => {
    const updated = skills.filter(s => s.id !== id);
    setSkills(updated);
    saveSkills(updated);
    // Remove from all worker assignments
    const ws = { ...workerSkills };
    Object.keys(ws).forEach(wid => { ws[wid] = (ws[wid] || []).filter(sid => sid !== id); });
    setWorkerSkills(ws);
    saveWorkerSkills(ws);
  };

  /* ── Worker skill toggle ── */
  const toggleWorkerSkill = (skillId) => {
    if (!selectedWorker) return;
    const wid = String(selectedWorker.id);
    const current = workerSkills[wid] || [];
    const updated = current.includes(skillId) ? current.filter(s => s !== skillId) : [...current, skillId];
    const ws = { ...workerSkills, [wid]: updated };
    setWorkerSkills(ws);
  };

  const handleSaveWorkerSkills = () => {
    saveWorkerSkills(workerSkills);
    setAssignSaved(true);
    setTimeout(() => setAssignSaved(false), 2500);
  };

  const byCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = skills.filter(s => s.category === cat);
    return acc;
  }, {});

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />
      <div className="min-h-screen py-10 relative"
        style={{ background: 'radial-gradient(circle at 7% 6%,rgba(168,85,247,.05) 0%,transparent 38%),radial-gradient(circle at 93% 92%,rgba(99,102,241,.04) 0%,transparent 32%)' }}>
        <div className="container mx-auto px-4 max-w-5xl relative z-10 space-y-6">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#a855f7)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em]" style={{ color:'#a855f7' }}>Admin Panel</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#a855f7,transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(168,85,247,.12)', border:'1px solid rgba(168,85,247,.24)' }}>
                <Zap size={16} style={{ color:'#a855f7' }} />
              </div>
              <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Detailer Skills</h1>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">Create skills and assign them to detailers for smarter job matching.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">

            {/* ── Left: Skill Library ── */}
            <div className="space-y-4">

              {/* Add Skill */}
              <div className="glass-card relative overflow-hidden card-enter">
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#a855f7 38%,#6366f1 62%,transparent)' }} />
                <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: 'linear-gradient(180deg,#a855f7 0%,#a855f744 60%,transparent 100%)' }} />
                <div className="prism-ray" style={{ left:'72%', width:'14%', animation:'prism-ray-sweep 20s ease-in-out 4s infinite' }} />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(168,85,247,.12)', border:'1px solid rgba(168,85,247,.24)' }}>
                      <Plus size={13} style={{ color:'#a855f7' }} />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--heading-color)]">Add New Skill</h2>
                  </div>

                  {addError && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2.5 mb-4 text-xs text-rose-300">
                      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{addError}
                    </div>
                  )}
                  {addSuccess && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 mb-4 text-xs text-emerald-400">
                      <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />{addSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="col-span-2">
                      <label className="field-label">Skill Name</label>
                      <input
                        type="text" value={newSkillName}
                        onChange={e => setNewSkillName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSkill()}
                        placeholder="e.g. Ceramic Coating"
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">Category</label>
                      <select value={newSkillCat} onChange={e => setNewSkillCat(e.target.value)} className="field-input">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={handleAddSkill}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition"
                        style={{ background:'rgba(168,85,247,.15)', color:'#a855f7', border:'1px solid rgba(168,85,247,.35)' }}>
                        <Plus size={14} /> Add Skill
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skill Library */}
              <div className="glass-card relative overflow-hidden card-enter">
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#a855f7 38%,#6366f1 62%,transparent)' }} />
                <div className="p-6">
                  <h2 className="text-base font-bold text-[var(--heading-color)] mb-4">Skill Library ({skills.length})</h2>
                  <div className="mb-4"><div className="spectrum-line" /></div>
                  <div className="space-y-4">
                    {CATEGORIES.map(cat => byCategory[cat]?.length > 0 && (
                      <div key={cat}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: CATEGORY_COLORS[cat] || '#c8a96b' }}>
                          {cat}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {byCategory[cat].map(skill => (
                            <span key={skill.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold group"
                              style={{ background: `${CATEGORY_COLORS[skill.category] || '#c8a96b'}14`, color: CATEGORY_COLORS[skill.category] || '#c8a96b', border: `1px solid ${CATEGORY_COLORS[skill.category] || '#c8a96b'}28` }}>
                              {skill.name}
                              <button type="button"
                                onClick={() => handleDeleteSkill(skill.id)}
                                className="text-[var(--muted-color)] hover:text-rose-400 transition-colors ml-0.5"
                                title="Remove skill">
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Assign Skills to Detailers ── */}
            <div className="glass-card relative overflow-hidden card-enter">
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#6366f1 38%,#a855f7 62%,transparent)' }} />
              <div className="absolute top-0 left-0 w-[3px] h-full" style={{ background: 'linear-gradient(180deg,#6366f1 0%,#6366f144 60%,transparent 100%)' }} />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.24)' }}>
                    <User size={13} style={{ color:'#6366f1' }} />
                  </div>
                  <h2 className="text-lg font-bold text-[var(--heading-color)]">Assign to Detailer</h2>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>

                {/* Worker picker */}
                <div className="mb-4">
                  <label className="field-label">Select Detailer</label>
                  <select
                    value={selectedWorker?.id ?? ''}
                    onChange={e => {
                      const w = workers.find(x => String(x.id) === e.target.value);
                      setSelectedWorker(w || null);
                      setAssignSaved(false);
                    }}
                    className="field-input">
                    <option value="">— Select a detailer —</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {`${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`}
                      </option>
                    ))}
                  </select>
                  {loadingWorkers && <p className="text-xs text-[var(--muted-color)] mt-1">Loading workers…</p>}
                </div>

                {selectedWorker && (
                  <>
                    <p className="text-xs text-[var(--muted-color)] mb-4">
                      Check skills for <strong className="text-[var(--heading-color)]">
                        {`${selectedWorker.firstName || ''} ${selectedWorker.lastName || ''}`.trim() || selectedWorker.email}
                      </strong>
                    </p>
                    <div className="space-y-4">
                      {CATEGORIES.map(cat => byCategory[cat]?.length > 0 && (
                        <div key={cat}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: CATEGORY_COLORS[cat] || '#c8a96b' }}>
                            {cat}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {byCategory[cat].map(skill => {
                              const assigned = (workerSkills[String(selectedWorker.id)] || []).includes(skill.id);
                              return (
                                <button key={skill.id} type="button"
                                  onClick={() => toggleWorkerSkill(skill.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                                  style={assigned
                                    ? { background: `${CATEGORY_COLORS[skill.category] || '#c8a96b'}22`, color: CATEGORY_COLORS[skill.category] || '#c8a96b', border: `1px solid ${CATEGORY_COLORS[skill.category] || '#c8a96b'}55` }
                                    : { background: 'rgba(255,255,255,.04)', color: 'var(--muted-color)', border: '1px solid var(--border-color)' }
                                  }>
                                  {assigned && <CheckCircle size={10} />}
                                  {skill.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5">
                      <button type="button" onClick={handleSaveWorkerSkills}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition cta-prism-glow"
                        style={{ background:'rgba(99,102,241,.15)', color:'#6366f1', border:'1px solid rgba(99,102,241,.35)' }}>
                        {assignSaved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save Skill Assignment</>}
                      </button>
                    </div>
                  </>
                )}

                {!selectedWorker && !loadingWorkers && (
                  <div className="text-center py-10">
                    <User size={36} className="mx-auto mb-3 text-[var(--muted-color)] opacity-30" />
                    <p className="text-sm text-[var(--muted-color)]">Select a detailer above to manage their skills.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Worker skill summary ── */}
          {workers.length > 0 && (
            <div className="glass-card relative overflow-hidden card-enter">
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#a855f7 38%,#0ea5a0 62%,transparent)' }} />
              <div className="p-6">
                <h2 className="text-base font-bold text-[var(--heading-color)] mb-4">Skill Summary by Detailer</h2>
                <div className="mb-4"><div className="spectrum-line" /></div>
                <div className="divide-y divide-[var(--border-color)]">
                  {workers.map(w => {
                    const wid = String(w.id);
                    const assigned = (workerSkills[wid] || []).map(sid => skills.find(s => s.id === sid)).filter(Boolean);
                    return (
                      <div key={w.id} className="py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/22 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={13} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[var(--heading-color)]">
                            {`${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`}
                          </p>
                          {assigned.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {assigned.map(skill => (
                                <span key={skill.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: `${CATEGORY_COLORS[skill.category] || '#c8a96b'}14`, color: CATEGORY_COLORS[skill.category] || '#c8a96b' }}>
                                  {skill.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--muted-color)] mt-1">No skills assigned</p>
                          )}
                        </div>
                        <button type="button"
                          onClick={() => setSelectedWorker(w)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition flex-shrink-0">
                          Edit →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
