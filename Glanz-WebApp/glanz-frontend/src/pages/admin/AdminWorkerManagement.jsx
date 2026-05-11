import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Calendar, AlertCircle, XCircle, Users, ChevronRight, X } from 'lucide-react';
import { authAPI } from '../../api/auth';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { useLanguage } from '../../context/LanguageContext';
import { forceStopWorker } from '../../api/realtimeService';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFT_HOURS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
const SHIFTS = [
  { key: 'earlyMorning', start: '06:00', end: '14:00' },
  { key: 'morning', start: '07:00', end: '15:00' },
  { key: 'lateMorning', start: '08:00', end: '16:00' },
  { key: 'afternoon', start: '12:00', end: '20:00' },
  { key: 'evening', start: '14:00', end: '22:00' },
  { key: 'night', start: '20:00', end: '06:00' },
];

const UI_BY_LANG = {
  en: {
    failedToLoadWorkers: 'Failed to load workers.',
    failedToUpdateStatus: 'Failed to update status.',
    failedToSaveSchedule: 'Failed to save schedule.',
    failedToLoadWorkersTitle: 'Failed to load workers',
    tryAgain: 'Try Again',
    noWorkers: 'No workers',
    noWorkersDescription: 'No workers have been added yet.',
    staff: 'Staff',
    workerShifts: 'Worker Shifts',
    allStaff: 'All Staff',
    searchWorkers: 'Search workers...',
    active: 'Active',
    inactive: 'Inactive',
    customDay: 'custom day',
    customDays: 'custom days',
    forceStopConfirm: 'Force-stop live tracking for {{name}}?',
    forceStopTracking: 'Force Stop Tracking',
    editSchedule: 'Edit Schedule',
    editScheduleHint: 'Keep preset choices. See exact times. Adjust custom hours when needed.',
    defaultShift: 'Default Shift',
    workingDays: 'Working Days',
    customDaysLabel: 'Custom Days',
    shiftPresets: 'Shift Presets',
    customDefaultStart: 'Custom Default Start',
    customDefaultEnd: 'Custom Default End',
    perDayCustomHours: 'Per-Day Custom Hours',
    usesDefaultShift: 'Uses default shift unless overridden below',
    selectWorkingDaysFirst: 'Select working days first.',
    customHours: 'Custom hours: {{timeRange}}',
    usingDefault: 'Using default: {{timeRange}}',
    resetToDefault: 'Reset to Default',
    setCustomHours: 'Set Custom Hours',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveChanges: 'Save Changes',
    noSchedule: 'No schedule',
    dayShort: {
      Monday: 'Mon',
      Tuesday: 'Tue',
      Wednesday: 'Wed',
      Thursday: 'Thu',
      Friday: 'Fri',
      Saturday: 'Sat',
      Sunday: 'Sun',
    },
    shifts: {
      earlyMorning: 'Early Morning',
      morning: 'Morning',
      lateMorning: 'Late Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    },
  },
  ar: {
    failedToLoadWorkers: 'فشل تحميل العاملين.',
    failedToUpdateStatus: 'فشل تحديث الحالة.',
    failedToSaveSchedule: 'فشل حفظ الجدول.',
    failedToLoadWorkersTitle: 'تعذر تحميل العاملين',
    tryAgain: 'حاول مرة أخرى',
    noWorkers: 'لا يوجد عاملون',
    noWorkersDescription: 'لم تتم إضافة أي عاملين بعد.',
    staff: 'الفريق',
    workerShifts: 'نوبات العاملين',
    allStaff: 'كل الفريق',
    searchWorkers: 'ابحث عن عامل...',
    active: 'نشط',
    inactive: 'غير نشط',
    customDay: 'يوم مخصص',
    customDays: 'أيام مخصصة',
    forceStopConfirm: 'هل تريد إيقاف التتبع المباشر لـ {{name}}؟',
    forceStopTracking: 'إيقاف التتبع',
    editSchedule: 'تعديل الجدول',
    editScheduleHint: 'احتفظ بالإعدادات الجاهزة. اعرض الأوقات الدقيقة. عدل الساعات المخصصة عند الحاجة.',
    defaultShift: 'النوبة الافتراضية',
    workingDays: 'أيام العمل',
    customDaysLabel: 'الأيام المخصصة',
    shiftPresets: 'النوبات الجاهزة',
    customDefaultStart: 'بداية افتراضية مخصصة',
    customDefaultEnd: 'نهاية افتراضية مخصصة',
    perDayCustomHours: 'ساعات مخصصة لكل يوم',
    usesDefaultShift: 'يستخدم النوبة الافتراضية ما لم يتم التخصيص بالأسفل',
    selectWorkingDaysFirst: 'اختر أيام العمل أولاً.',
    customHours: 'ساعات مخصصة: {{timeRange}}',
    usingDefault: 'استخدام الافتراضي: {{timeRange}}',
    resetToDefault: 'إعادة للافتراضي',
    setCustomHours: 'تعيين ساعات مخصصة',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ...',
    saveChanges: 'حفظ التغييرات',
    noSchedule: 'لا يوجد جدول',
    dayShort: {
      Monday: 'الاث',
      Tuesday: 'الثل',
      Wednesday: 'الأر',
      Thursday: 'الخم',
      Friday: 'الج',
      Saturday: 'السب',
      Sunday: 'الأح',
    },
    shifts: {
      earlyMorning: 'فجر',
      morning: 'صباح',
      lateMorning: 'صباح متأخر',
      afternoon: 'بعد الظهر',
      evening: 'مساء',
      night: 'ليل',
    },
  },
  de: {
    failedToLoadWorkers: 'Mitarbeiter konnten nicht geladen werden.',
    failedToUpdateStatus: 'Status konnte nicht aktualisiert werden.',
    failedToSaveSchedule: 'Zeitplan konnte nicht gespeichert werden.',
    failedToLoadWorkersTitle: 'Mitarbeiter konnten nicht geladen werden',
    tryAgain: 'Erneut versuchen',
    noWorkers: 'Keine Mitarbeiter',
    noWorkersDescription: 'Es wurden noch keine Mitarbeiter hinzugefugt.',
    staff: 'Team',
    workerShifts: 'Mitarbeiter-Schichten',
    allStaff: 'Gesamtes Team',
    searchWorkers: 'Mitarbeiter suchen...',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    customDay: 'Sondertag',
    customDays: 'Sondertage',
    forceStopConfirm: 'Live-Tracking fur {{name}} erzwingen beenden?',
    forceStopTracking: 'Tracking sofort stoppen',
    editSchedule: 'Zeitplan bearbeiten',
    editScheduleHint: 'Voreinstellungen beibehalten. Exakte Zeiten sehen. Bei Bedarf individuelle Stunden anpassen.',
    defaultShift: 'Standardschicht',
    workingDays: 'Arbeitstage',
    customDaysLabel: 'Sondertage',
    shiftPresets: 'Schichtvorlagen',
    customDefaultStart: 'Benutzerdefinierter Standardstart',
    customDefaultEnd: 'Benutzerdefiniertes Standardende',
    perDayCustomHours: 'Individuelle Stunden pro Tag',
    usesDefaultShift: 'Verwendet die Standardschicht, sofern unten nicht uberschrieben',
    selectWorkingDaysFirst: 'Wahle zuerst Arbeitstage aus.',
    customHours: 'Individuelle Stunden: {{timeRange}}',
    usingDefault: 'Standard verwendet: {{timeRange}}',
    resetToDefault: 'Auf Standard zurucksetzen',
    setCustomHours: 'Individuelle Stunden setzen',
    cancel: 'Abbrechen',
    saving: 'Speichern...',
    saveChanges: 'Anderungen speichern',
    noSchedule: 'Kein Zeitplan',
    dayShort: {
      Monday: 'Mo',
      Tuesday: 'Di',
      Wednesday: 'Mi',
      Thursday: 'Do',
      Friday: 'Fr',
      Saturday: 'Sa',
      Sunday: 'So',
    },
    shifts: {
      earlyMorning: 'Fruher Morgen',
      morning: 'Morgen',
      lateMorning: 'Spater Morgen',
      afternoon: 'Nachmittag',
      evening: 'Abend',
      night: 'Nacht',
    },
  },
};

function translateInline(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}

function getShortDayLabel(day, ui) {
  return ui.dayShort?.[day] || day.slice(0, 3);
}

function parseSchedule(worker) {
  const workingDays = worker.workingDays
    ? worker.workingDays.split(',').map((d) => d.trim()).filter(Boolean)
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const dayOverrides = {};
  if (Array.isArray(worker.daySchedules)) {
    for (const entry of worker.daySchedules) {
      if (entry.day) {
        dayOverrides[entry.day] = {
          start: entry.shiftStart || worker.shiftStart || '09:00',
          end: entry.shiftEnd || worker.shiftEnd || '18:00',
        };
      }
    }
  }

  return {
    workingDays,
    shiftStart: worker.shiftStart || '09:00',
    shiftEnd: worker.shiftEnd || '18:00',
    dayOverrides,
  };
}

function formatTimeRange(start, end) {
  return `${start || '--:--'} - ${end || '--:--'}`;
}

function summarizeWorkingDays(workingDays, ui) {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return ui.noSchedule;
  return workingDays.map((day) => getShortDayLabel(day, ui)).join(', ');
}

export default function WorkerManagement() {
  const { lang } = useLanguage();
  const ui = UI_BY_LANG[lang] || UI_BY_LANG.en;
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editWorker, setEditWorker] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchWorkers(); }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getWorkers();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || ui.failedToLoadWorkers);
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (workerId, currentStatus) => {
    try {
      setSaving(true);
      await authAPI.updateWorkerStatus(workerId, !currentStatus);
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, isActive: !currentStatus } : w));
    } catch (err) {
      alert(err?.response?.data?.message || ui.failedToUpdateStatus);
    } finally { setSaving(false); }
  };

  const handleSaveSchedule = async () => {
    if (!editWorker) return;
    try {
      setSaving(true);
      const daySchedules = Object.entries(editWorker.dayOverrides || {}).map(([day, value]) => ({
        day,
        shiftStart: value.start,
        shiftEnd: value.end,
      }));
      await authAPI.updateWorkerSchedule(editWorker.id, {
        workingDays: editWorker.workingDays.join(','),
        shiftStart: editWorker.shiftStart,
        shiftEnd: editWorker.shiftEnd,
        daySchedules: daySchedules.length > 0 ? daySchedules : null,
      });
      await fetchWorkers();
      setEditWorker(null);
    } catch (err) {
      alert(err?.response?.data?.message || ui.failedToSaveSchedule);
    } finally { setSaving(false); }
  };

  const getEffectiveShift = (day) => {
    const override = editWorker?.dayOverrides?.[day];
    if (override) return { ...override, custom: true };
    return {
      start: editWorker?.shiftStart || '09:00',
      end: editWorker?.shiftEnd || '18:00',
      custom: false,
    };
  };

  const filteredWorkers = workers.filter(w => 
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) || w.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen py-10" style={{ background: 'var(--surface-bg)' }}>
        <div className="container mx-auto px-4">
          <Skeleton variant="text" className="w-32 h-8 mb-6" />
          <div className="grid gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} variant="card" className="h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title={ui.failedToLoadWorkersTitle} description={error} actionLabel={ui.tryAgain} onAction={fetchWorkers} />
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="users" title={ui.noWorkers} description={ui.noWorkersDescription} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10" style={{ background: 'var(--surface-bg)' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">{ui.staff}</p>
            <h1 className="text-2xl font-bold text-[var(--heading-color)]">{ui.workerShifts}</h1>
          </div>
          <Link to="/admin/staff" className="btn-secondary">
            <Users size={16} /> {ui.allStaff}
          </Link>
        </div>

        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
            <input
              type="text"
              placeholder={ui.searchWorkers}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--text-color)]"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="grid gap-4">
          {filteredWorkers.map(worker => (
            <div key={worker.id} className="glass-card rounded-xl p-4">
              {(() => {
                const parsed = parseSchedule(worker);
                const customDays = Object.keys(parsed.dayOverrides);
                return (
                  <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-semibold">{worker.name?.[0]?.toUpperCase() || 'W'}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--heading-color)]">{worker.name}</h3>
                    <p className="text-sm text-[var(--muted-color)]">{worker.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(worker.id, worker.isActive)}
                  disabled={saving}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${worker.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                >
                  {worker.isActive ? ui.active : ui.inactive}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-color)]/30">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[var(--muted-color)]">
                    <Clock size={14} />
                    <span>{formatTimeRange(parsed.shiftStart, parsed.shiftEnd)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-color)]">
                    <Calendar size={14} />
                    <span>{summarizeWorkingDays(parsed.workingDays, ui)}</span>
                  </div>
                  {customDays.length > 0 && (
                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/25">
                      {customDays.length} {customDays.length > 1 ? ui.customDays : ui.customDay}
                    </span>
                  )}
                </div>
                {customDays.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customDays.map((day) => (
                      <span key={day} className="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--muted-color)]">
                        {getShortDayLabel(day, ui)} {formatTimeRange(parsed.dayOverrides[day].start, parsed.dayOverrides[day].end)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (window.confirm(translateInline(ui.forceStopConfirm, { name: worker.name }))) {
                    forceStopWorker(worker.id);
                  }
                }}
                className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <XCircle size={12} />
                {ui.forceStopTracking}
              </button>

              <button
                onClick={() => setEditWorker({ ...worker, ...parseSchedule(worker) })}
                className="mt-3 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <ChevronRight size={14} className="-rotate-90" /> {ui.editSchedule}
              </button>
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {editWorker && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[var(--heading-color)]">{ui.editSchedule}</h3>
                  <p className="text-sm text-[var(--muted-color)] mt-1">{ui.editScheduleHint}</p>
                </div>
                <button onClick={() => setEditWorker(null)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X size={18} className="text-[var(--muted-color)]" />
                </button>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">{ui.defaultShift}</p>
                    <p className="font-semibold text-[var(--heading-color)]">{formatTimeRange(editWorker.shiftStart, editWorker.shiftEnd)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">{ui.workingDays}</p>
                    <p className="font-semibold text-[var(--heading-color)]">{editWorker.workingDays.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">{ui.customDaysLabel}</p>
                    <p className="font-semibold text-[var(--heading-color)]">{Object.keys(editWorker.dayOverrides || {}).length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">{ui.workingDays}</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = editWorker.workingDays || [];
                          const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
                          const nextOverrides = { ...(editWorker.dayOverrides || {}) };
                          if (!newDays.includes(day)) delete nextOverrides[day];
                          setEditWorker({ ...editWorker, workingDays: newDays, dayOverrides: nextOverrides });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm ${editWorker.workingDays.includes(day) ? 'bg-primary text-white' : 'bg-[var(--surface-bg)] text-[var(--muted-color)]'}`}
                      >
                        {getShortDayLabel(day, ui)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">{ui.shiftPresets}</label>
                  <div className="grid md:grid-cols-2 gap-2">
                    {SHIFTS.map(shift => (
                      <button
                        key={shift.key}
                        onClick={() => setEditWorker({ ...editWorker, shiftStart: shift.start, shiftEnd: shift.end })}
                        className={`px-3 py-3 rounded-xl text-left border transition ${editWorker.shiftStart === shift.start && editWorker.shiftEnd === shift.end ? 'bg-primary/15 text-white border-primary/40' : 'bg-[var(--surface-bg)] text-[var(--muted-color)] border-[var(--border-color)]'}`}
                      >
                        <span className="block font-semibold text-sm">{ui.shifts?.[shift.key] || shift.key}</span>
                        <span className="block text-xs mt-1 opacity-80">{formatTimeRange(shift.start, shift.end)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">{ui.customDefaultStart}</label>
                    <select
                      value={editWorker.shiftStart}
                      onChange={(e) => setEditWorker({ ...editWorker, shiftStart: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--text-color)]"
                    >
                      {SHIFT_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">{ui.customDefaultEnd}</label>
                    <select
                      value={editWorker.shiftEnd}
                      onChange={(e) => setEditWorker({ ...editWorker, shiftEnd: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--text-color)]"
                    >
                      {SHIFT_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)]">{ui.perDayCustomHours}</label>
                    <span className="text-xs text-[var(--muted-color)]">{ui.usesDefaultShift}</span>
                  </div>

                  <div className="space-y-3">
                    {editWorker.workingDays.length === 0 ? (
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4 text-sm text-[var(--muted-color)]">
                        {ui.selectWorkingDaysFirst}
                      </div>
                    ) : editWorker.workingDays.map((day) => {
                      const effective = getEffectiveShift(day);
                      return (
                        <div key={day} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-[var(--heading-color)]">{day}</p>
                              <p className="text-xs text-[var(--muted-color)] mt-1">
                                {effective.custom
                                  ? translateInline(ui.customHours, { timeRange: formatTimeRange(effective.start, effective.end) })
                                  : translateInline(ui.usingDefault, { timeRange: formatTimeRange(editWorker.shiftStart, editWorker.shiftEnd) })}
                              </p>
                            </div>
                            {effective.custom ? (
                              <button
                                onClick={() => {
                                  const nextOverrides = { ...(editWorker.dayOverrides || {}) };
                                  delete nextOverrides[day];
                                  setEditWorker({ ...editWorker, dayOverrides: nextOverrides });
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--text-color)]"
                              >
                                {ui.resetToDefault}
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditWorker({
                                  ...editWorker,
                                  dayOverrides: {
                                    ...(editWorker.dayOverrides || {}),
                                    [day]: { start: editWorker.shiftStart, end: editWorker.shiftEnd },
                                  },
                                })}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/25"
                              >
                                {ui.setCustomHours}
                              </button>
                            )}
                          </div>

                          {effective.custom && (
                            <div className="grid md:grid-cols-2 gap-3">
                              <select
                                value={effective.start}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  dayOverrides: {
                                    ...(editWorker.dayOverrides || {}),
                                    [day]: { ...(editWorker.dayOverrides?.[day] || {}), start: e.target.value, end: effective.end },
                                  },
                                })}
                                className="w-full px-3 py-2.5 rounded-xl bg-black/10 border border-[var(--border-color)] text-[var(--text-color)]"
                              >
                                {SHIFT_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                              </select>
                              <select
                                value={effective.end}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  dayOverrides: {
                                    ...(editWorker.dayOverrides || {}),
                                    [day]: { ...(editWorker.dayOverrides?.[day] || {}), start: effective.start, end: e.target.value },
                                  },
                                })}
                                className="w-full px-3 py-2.5 rounded-xl bg-black/10 border border-[var(--border-color)] text-[var(--text-color)]"
                              >
                                {SHIFT_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditWorker(null)} className="flex-1 py-2.5 rounded-xl bg-[var(--surface-bg)] text-[var(--text-color)]">
                  {ui.cancel}
                </button>
                <button onClick={handleSaveSchedule} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold">
                  {saving ? ui.saving : ui.saveChanges}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}