// ManageStaff.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../api/auth';
import AppModal from '../../components/shared/AppModal';
import { useToast } from '../../components/shared/Toast';
import { Users, Plus, Trash2, AlertCircle, Mail, Phone, Eye, EyeOff,
  CalendarDays, ChevronDown, ChevronUp, Save, X, CheckCircle, DollarSign, FileText, Download, Wallet, Check, Clock, Bell, Hash, Zap, Percent } from 'lucide-react';
import { getBusiness } from '../../config/business';
import { useLanguage } from '../../context/LanguageContext';

/* â”€â”€ Constants â€” identical to original â”€â”€ */
const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHIFT_HOURS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];

const UI_BY_LANG = {
  en: {
    loading: 'Loading staff...',
    subtitle: 'Add, remove, and manage your detailing staff',
    closeForm: 'Close Form',
    addDetailer: 'Add Detailer',
    addFirstDetailer: 'Add First Detailer',
    addNewDetailer: 'Add New Detailer',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    phone: 'Phone Number',
    password: 'Password',
    adding: 'Adding...',
    cancel: 'Cancel',
    active: 'Active',
    inactive: 'Inactive',
    schedule: 'Schedule',
    deactivate: 'Deactivate',
    activate: 'Activate',
    removing: 'Removing...',
    remove: 'Remove',
    salaryTitle: 'Monthly Salary (QAR)',
    saveSalary: 'Save Salary',
    saved: 'Saved',
    salaryError: 'Enter a valid salary amount.',
    workingSchedule: 'Working Schedule',
    saveSchedule: 'Save Schedule',
    staffStats: 'Staff Statistics',
    totalDetailers: 'Total Detailers',
    lastAdded: 'Last Added',
    noPayrollData: 'No payroll data for this period.',
  },
  ar: {
    loading: 'Ø¬Ø§Ø±Ù ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙØ±ÙŠÙ‚...',
    subtitle: 'Ø¥Ø¶Ø§ÙØ© ÙˆØ¥Ø²Ø§Ù„Ø© ÙˆØ¥Ø¯Ø§Ø±Ø© ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ',
    closeForm: 'Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù†Ù…ÙˆØ°Ø¬',
    addDetailer: 'Ø¥Ø¶Ø§ÙØ© Ø¹Ø§Ù…Ù„',
    addFirstDetailer: 'Ø¥Ø¶Ø§ÙØ© Ø£ÙˆÙ„ Ø¹Ø§Ù…Ù„',
    addNewDetailer: 'Ø¥Ø¶Ø§ÙØ© Ø¹Ø§Ù…Ù„ Ø¬Ø¯ÙŠØ¯',
    firstName: 'Ø§Ù„Ø§Ø³Ù… Ø§Ù„Ø£ÙˆÙ„',
    lastName: 'Ø§Ø³Ù… Ø§Ù„Ø¹Ø§Ø¦Ù„Ø©',
    email: 'Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ',
    phone: 'Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ',
    password: 'ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±',
    adding: 'Ø¬Ø§Ø±Ù Ø§Ù„Ø¥Ø¶Ø§ÙØ©...',
    cancel: 'Ø¥Ù„ØºØ§Ø¡',
    active: 'Ù†Ø´Ø·',
    inactive: 'ØºÙŠØ± Ù†Ø´Ø·',
    schedule: 'Ø§Ù„Ø¬Ø¯ÙˆÙ„',
    deactivate: 'ØªØ¹Ø·ÙŠÙ„',
    activate: 'ØªÙØ¹ÙŠÙ„',
    removing: 'Ø¬Ø§Ø±Ù Ø§Ù„Ø¥Ø²Ø§Ù„Ø©...',
    remove: 'Ø¥Ø²Ø§Ù„Ø©',
    salaryTitle: 'Ø§Ù„Ø±Ø§ØªØ¨ Ø§Ù„Ø´Ù‡Ø±ÙŠ (Ø±.Ù‚)',
    saveSalary: 'Ø­ÙØ¸ Ø§Ù„Ø±Ø§ØªØ¨',
    saved: 'ØªÙ… Ø§Ù„Ø­ÙØ¸',
    salaryError: 'Ø£Ø¯Ø®Ù„ Ù‚ÙŠÙ…Ø© Ø±Ø§ØªØ¨ ØµØ­ÙŠØ­Ø©.',
    workingSchedule: 'Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø¹Ù…Ù„',
    saveSchedule: 'Ø­ÙØ¸ Ø§Ù„Ø¬Ø¯ÙˆÙ„',
    staffStats: 'Ø¥Ø­ØµØ§Ø¡Ø§Øª Ø§Ù„ÙØ±ÙŠÙ‚',
    totalDetailers: 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¹Ø§Ù…Ù„ÙŠÙ†',
    lastAdded: 'Ø¢Ø®Ø± Ø¥Ø¶Ø§ÙØ©',
    noPayrollData: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø±ÙˆØ§ØªØ¨ Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙØªØ±Ø©.',
  },
  de: {
    loading: 'Team wird geladen...',
    subtitle: 'Detailing-Team hinzufugen, entfernen und verwalten',
    closeForm: 'Formular schlieBen',
    addDetailer: 'Mitarbeiter hinzufugen',
    addFirstDetailer: 'Ersten Mitarbeiter hinzufugen',
    addNewDetailer: 'Neuen Mitarbeiter hinzufugen',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail-Adresse',
    phone: 'Telefonnummer',
    password: 'Passwort',
    adding: 'Wird hinzugefugt...',
    cancel: 'Abbrechen',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    schedule: 'Zeitplan',
    deactivate: 'Deaktivieren',
    activate: 'Aktivieren',
    removing: 'Wird entfernt...',
    remove: 'Entfernen',
    salaryTitle: 'Monatsgehalt (QAR)',
    saveSalary: 'Gehalt speichern',
    saved: 'Gespeichert',
    salaryError: 'Gultigen Gehaltswert eingeben.',
    workingSchedule: 'Arbeitszeitplan',
    saveSchedule: 'Zeitplan speichern',
    staffStats: 'Team-Statistiken',
    totalDetailers: 'Gesamtmitarbeiter',
    lastAdded: 'Zuletzt hinzugefugt',
    noPayrollData: 'Keine Lohndaten fur diesen Zeitraum.',
  },
};

