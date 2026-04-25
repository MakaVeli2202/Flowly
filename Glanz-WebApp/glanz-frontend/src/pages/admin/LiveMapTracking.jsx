import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Clock, User, X, RefreshCw, Radio } from 'lucide-react';
import { locationAPI } from '../../api/location';

const LOCATION_POLL_INTERVAL = 8000;

const STATUS_COLORS = {
  'OnTheWay': '#7C3AED',
  'InProgress': '#C084FC',
  'Confirmed': '#60A5FA',
  'Pending': '#FBBF24',
  'Completed': '#84CC16',
  'Cancelled': '#F87171',
};

function WorkerMarker({ worker, onClick, isSelected }) {
  const statusColor = STATUS_COLORS[worker.status] || '#6B7280';
  return (
    <button
      onClick={() => onClick(worker)}
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
        isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-40'
      }`}
      style={{ left: '50%', top: '50%' }}
    >
      <div
        className="relative"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: `${statusColor}22`,
          border: `3px solid ${statusColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 20px ${statusColor}66`,
        }}
      >
        <User size={20} color={statusColor} />
        {isSelected && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: statusColor }}
          />
        )}
      </div>
      <div
        className="absolute left-1/2 transform -translate-x-1/2 w-1 h-4 -bottom-2"
        style={{ backgroundColor: statusColor, borderRadius: '0 0 4px 4px' }}
      />
    </button>
  );
}

function WorkerDetailPanel({ worker, onClose }) {
  if (!worker) return null;

  return (
    <div className="absolute right-4 top-4 w-80 bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between" style={{ backgroundColor: 'rgba(200,169,107,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${STATUS_COLORS[worker.status] || '#6B7280'}22`, border: `2px solid ${STATUS_COLORS[worker.status] || '#6B7280'}` }}
          >
            <User size={18} color={STATUS_COLORS[worker.status] || '#6B7280'} />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-color)]">{worker.workerName}</h3>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${STATUS_COLORS[worker.status] || '#6B7280'}22`, color: STATUS_COLORS[worker.status] || '#6B7280' }}
            >
              {worker.status || 'Unknown'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--border-color)] transition-colors"
        >
          <X size={16} className="text-[var(--muted-color)]" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">Location</label>
          <p className="text-sm text-[var(--text-color)]">
            {worker.latitude?.toFixed(6)}, {worker.longitude?.toFixed(6)}
          </p>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">Last Update</label>
          <div className="flex items-center gap-2 text-sm text-[var(--text-color)]">
            <Clock size={14} />
            {worker.timestamp ? new Date(worker.timestamp).toLocaleTimeString() : 'N/A'}
          </div>
        </div>

        {worker.currentBooking && (
          <div className="bg-[var(--surface-bg)] rounded-xl p-3 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">Current Job</label>
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-[var(--primary)]" />
              <span className="font-semibold text-[var(--primary)]">{worker.currentBooking.bookingNumber}</span>
            </div>
            <p className="text-sm text-[var(--text-color)]">{worker.currentBooking.customerName}</p>
            <p className="text-xs text-[var(--muted-color)]">{worker.currentBooking.customerAddress}</p>
            <span
              className="inline-block text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                backgroundColor: `${STATUS_COLORS[worker.currentBooking.bookingStatus] || '#6B7280'}22`,
                color: STATUS_COLORS[worker.currentBooking.bookingStatus] || '#6B7280',
              }}
            >
              {worker.currentBooking.bookingStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MapPlaceholder({ workers, selectedWorker, onSelectWorker }) {
  const gridPositions = [
    { x: 30, y: 40 },
    { x: 70, y: 30 },
    { x: 50, y: 60 },
    { x: 20, y: 70 },
    { x: 80, y: 65 },
  ];

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(200,169,107,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200,169,107,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Animated scan line */}
      <div
        className="absolute left-0 right-0 h-0.5 opacity-20"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.8), transparent)',
          animation: 'scan 3s linear infinite',
        }}
      />

      {/* Map info overlay */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-xs text-white/70">Live Map View</p>
        <p className="text-sm text-white font-semibold">{workers.length} Active Workers</p>
      </div>

      {/* Worker markers */}
      {workers.map((worker, idx) => {
        const pos = gridPositions[idx % gridPositions.length];
        return (
          <div
            key={worker.workerId}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <button
              onClick={() => onSelectWorker(worker)}
              className={`relative group ${selectedWorker?.workerId === worker.workerId ? 'scale-125' : 'hover:scale-110'}`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: `${STATUS_COLORS[worker.status] || '#6B7280'}33`,
                  border: `3px solid ${STATUS_COLORS[worker.status] || '#6B7280'}`,
                  boxShadow: `0 0 30px ${STATUS_COLORS[worker.status] || '#6B7280'}44`,
                }}
              >
                <User size={22} color={STATUS_COLORS[worker.status] || '#6B7280'} />
              </div>
              <div
                className="absolute left-1/2 transform -translate-x-1/2 w-1 h-3 -bottom-2 rounded-b"
                style={{ backgroundColor: STATUS_COLORS[worker.status] || '#6B7280' }}
              />
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-black/80 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white font-semibold">{worker.workerName}</p>
              </div>
            </button>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
        <p className="text-xs text-white/70 mb-2 font-semibold uppercase tracking-wider">Legend</p>
        <div className="space-y-1">
          {Object.entries(STATUS_COLORS).filter(([k]) => ['OnTheWay', 'InProgress', 'Confirmed'].includes(k)).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-white/80">{status}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function LiveMapTracking() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollIntervalRef = useRef(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await locationAPI.getLiveWorkers();
      setWorkers(data || []);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError('Failed to load worker locations');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers().then(() => {
      pollIntervalRef.current = setInterval(fetchWorkers, LOCATION_POLL_INTERVAL);
    });

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchWorkers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchWorkers();
  };

  const handleWorkerSelect = (worker) => {
    setSelectedWorker(prev => prev?.workerId === worker.workerId ? null : worker);
  };

  const activeWorkers = workers.filter(w => w.status === 'OnTheWay' || w.status === 'InProgress' || w.status === 'Confirmed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--surface-bg)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-color)]">Loading live tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--surface-bg)]">
      {/* Header */}
      <div className="flex-none border-b border-[var(--border-color)] px-6 py-4 bg-[var(--card-bg)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-[var(--heading-color)]">Live Map Tracking</h1>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Live</span>
              </div>
            </div>
            <p className="text-sm text-[var(--muted-color)]">
              Monitoring {workers.length} worker{workers.length !== 1 ? 's' : ''} · {activeWorkers.length} active
            </p>
          </div>

          <div className="flex items-center gap-4">
            {lastUpdate && (
              <div className="text-right">
                <p className="text-xs text-[var(--muted-color)]">Last update</p>
                <p className="text-sm font-semibold text-[var(--text-color)]">{lastUpdate.toLocaleTimeString()}</p>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--ink)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 mt-4">
          {[
            { label: 'Total', value: workers.length, color: 'var(--primary)' },
            { label: 'On The Way', value: workers.filter(w => w.status === 'OnTheWay').length, color: '#7C3AED' },
            { label: 'In Progress', value: workers.filter(w => w.status === 'InProgress').length, color: '#C084FC' },
            { label: 'Idle', value: workers.filter(w => w.status === 'Confirmed').length, color: '#60A5FA' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--muted-color)]">{label}:</span>
              <span className="text-sm font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        <MapPlaceholder workers={workers} selectedWorker={selectedWorker} onSelectWorker={handleWorkerSelect} />

        {/* Worker list sidebar */}
        <div className="absolute left-4 top-4 bottom-4 w-72 bg-[var(--card-bg)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-[var(--text-color)]">Active Workers</h3>
          </div>
          <div className="overflow-y-auto h-[calc(100%-56px)]">
            {workers.length === 0 ? (
              <div className="p-4 text-center">
                <Radio size={24} className="mx-auto mb-2 text-[var(--muted-color)]" />
                <p className="text-sm text-[var(--muted-color)]">No active workers</p>
              </div>
            ) : (
              workers.map(worker => (
                <button
                  key={worker.workerId}
                  onClick={() => handleWorkerSelect(worker)}
                  className={`w-full p-3 border-b border-[var(--border-color)] text-left transition-colors ${
                    selectedWorker?.workerId === worker.workerId
                      ? 'bg-[rgba(200,169,107,0.1)]'
                      : 'hover:bg-[var(--surface-bg)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-none"
                      style={{
                        backgroundColor: `${STATUS_COLORS[worker.status] || '#6B7280'}22`,
                        border: `2px solid ${STATUS_COLORS[worker.status] || '#6B7280'}`,
                      }}
                    >
                      <User size={16} color={STATUS_COLORS[worker.status] || '#6B7280'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-color)] truncate">{worker.workerName}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${STATUS_COLORS[worker.status] || '#6B7280'}22`,
                            color: STATUS_COLORS[worker.status] || '#6B7280',
                          }}
                        >
                          {worker.status || 'Unknown'}
                        </span>
                      </div>
                      {worker.currentBooking && (
                        <p className="text-xs text-[var(--muted-color)] truncate mt-1">
                          {worker.currentBooking.bookingNumber} · {worker.currentBooking.customerName}
                        </p>
                      )}
                    </div>
                    <Navigation size={14} className="text-[var(--muted-color)] flex-none" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected worker detail panel */}
        <WorkerDetailPanel worker={selectedWorker} onClose={() => setSelectedWorker(null)} />

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}