import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Calendar, AlertCircle, CheckCircle, XCircle, RefreshCw, Users, ChevronRight, UserCheck, X } from 'lucide-react';
import { authAPI } from '../../api/auth';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { useLanguage } from '../../context/LanguageContext';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFTS = [
  { label: 'Early Morning', start: '06:00', end: '14:00' },
  { label: 'Morning', start: '07:00', end: '15:00' },
  { label: 'Late Morning', start: '08:00', end: '16:00' },
  { label: 'Afternoon', start: '12:00', end: '20:00' },
  { label: 'Evening', start: '14:00', end: '22:00' },
  { label: 'Night', start: '20:00', end: '06:00' },
];

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
      await authAPI.updateWorkerSchedule(editWorker.id, {
        workingDays: editWorker.workingDays,
        shiftStart: editWorker.shiftStart,
        shiftEnd: editWorker.shiftEnd,
      });
      setWorkers(prev => prev.map(w => w.id === editWorker.id ? editWorker : w));
      setEditWorker(null);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to save schedule.');
    } finally { setSaving(false); }
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
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[var(--muted-color)]">
                    <Clock size={14} />
                    <span>{worker.shiftStart || '--:--'} - {worker.shiftEnd || '--:--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-color)]">
                    <Calendar size={14} />
                    <span>{worker.workingDays?.split(',').join(', ') || 'No schedule'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEditWorker(worker)}
                className="mt-3 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <ChevronRight size={14} className="-rotate-90" /> Edit Schedule
              </button>
            </div>
          ))}
        </div>

        {editWorker && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--heading-color)]">Edit Schedule</h3>
                <button onClick={() => setEditWorker(null)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X size={18} className="text-[var(--muted-color)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Working Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = editWorker.workingDays?.split(',') || [];
                          const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
                          setEditWorker({ ...editWorker, workingDays: newDays.join(',') });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm ${editWorker.workingDays?.split(',').includes(day) ? 'bg-primary text-white' : 'bg-[var(--surface-bg)] text-[var(--muted-color)]'}`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[var(--muted-color)] mb-2">Shift</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIFTS.map(shift => (
                      <button
                        key={shift.label}
                        onClick={() => setEditWorker({ ...editWorker, shiftStart: shift.start, shiftEnd: shift.end })}
                        className={`px-3 py-2 rounded-lg text-sm ${editWorker.shiftStart === shift.start ? 'bg-primary text-white' : 'bg-[var(--surface-bg)] text-[var(--muted-color)]'}`}
                      >
                        {shift.label}
                      </button>
                    ))}
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