/* â”€â”€ parseSchedule â€” identical to original â”€â”€ */
function parseSchedule(worker) {
  const workingDays = worker.workingDays
    ? worker.workingDays.split(',').map(d => d.trim()).filter(Boolean)
    : ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayOverrides = {};
  if (Array.isArray(worker.daySchedules)) {
    for (const entry of worker.daySchedules) {
      if (entry.day) dayOverrides[entry.day] = { start: entry.shiftStart || '09:00', end: entry.shiftEnd || '18:00' };
    }
  }
  return { workingDays, shiftStart: worker.shiftStart || '09:00', shiftEnd: worker.shiftEnd || '18:00', dayOverrides };
}

/* PRISM_CSS â€” identical */

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
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width:480, height:480, top:'-240px', left:'-240px' }} />;
}

function ManageStaff() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
  const [workers,            setWorkers]            = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [deletingId,         setDeletingId]         = useState(null);
  const [savingId,           setSavingId]           = useState(null);
  const [editingScheduleId,  setEditingScheduleId]  = useState(null);
  const [scheduleData,       setScheduleData]       = useState({ workingDays:[], shiftStart:'09:00', shiftEnd:'18:00', dayOverrides:{} });
  const [scheduleSavingId,   setScheduleSavingId]   = useState(null);
  const [payrollMonth]     = useState(new Date().getMonth() + 1);
  const [payrollYear]      = useState(new Date().getFullYear());
  const [payModal, setPayModal] = useState({ open: false, worker: null, onConfirm: null });
  const [detailsModal, setDetailsModal] = useState({ open: false, worker: null });
  const [editingVanRoleId, setEditingVanRoleId] = useState(null);
  const [vanRoleForm, setVanRoleForm] = useState({ vanRole: '', driverId: '' });
  const [vanRoleSavingId, setVanRoleSavingId] = useState(null);
  const business = getBusiness();
  const closePayModal = () => setPayModal(m => ({ ...m, open: false, onConfirm: null }));
  const closeDetailsModal = () => setDetailsModal(m => ({ ...m, open: false, worker: null }));
  const [_modal, setModal] = useState({ open:false, title:'', message:'', variant:'info', onConfirm:null });
  const closeModal  = () => setModal(m => ({ ...m, open:false, onConfirm:null }));
  const showConfirm = (title, message, variant, onConfirm) =>
    setModal({ open:true, title, message, variant, onConfirm });
  const toast = useToast();

  useEffect(() => { fetchWorkers(); }, []);

  useEffect(() => { checkPayrollDue(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPayrollDue = async () => {
    try {
      const result = await authAPI.checkPayrollDue();
      if (result.hasUnpaid && result.unpaidCount > 0) {
        const today = new Date().getDate();
        if (today >= 25) {
          toast.error(`âš ï¸ Payroll due: ${result.unpaidCount} worker(s) unpaid (QAR ${result.totalAmount?.toLocaleString()}). Please pay before end of month.`, { duration: 8000 });
        }
      }
    } catch { /* empty */ }
  };

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getWorkers();
      setWorkers(data || []); setError('');
    } catch (err) { setError(err.response?.data?.message || 'Failed to load staff'); }
    finally { setLoading(false); }
  };

  const handleDeleteWorker = (workerId, workerName) => {
    showConfirm('Remove detailer', `Are you sure you want to remove ${workerName}? This cannot be undone.`, 'danger',
      async () => {
        closeModal();
        try { setDeletingId(workerId); await authAPI.deleteWorker(workerId); setError(''); await fetchWorkers(); }
        catch (err) { setError(err.response?.data?.message || 'Failed to delete worker'); }
        finally { setDeletingId(null); }
      }
    );
  };

  const handleToggleWorkerStatus = worker => {
    const nextStatus = !worker.isActive;
    const actionText = nextStatus ? 'activate' : 'deactivate';
    showConfirm(
      `${nextStatus ? 'Activate' : 'Deactivate'} detailer`,
      `Are you sure you want to ${actionText} ${worker.firstName} ${worker.lastName}?`,
      nextStatus ? 'info' : 'warning',
      async () => {
        closeModal();
        try {
          setSavingId(`status-${worker.id}`);
          await authAPI.updateWorkerStatus(worker.id, nextStatus);
          setError(''); await fetchWorkers();
        } catch (err) { setError(err.response?.data?.message || `Failed to ${actionText} worker`); }
        finally { setSavingId(null); }
      }
    );
  };

  const openScheduleEdit = worker => { setEditingScheduleId(worker.id); setScheduleData(parseSchedule(worker)); };

  const openVanRoleEdit = worker => {
    setEditingVanRoleId(worker.id);
    setVanRoleForm({ vanRole: worker.vanRole || '', driverId: worker.driverId || '' });
  };

  const handleSaveVanRole = async workerId => {
    try {
      setVanRoleSavingId(workerId);
      await authAPI.updateWorkerVanRole(workerId, vanRoleForm.vanRole || null, vanRoleForm.vanRole === 'Helper' ? Number(vanRoleForm.driverId) : null);
      setEditingVanRoleId(null);
      await fetchWorkers();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save van role'); }
    finally { setVanRoleSavingId(null); }
  };

  const toggleDay = day =>
    setScheduleData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day) ? prev.workingDays.filter(d => d !== day) : [...prev.workingDays, day],
    }));

  const setDayOverride = (day, field, value) =>
    setScheduleData(prev => ({
      ...prev,
      dayOverrides: { ...prev.dayOverrides, [day]: { ...(prev.dayOverrides[day] || { start: prev.shiftStart, end: prev.shiftEnd }), [field]: value } },
    }));

  const clearDayOverride = day =>
    setScheduleData(prev => { const next = { ...prev.dayOverrides }; delete next[day]; return { ...prev, dayOverrides: next }; });

  const handleSaveSchedule = async workerId => {
    try {
      setScheduleSavingId(workerId);
      const daySchedules = Object.entries(scheduleData.dayOverrides).map(([day, v]) => ({ day, shiftStart: v.start, shiftEnd: v.end }));
      await authAPI.updateWorkerSchedule(workerId, {
        workingDays: scheduleData.workingDays.join(','),
        shiftStart: scheduleData.shiftStart, shiftEnd: scheduleData.shiftEnd,
        daySchedules: daySchedules.length > 0 ? daySchedules : null,
      });
      setEditingScheduleId(null); await fetchWorkers();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save schedule'); }
    finally { setScheduleSavingId(null); }
  };

  const getEffectiveShift = day => {
    const override = scheduleData.dayOverrides[day];
    if (override) return { start: override.start, end: override.end, custom: true };
    return { start: scheduleData.shiftStart, end: scheduleData.shiftEnd, custom: false };
  };

  if (loading) return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
          <Users size={28} style={{ color:'#c8a96b' }} />
        </div>
        <p className="text-[var(--muted-color)] text-sm">{ui.loading}</p>
      </div>
    </>
  );


  return (
    <>
      <PrismaticCursorOrb />
      <div className="min-h-screen py-10 relative" style={{
        background:`radial-gradient(circle at 7% 6%,rgba(200,169,107,.05) 0%,transparent 38%),
                   radial-gradient(circle at 93% 92%,rgba(14,165,160,.04) 0%,transparent 32%)`,
      }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background:'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter:'blur(85px)', animation:'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* â”€â”€ Header â”€â”€ */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background:'linear-gradient(90deg,transparent,#c8a96b)' }} />
                <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">{t('adminPanel')}</p>
                <span className="h-px w-7" style={{ background:'linear-gradient(90deg,#c8a96b,transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
               <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                 <Users size={16} style={{ color:'#c8a96b' }} />
               </div>
               <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{t('manageStaff')}</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">{ui.subtitle}</p>
            </div>
            <div className="cta-prism-glow rounded-xl">
              <button type="button" onClick={() => navigate('/admin/staff/add')}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                <Plus size={15} /> {ui.addDetailer}
              </button>
            </div>
          </div>

          {/* â”€â”€ Error â”€â”€ */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm font-semibold">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300"><X size={14}/></button>
            </div>
          )}


          {/* â”€â”€ Empty state â”€â”€ */}
          {workers.length === 0 ? (
            <div className="glass-card relative overflow-hidden py-20 flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
              <div className="prism-ray" style={{ left:'48%', width:'16%', animation:'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background:'rgba(200,169,107,.10)', border:'1px solid rgba(200,169,107,.22)' }}>
                <Users size={28} style={{ color:'#c8a96b' }} />
              </div>
              <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1.5">{t('noStaffYet')}</h3>
              <p className="text-sm text-[var(--muted-color)] mb-5">{t('startByAdding')}</p>
              <div className="cta-prism-glow rounded-xl inline-flex">
                <button onClick={() => navigate('/admin/staff/add')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                  <Plus size={15}/> {ui.addFirstDetailer}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {workers.map((worker, idx) => {
                const isActive = worker.isActive !== false;
                const accentColor = isActive ? '#22c55e' : '#94a3b8';
                return (
                  <div key={worker.id} className="glass-card relative overflow-hidden card-stagger"
                    style={{ animationDelay:`${idx*.05}s` }}>
                    <div className="absolute top-0 left-0 w-[3px] h-full"
                      style={{ background:`linear-gradient(180deg,${accentColor} 0%,${accentColor}44 60%,transparent 100%)` }} />
                    <div className="prism-ray" style={{ left:'74%', width:'10%', animation:`prism-ray-sweep ${22+idx*2}s ease-in-out ${idx}s infinite` }} />

                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        {/* Worker info */}
                        <div className="flex-grow">
                          <h3 className="premium-heading text-lg font-bold text-[var(--heading-color)] mb-1.5">
                            {worker.firstName} {worker.lastName}
                          </h3>
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold mb-3"
                            style={isActive ? { background:'rgba(34,197,94,.10)', border:'1px solid rgba(34,197,94,.28)', color:'#22c55e' } : { background:'rgba(148,163,184,.10)', border:'1px solid rgba(148,163,184,.28)', color:'#94a3b8' }}>
                            {isActive ? ui.active : ui.inactive}
                          </span>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Mail size={13} className="text-primary flex-shrink-0" />
                              <span className="text-xs text-[var(--text-color)] break-all">{worker.email}</span>
                            </div>
                            {worker.phone && (
                              <div className="flex items-center gap-2">
                                <Phone size={13} className="text-secondary flex-shrink-0" />
                                <span className="text-xs text-[var(--text-color)]">{worker.phone}</span>
                              </div>
                            )}
                          </div>
                          {/* Type + short code + compensation badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {worker.staffType && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background:'rgba(14,165,160,.10)', border:'1px solid rgba(14,165,160,.25)', color:'#0ea5a0' }}>
                                {worker.staffType}
                              </span>
                            )}
                            {worker.shortCode && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono"
                                style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.30)', color:'#c8a96b' }}>
                                <Hash size={9} className="inline mr-0.5" />{worker.shortCode}
                              </span>
                            )}
                            {worker.vanRole === 'Driver' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background:'rgba(59,130,246,.10)', border:'1px solid rgba(59,130,246,.28)', color:'#3b82f6' }}>
                                Driver
                              </span>
                            )}
                            {worker.vanRole === 'Helper' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background:'rgba(168,85,247,.10)', border:'1px solid rgba(168,85,247,.28)', color:'#a855f7' }}>
                                Helper{worker.driverName ? ` of ${worker.driverName}` : ''}
                              </span>
                            )}
                            {worker.compensationType === 'Percentage' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background:'rgba(168,85,247,.10)', border:'1px solid rgba(168,85,247,.25)', color:'#a855f7' }}>
                                <Percent size={9} className="inline mr-0.5" />{worker.percentageRate ?? 0}% per job
                              </span>
                            ) : worker.monthlySalary != null ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background:'rgba(34,197,94,.10)', border:'1px solid rgba(34,197,94,.25)', color:'#22c55e' }}>
                                QAR {worker.monthlySalary.toLocaleString()}/mo
                              </span>
                            ) : null}
                          </div>
                          {/* Skills */}
                          {Array.isArray(worker.skills) && worker.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {worker.skills.slice(0, 4).map(s => (
                                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ background:'rgba(200,169,107,.07)', border:'1px solid rgba(200,169,107,.18)', color:'var(--muted-color)' }}>
                                  {s}
                                </span>
                              ))}
                              {worker.skills.length > 4 && (
                                <span className="text-[10px] text-[var(--muted-color)]">+{worker.skills.length - 4} more</span>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-[var(--muted-color)] mt-2">
                            Added {new Date(worker.createdAt).toLocaleDateString()}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <CalendarDays size={12} className="text-[var(--muted-color)]" />
                            <span className="text-[11px] text-[var(--muted-color)]">{worker.shiftStart||'09:00'} â€“ {worker.shiftEnd||'18:00'}</span>
                            {Array.isArray(worker.daySchedules) && worker.daySchedules.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {worker.daySchedules.length} custom day{worker.daySchedules.length > 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--muted-color)]">Â·</span>
                            <span className="text-[11px] text-[var(--muted-color)]">
                              {(worker.workingDays||'Mon-Fri').split(',').map(d=>d.trim().slice(0,3)).join(', ')}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => editingScheduleId === worker.id ? setEditingScheduleId(null) : openScheduleEdit(worker)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition">
                            <CalendarDays size={13} /> {ui.schedule}
                            {editingScheduleId === worker.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </button>
                          <button
                            onClick={() => editingVanRoleId === worker.id ? setEditingVanRoleId(null) : openVanRoleEdit(worker)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/8 transition">
                            <Users size={13}/> Van Role
                            {editingVanRoleId === worker.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </button>
                          <button
                            onClick={() => handleToggleWorkerStatus(worker)}
                            disabled={savingId === `status-${worker.id}`}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition disabled:opacity-50 ${isActive ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/8' : 'border-green-500/30 text-green-400 hover:bg-green-500/8'}`}>
                            {savingId === `status-${worker.id}` ? 'Saving...' : isActive ? ui.deactivate : ui.activate}
                          </button>
                          <button
                            onClick={() => handleDeleteWorker(worker.id, `${worker.firstName} ${worker.lastName}`)}
                            disabled={deletingId === worker.id}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-500/28 text-rose-400 text-xs font-bold hover:bg-rose-500/8 transition disabled:opacity-50">
                            <Trash2 size={13}/> {deletingId === worker.id ? ui.removing : ui.remove}
                          </button>
                        </div>
                      </div>

                      {/* â”€â”€ Schedule Editor â”€â”€ */}
                      {editingScheduleId === worker.id && (
                        <div className="mt-5 relative overflow-hidden rounded-xl border border-[var(--border-color)] p-5"
                          style={{ background:'rgba(200,169,107,.03)' }}>
                          <div className="absolute top-0 left-0 right-0 h-[2px]"
                            style={{ background:'linear-gradient(90deg,transparent,rgba(200,169,107,.55) 38%,rgba(14,165,160,.45) 62%,transparent)' }} />

                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-4">{ui.workingSchedule}</p>

                          {/* Default shift */}
                          <div className="mb-5 p-4 rounded-xl border border-[var(--border-color)]" style={{ background:'rgba(200,169,107,.04)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">Default shift (applies unless overridden)</p>
                            <div className="flex flex-wrap items-end gap-5">
                              <div>
                                <label className="field-label">Start</label>
                                <select value={scheduleData.shiftStart} onChange={e => setScheduleData(p => ({ ...p, shiftStart:e.target.value }))}
                                  className="px-3 py-2 border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                                  {SHIFT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="field-label">End</label>
                                <select value={scheduleData.shiftEnd} onChange={e => setScheduleData(p => ({ ...p, shiftEnd:e.target.value }))}
                                  className="px-3 py-2 border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                                  {SHIFT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Per-day grid */}
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">Days & per-day overrides</p>
                          <div className="grid gap-2">
                            {ALL_DAYS.map(day => {
                              const active = scheduleData.workingDays.includes(day);
                              const eff    = getEffectiveShift(day);
                              return (
                                <div key={day}
                                  className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${active ? 'border-[var(--border-color)]' : 'border-dashed border-[var(--border-color)] opacity-50'}`}
                                  style={active ? { background:'rgba(200,169,107,.04)' } : {}}>
                                  <button type="button" onClick={() => toggleDay(day)}
                                    className={`w-24 shrink-0 px-2 py-1 rounded-lg text-xs font-bold border transition-all ${active ? 'bg-primary text-white border-primary' : 'border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--muted-color)]'}`}>
                                    {day.slice(0,3)}
                                  </button>
                                  {active && (
                                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                                      {/* start */}
                                      <select value={eff.start} onChange={e => setDayOverride(day,'start',e.target.value)}
                                        className="px-2 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                                        style={eff.custom ? { borderColor:'rgba(200,169,107,.55)', background:'rgba(200,169,107,.10)', color:'#c8a96b', fontWeight:700 } : { border:'1px solid var(--border-color)', background:'var(--surface-bg)', color:'var(--text-color)' }}>
                                        {SHIFT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                      </select>
                                      <span className="text-xs text-[var(--muted-color)]">to</span>
                                      {/* end */}
                                      <select value={eff.end} onChange={e => setDayOverride(day,'end',e.target.value)}
                                        className="px-2 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                                        style={eff.custom ? { borderColor:'rgba(200,169,107,.55)', background:'rgba(200,169,107,.10)', color:'#c8a96b', fontWeight:700 } : { border:'1px solid var(--border-color)', background:'var(--surface-bg)', color:'var(--text-color)' }}>
                                        {SHIFT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                      </select>
                                      {eff.custom  && <button type="button" onClick={() => clearDayOverride(day)} className="text-xs text-rose-400 hover:underline ml-1">reset</button>}
                                      {!eff.custom && <span className="text-xs text-[var(--muted-color)] italic">default</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex gap-2 mt-5">
                            <div className="cta-prism-glow rounded-xl inline-flex">
                              <button onClick={() => handleSaveSchedule(worker.id)}
                                disabled={scheduleSavingId === worker.id || scheduleData.workingDays.length === 0}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                                <Save size={13}/> {scheduleSavingId === worker.id ? 'Saving...' : ui.saveSchedule}
                              </button>
                            </div>
                            <button onClick={() => setEditingScheduleId(null)}
                              className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                              {ui.cancel}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* â”€â”€ Van Role Editor â”€â”€ */}
                      {editingVanRoleId === worker.id && (
                        <div className="mt-4 relative overflow-hidden rounded-xl border border-blue-500/20 p-5"
                          style={{ background:'rgba(59,130,246,.04)' }}>
                          <div className="absolute top-0 left-0 right-0 h-[2px]"
                            style={{ background:'linear-gradient(90deg,transparent,rgba(59,130,246,.55) 50%,transparent)' }} />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-4">Van Role</p>
                          <div className="flex flex-wrap gap-4 items-end">
                            <div>
                              <label className="field-label">Role</label>
                              <select className="field-input" value={vanRoleForm.vanRole}
                                onChange={e => setVanRoleForm(f => ({ ...f, vanRole: e.target.value, driverId: e.target.value !== 'Helper' ? '' : f.driverId }))}>
                                <option value="">None</option>
                                <option value="Driver">Driver</option>
                                <option value="Helper">Helper</option>
                              </select>
                            </div>
                            {vanRoleForm.vanRole === 'Helper' && (
                              <div className="flex-1 min-w-[200px]">
                                <label className="field-label">Linked Driver</label>
                                <select className="field-input" value={vanRoleForm.driverId}
                                  onChange={e => setVanRoleForm(f => ({ ...f, driverId: e.target.value }))}>
                                  <option value="">-- Select driver --</option>
                                  {workers.filter(w => w.id !== worker.id && (w.vanRole === 'Driver' || !w.vanRole)).map(d => (
                                    <option key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.shortCode ? ` (${d.shortCode})` : ''}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveVanRole(worker.id)}
                                disabled={vanRoleSavingId === worker.id || (vanRoleForm.vanRole === 'Helper' && !vanRoleForm.driverId)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
                                <Save size={13} className="inline mr-1.5" />{vanRoleSavingId === worker.id ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditingVanRoleId(null)}
                                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* â”€â”€ Stats â”€â”€ */}
          {workers.length > 0 && (
            <div className="glass-card relative overflow-hidden card-stagger mt-4">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
              <div className="p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-5">{ui.staffStats}</p>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label:ui.totalDetailers, value: workers.length,                                                                color:'var(--heading-color)' },
                    { label:'Active',           value: workers.filter(w => w.isActive !== false).length,                              color:'#22c55e' },
                    { label:ui.lastAdded,       value: workers.length > 0 ? new Date(Math.max(...workers.map(w => new Date(w.createdAt)))).toLocaleDateString() : 'â€”', color:'var(--text-color)', small:true },
                  ].map(({ label, value, color, small }) => (
                    <div key={label} className="rounded-xl border border-[var(--border-color)] p-4" style={{ background:'rgba(200,169,107,.04)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">{label}</p>
                      <p className={`font-black ${small ? 'text-base' : 'text-3xl'}`} style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payroll is managed on /admin/payroll */}

        </div>
      </div>

      <AppModal isOpen={payModal.open} title="Confirm Payment" message={`Pay QAR ${payModal.worker?.estimatedSalary?.toLocaleString()} to ${payModal.worker?.workerName}?`} variant="info" confirmLabel="Yes, Pay" cancelLabel="Cancel" onConfirm={payModal.onConfirm} onClose={closePayModal} />

      <AppModal isOpen={detailsModal.open} title="Pay Slip" message="" variant="info" onClose={closeDetailsModal}>
{detailsModal.worker && (() => {
          const worker = detailsModal.worker;
          const companyName = business.name || 'Flowly';
          const companyAddress = business.location || '';
          const companyPhone = business.phone || '';
          const companyEmail = business.email || '';
          const footerText = '';
          const payPeriod = ['January','February','March','April','May','June','July','August','September','October','November','December'][payrollMonth-1] + ' ' + payrollYear;
          const status = worker.isPaid ? 'PAID' : 'UNPAID';
          const statusColor = worker.isPaid ? '#22c55e' : '#fbbf24';
          const statusBg = worker.isPaid ? 'rgba(34,197,94,.10)' : 'rgba(251,191,36,.10)';

          const htmlSlip = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pay Slip - ${worker.workerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; padding: 20px; }
    .payslip { max-width: 600px; margin: 0 auto; border: 2px solid #c8a96b; }
    .header { background: #c8a96b; color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 24px; margin-bottom: 5px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .company-info { background: #f9f9f9; padding: 15px 20px; border-bottom: 1px solid #ddd; }
    .company-info p { margin: 2px 0; font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: bold; font-size: 10px; text-transform: uppercase; color: #666; }
    .number { text-align: right; }
    .label-col { width: 70%; }
    .value-col { width: 30%; }
    .summary { background: ${statusBg}; padding: 20px; text-align: center; }
    .summary .amount { font-size: 24px; font-weight: bold; color: #c8a96b; }
    .summary .status { font-size: 14px; font-weight: bold; color: ${statusColor}; }
    .footer { background: #f9f9f9; padding: 15px 20px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 11px; background: ${statusBg}; color: ${statusColor}; }
  </style>
</head>
<body>
  <div class="payslip">
    <div class="header">
      <h1>${companyName}</h1>
      <p>PAYSLIP</p>
    </div>
    <div class="company-info">
      <p><strong>Address:</strong> ${companyAddress || 'Qatar'}</p>
      <p><strong>Phone:</strong> ${companyPhone || '+974XXXXXXXX'}</p>
      <p><strong>Email:</strong> ${companyEmail || 'info@flowly.qa'}</p>
    </div>
    <table>
      <thead><tr><th colspan="2">Employee Information</th></tr></thead>
      <tr>
        <td class="label-col"><strong>Employee Name</strong></td>
        <td class="value-col">${worker.workerName}</td>
      </tr>
      <tr>
        <td class="label-col"><strong>Role</strong></td>
        <td class="value-col">Detailer</td>
      </tr>
      <tr>
        <td class="label-col"><strong>Pay Period</strong></td>
        <td class="value-col">${payPeriod}</td>
      </tr>
      <tr>
        <td class="label-col"><strong>Payment Status</strong></td>
        <td class="value-col"><span class="status-badge">${status}</span></td>
      </tr>
    </table>
    <table>
      <thead><tr><th colspan="2">Salary Breakdown</th></tr></thead>
      <tr>
        <td class="label-col">Monthly Salary</td>
        <td class="value-col number">QAR ${(worker.monthlySalary || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td class="label-col">Jobs Completed</td>
        <td class="value-col number">${worker.jobsCompleted || 0}</td>
      </tr>
      <tr>
        <td class="label-col">Revenue Generated</td>
        <td class="value-col number">QAR ${(worker.totalRevenue || 0).toLocaleString()}</td>
      </tr>
    </table>
    <div class="summary">
      <div class="amount">QAR ${(worker.monthlySalary || 0).toLocaleString()}</div>
      <div class="status">${status}</div>
      ${worker.isPaid && worker.paidAt ? `<div style="font-size:10px;color:#666;margin-top:5px;">Paid on: ${new Date(worker.paidAt).toLocaleDateString()}</div>` : ''}
    </div>
    <div class="footer">
      <p>${footerText || 'This is a system-generated payslip and does not require signature.'}</p>
      <p style="margin-top:5px;">Generated: ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`.trim();

          const _downloadSlip = () => {
            const blob = new Blob([htmlSlip], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PaySlip_${worker.workerName?.replace(/\s+/g, '_')}_${payrollMonth}_${payrollYear}.html`;
            a.click();
            URL.revokeObjectURL(url);
          };

          const downloadPdf = () => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(htmlSlip);
              printWindow.document.close();
              printWindow.print();
            }
          };

          const downloadTxt = () => {
            const txt = `
========================================
              PAYSLIP
========================================
Company: ${companyName}
${companyAddress ? 'Address: ' + companyAddress : ''}
${companyPhone ? 'Phone: ' + companyPhone : ''}
${companyEmail ? 'Email: ' + companyEmail : ''}
========================================

EMPLOYEE INFORMATION
----------------------------------------
Employee Name    : ${worker.workerName}
Role             : Detailer
Pay Period       : ${payPeriod}
Payment Status  : ${status}
${worker.isPaid && worker.paidAt ? 'Paid On          : ' + new Date(worker.paidAt).toLocaleDateString() : ''}

SALARY BREAKDOWN
----------------------------------------
Monthly Salary    : QAR ${(worker.monthlySalary || 0).toLocaleString()}
Jobs Completed   : ${worker.jobsCompleted || 0}
Revenue Gen.    : QAR ${(worker.totalRevenue || 0).toLocaleString()}

----------------------------------------
NET SALARY       : QAR ${(worker.monthlySalary || 0).toLocaleString()}
STATUS         : ${status}
========================================

${footerText || 'This is a system-generated payslip and does not require signature.'}
Generated: ${new Date().toLocaleString()}
========================================`.trim();
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PaySlip_${worker.workerName?.replace(/\s+/g, '_')}_${payrollMonth}_${payrollYear}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          };

          return (
          <div className="text-sm space-y-4">
            <div className="rounded-lg border overflow-hidden" style={{ borderColor:'rgba(200,169,107,.3)' }}>
              <div className="px-4 py-3 text-center" style={{ background:'#c8a96b' }}>
                <p className="font-black text-lg text-white">{companyName}</p>
                <p className="text-xs text-white/90">PAYSLIP</p>
              </div>
              <div className="px-4 py-2 text-xs" style={{ background:'rgba(200,169,107,.08)', borderBottom:'1px solid rgba(200,169,107,.2)' }}>
                <p className="text-[var(--muted-color)]">${companyAddress || 'Qatar'} Â· ${companyPhone || '+974XXXXXXXX'} Â· ${companyEmail || 'info@flowly.qa'}</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background:'rgba(200,169,107,.05)' }}>
                    <th colSpan={2} className="px-4 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--muted-color)]">Employee Information</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Employee Name</td><td className="px-4 py-2 font-medium text-right">{worker.workerName}</td></tr>
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Role</td><td className="px-4 py-2 font-medium text-right">Detailer</td></tr>
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Pay Period</td><td className="px-4 py-2 font-medium text-right">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][payrollMonth-1]} {payrollYear}</td></tr>
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Payment Status</td><td className="px-4 py-2 text-right"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: statusBg, color: statusColor }}>{status}</span></td></tr>
                </tbody>
              </table>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background:'rgba(200,169,107,.05)' }}>
                    <th colSpan={2} className="px-4 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--muted-color)]">Salary Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Monthly Salary</td><td className="px-4 py-2 font-black text-primary text-right">QAR {(worker.monthlySalary || 0).toLocaleString()}</td></tr>
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Jobs Completed</td><td className="px-4 py-2 font-medium text-right">{worker.jobsCompleted || 0}</td></tr>
                  <tr><td className="px-4 py-2 text-[var(--muted-color)]">Revenue Generated</td><td className="px-4 py-2 font-bold text-green-500 text-right">QAR {(worker.totalRevenue || 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
              <div className="px-4 py-4 text-center" style={{ background: statusBg }}>
                <p className="font-black text-2xl text-primary">QAR {(worker.monthlySalary || 0).toLocaleString()}</p>
                <p className="text-sm font-bold" style={{ color: statusColor }}>{status}</p>
                {worker.isPaid && worker.paidAt && <p className="text-xs text-[var(--muted-color)] mt-1">Paid on: {new Date(worker.paidAt).toLocaleDateString()}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadPdf} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex items-center justify-center gap-2">
                <FileText size={14} /> Print / PDF
              </button>
              <button onClick={downloadTxt} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex items-center justify-center gap-2">
                <Download size={14} /> Download TXT
              </button>
            </div>
            {!worker.isPaid && worker.monthlySalary != null && (
              <button onClick={async () => {
                try {
                  await authAPI.markWorkerPaid(worker.workerId, payrollMonth, payrollYear);
                  closeDetailsModal();
                  await fetchWorkers();
                  toast.success('Payment recorded!');
                } catch (err) { toast.error(err?.response?.data?.message || 'Failed to record payment'); }
              }} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition flex items-center justify-center gap-2">
                <Wallet size={14} /> Pay Now
              </button>
            )}
            <button onClick={closeDetailsModal} className="w-full py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
              Close
            </button>
          </div>
          );
        })()}
      </AppModal>
    </>
  );
}
export default ManageStaff;
