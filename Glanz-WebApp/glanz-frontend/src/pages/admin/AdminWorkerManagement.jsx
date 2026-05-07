import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Calendar, AlertCircle, CheckCircle, XCircle, RefreshCw, Users, ChevronRight, UserCheck, X } from 'lucide-react';
import { authAPI } from '../../api/auth';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { useLanguage } from '../../context/LanguageContext';
import { forceStopWorker } from '../../api/realtimeService';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFT_HOURS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
const SHIFTS = [
  { label: 'Early Morning', start: '06:00', end: '14:00' },
  { label: 'Morning', start: '07:00', end: '15:00' },
  { label: 'Late Morning', start: '08:00', end: '16:00' },
  { label: 'Afternoon', start: '12:00', end: '20:00' },
  { label: 'Evening', start: '14:00', end: '22:00' },
  { label: 'Night', start: '20:00', end: '06:00' },
];

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

function summarizeWorkingDays(workingDays) {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return 'No schedule';
  return workingDays.map((day) => day.slice(0, 3)).join(', ');
}

export default function WorkerManagement() {
  const { t } = useLanguage();
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
      setError(err?.response?.data?.message || 'Failed to load workers.');
    } finally { setLoading(false); }
  };

  const handleToggleActive = async (workerId, currentStatus) => {
    try {
      setSaving(true);
      await authAPI.updateWorkerStatus(workerId, !currentStatus);
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, isActive: !currentStatus } : w));
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update status.');
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
      alert(err?.response?.data?.message || 'Failed to save schedule.');
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
        <EmptyState icon="alert" title="Failed to load workers" description={error} actionLabel="Try Again" onAction={fetchWorkers} />
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="users" title="No workers" description="No workers have been added yet." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10" style={{ background: 'var(--surface-bg)' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Staff</p>
            <h1 className="text-2xl font-bold text-[var(--heading-color)]">Worker Shifts</h1>
          </div>
          <Link to="/admin/staff" className="btn-secondary">
            <Users size={16} /> All Staff
          </Link>
        </div>

        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
            <input
              type="text"
              placeholder="Search workers..."
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
                  {worker.isActive ? 'Active' : 'Inactive'}
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
                    <span>{summarizeWorkingDays(parsed.workingDays)}</span>
                  </div>
                  {customDays.length > 0 && (
                    <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/25">
                      {customDays.length} custom day{customDays.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {customDays.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customDays.map((day) => (
                      <span key={day} className="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--muted-color)]">
                        {day.slice(0, 3)} {formatTimeRange(parsed.dayOverrides[day].start, parsed.dayOverrides[day].end)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (window.confirm(`Force-stop live tracking for ${worker.name}?`)) {
                    forceStopWorker(worker.id);
                  }
                }}
                className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <XCircle size={12} />
                Force Stop Tracking
              </button>

              <button
                onClick={() => setEditWorker({ ...worker, ...parseSchedule(worker) })}
                className="mt-3 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <ChevronRight size={14} className="-rotate-90" /> Edit Schedule
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
                  <h3 className="text-lg font-bold text-[var(--heading-color)]">Edit Schedule</h3>
                  <p className="text-sm text-[var(--muted-color)] mt-1">Keep preset choices. See exact times. Adjust custom hours when needed.</p>
                </div>
                <button onClick={() => setEditWorker(null)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X size={18} className="text-[var(--muted-color)]" />
                </button>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">Default Shift</p>
                    <p className="font-semibold text-[var(--heading-color)]">{formatTimeRange(editWorker.shiftStart, editWorker.shiftEnd)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">Working Days</p>
                    <p className="font-semibold text-[var(--heading-color)]">{editWorker.workingDays.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted-color)] mb-1">Custom Days</p>
                    <p className="font-semibold text-[var(--heading-color)]">{Object.keys(editWorker.dayOverrides || {}).length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Working Days</label>
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
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Shift Presets</label>
                  <div className="grid md:grid-cols-2 gap-2">
                    {SHIFTS.map(shift => (
                      <button
                        key={shift.label}
                        onClick={() => setEditWorker({ ...editWorker, shiftStart: shift.start, shiftEnd: shift.end })}
                        className={`px-3 py-3 rounded-xl text-left border transition ${editWorker.shiftStart === shift.start && editWorker.shiftEnd === shift.end ? 'bg-primary/15 text-white border-primary/40' : 'bg-[var(--surface-bg)] text-[var(--muted-color)] border-[var(--border-color)]'}`}
                      >
                        <span className="block font-semibold text-sm">{shift.label}</span>
                        <span className="block text-xs mt-1 opacity-80">{formatTimeRange(shift.start, shift.end)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Custom Default Start</label>
                    <select
                      value={editWorker.shiftStart}
                      onChange={(e) => setEditWorker({ ...editWorker, shiftStart: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-color)] text-[var(--text-color)]"
                    >
                      {SHIFT_HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Custom Default End</label>
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
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)]">Per-Day Custom Hours</label>
                    <span className="text-xs text-[var(--muted-color)]">Uses default shift unless overridden below</span>
                  </div>

                  <div className="space-y-3">
                    {editWorker.workingDays.length === 0 ? (
                      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4 text-sm text-[var(--muted-color)]">
                        Select working days first.
                      </div>
                    ) : editWorker.workingDays.map((day) => {
                      const effective = getEffectiveShift(day);
                      return (
                        <div key={day} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="font-semibold text-[var(--heading-color)]">{day}</p>
                              <p className="text-xs text-[var(--muted-color)] mt-1">
                                {effective.custom ? `Custom hours: ${formatTimeRange(effective.start, effective.end)}` : `Using default: ${formatTimeRange(editWorker.shiftStart, editWorker.shiftEnd)}`}
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
                                Reset to Default
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
                                Set Custom Hours
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
                  Cancel
                </button>
                <button onClick={handleSaveSchedule} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}