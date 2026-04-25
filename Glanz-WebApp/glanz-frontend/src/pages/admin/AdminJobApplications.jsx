// AdminJobApplications.jsx — Manage job applications
import React, { useState, useEffect } from 'react';
import { Users, Search, Check, X, Mail, Calendar, FileText, ChevronDown, ChevronUp, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { jobsAPI } from '../../api/jobs';
import AppModal from '../../components/shared/AppModal';

const PRISM_CSS = `
  .field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem}
  .field-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

const STATUS_COLORS = {
  Pending: '#FBBF24',
  UnderReview: '#60A5FA',
  InterviewScheduled: '#C084FC',
  Offered: '#8B5CF6',
  Hired: '#22C55E',
  Rejected: '#F87171',
  Withdrawn: '#94A3B8',
};

const STATUS_OPTIONS = ['Pending', 'UnderReview', 'InterviewScheduled', 'Offered', 'Hired', 'Rejected', 'Withdrawn'];

export default function AdminJobApplications() {
  const [applications, setApplications] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState({ open: false, app: null, action: null });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [apps, poss] = await Promise.all([
        jobsAPI.getApplications(),
        jobsAPI.getAllPositions(),
      ]);
      setApplications(apps || []);
      setPositions(poss || []);
    } catch (err) {
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = applications.filter(app => {
    const query = search.toLowerCase();
    if (query) {
      const name = `${app.firstName} ${app.lastName}`.toLowerCase();
      if (!name.includes(query) && !app.email.toLowerCase().includes(query)) return false;
    }
    if (statusFilter && app.status !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status) => STATUS_COLORS[status] || '#6B7280';

  const handleStatusChange = async (app, newStatus) => {
    setShowConfirmModal({ open: true, app, action: newStatus });
  };

  const confirmStatusChange = async () => {
    const { app, action } = showConfirmModal;
    try {
      setUpdating(app.id);
      await jobsAPI.updateApplication(app.id, { status: action });
      await fetchData();
      setSelectedApp(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setUpdating(null);
      setShowConfirmModal({ open: false, app: null, action: null });
    }
  };

  const getPositionTitle = (posId) => {
    const pos = positions.find(p => p.id === posId);
    return pos?.title || pos?.Position || 'General Application';
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <style>{PRISM_CSS}</style>
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  );

  return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)]">Job Applications</h1>
              <p className="text-[var(--muted-color)]">{applications.length} total applications</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4 mb-4">
              <AlertCircle size={16} className="text-rose-400" />
              <p className="text-rose-300 text-sm flex-1">{error}</p>
              <button onClick={() => setError('')}><X size={14} className="text-rose-400" /></button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
              <input type="text" placeholder="Search by name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="field-input pl-9" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="field-input w-auto">
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {STATUS_OPTIONS.map(status => {
              const count = applications.filter(a => a.status === status).length;
              return (
                <button key={status} onClick={() => setStatusFilter(status === statusFilter ? '' : status)}
                  className={`p-3 rounded-xl border text-left transition ${statusFilter === status ? 'border-primary' : 'border-[var(--border-color)]'}`}
                  style={{ background: statusFilter === status ? 'rgba(200,169,107,.05)' : 'var(--surface-bg)' }}>
                  <p className="text-xs text-[var(--muted-color)]">{status}</p>
                  <p className="text-xl font-bold" style={{ color: getStatusColor(status) }}>{count}</p>
                </button>
              );
            })}
          </div>

          {/* Applications List */}
          {filteredApps.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Users size={48} className="mx-auto mb-4 text-[var(--muted-color)] opacity-40" />
              <p className="text-[var(--muted-color)]">No applications found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApps.map(app => (
                <div key={app.id} className="glass-card p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="font-bold text-[var(--heading-color)]">{app.firstName} {app.lastName}</h3>
                    <p className="text-sm text-[var(--muted-color)]">{app.email}</p>
                    <p className="text-xs text-[var(--muted-color)]">{app.phone || 'No phone'}</p>
                  </div>
                  
                  <div className="text-sm">
                    <p className="text-[var(--text-color)]">{getPositionTitle(app.jobPositionId)}</p>
                    <p className="text-xs text-[var(--muted-color)]">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ 
                    background: getStatusColor(app.status) + '22',
                    border: '1px solid ' + getStatusColor(app.status),
                    color: getStatusColor(app.status)
                  }}>
                    {app.status}
                  </span>

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedApp(app)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs hover:bg-white/5">
                      View
                    </button>
                    <select value={app.status} onChange={e => handleStatusChange(app, e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] text-xs bg-[var(--surface-bg)]"
                      disabled={updating === app.id}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail Modal */}
          <AppModal isOpen={!!selectedApp} onClose={() => setSelectedApp(null)} title="Application Details" size="lg">
            {selectedApp && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Name</label>
                    <p className="text-[var(--text-color)]">{selectedApp.firstName} {selectedApp.lastName}</p>
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <p className="text-[var(--text-color)]">{selectedApp.email}</p>
                  </div>
                  <div>
                    <label className="field-label">Phone</label>
                    <p className="text-[var(--text-color)]">{selectedApp.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="field-label">Address</label>
                    <p className="text-[var(--text-color)]">{selectedApp.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="field-label">Position</label>
                    <p className="text-[var(--text-color)]">{getPositionTitle(selectedApp.jobPositionId)}</p>
                  </div>
                  <div>
                    <label className="field-label">Applied</label>
                    <p className="text-[var(--text-color)]">{new Date(selectedApp.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {selectedApp.experience && (
                  <div>
                    <label className="field-label">Experience</label>
                    <p className="text-[var(--text-color)] text-sm whitespace-pre-wrap">{selectedApp.experience}</p>
                  </div>
                )}

                {selectedApp.coverLetter && (
                  <div>
                    <label className="field-label">Cover Letter</label>
                    <p className="text-[var(--text-color)] text-sm whitespace-pre-wrap">{selectedApp.coverLetter}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-[var(--border-color)]">
                  <button onClick={() => handleStatusChange(selectedApp, 'UnderReview')}
                    disabled={updating === selectedApp.id}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-bold hover:bg-blue-500/30 disabled:opacity-50">
                    Mark Under Review
                  </button>
                  <button onClick={() => handleStatusChange(selectedApp, 'InterviewScheduled')}
                    disabled={updating === selectedApp.id}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-bold hover:bg-purple-500/30 disabled:opacity-50">
                    Schedule Interview
                  </button>
                  <button onClick={() => handleStatusChange(selectedApp, 'Hired')}
                    disabled={updating === selectedApp.id}
                    className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold hover:bg-green-500/30 disabled:opacity-50">
                    Hire
                  </button>
                  <button onClick={() => handleStatusChange(selectedApp, 'Rejected')}
                    disabled={updating === selectedApp.id}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/30 disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </div>
            )}
          </AppModal>

          {/* Confirm Modal */}
          <AppModal isOpen={showConfirmModal.open} onClose={() => setShowConfirmModal({ open: false, app: null, action: null })}
            title="Confirm Status Change" message={`Change status to "${showConfirmModal.action}"? An email will be sent to the applicant.`}
            confirmLabel="Yes, Update" onConfirm={confirmStatusChange} variant="info" />
        </div>
      </div>
    </>
  );
}