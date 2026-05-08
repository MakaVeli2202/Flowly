import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, User, X, RefreshCw, Radio, Navigation } from 'lucide-react';
import { locationAPI } from '../../api/location';
import realtimeService from '../../api/realtimeService';
import { useRealtimeStatus } from '../../hooks/useRealtimeStatus';

// Fix leaflet default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLORS = {
  OnTheWay:   '#7C3AED',
  InProgress: '#C084FC',
  Confirmed:  '#60A5FA',
  Pending:    '#FBBF24',
  Completed:  '#84CC16',
  Cancelled:  '#F87171',
};

// SVG marker icon factory — colored dot with status ring
function _makeMarkerIcon(color, selected = false) {
  const size = selected ? 44 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${color}22" stroke="${color}" stroke-width="${selected ? 3 : 2}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 5}" fill="${color}"/>
    <line x1="${size / 2}" y1="${size - 3}" x2="${size / 2}" y2="${size + 8}" stroke="${color}" stroke-width="2"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize:   [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    className:  '',
  });
}

function WorkerDetailPanel({ worker, onClose, onForceStop }) {
  if (!worker) return null;
  const color = STATUS_COLORS[worker.status] || '#6B7280';
  return (
    <div className="absolute right-4 top-4 w-80 bg-[var(--card-bg)] backdrop-blur-md border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-[9999]">
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between" style={{ backgroundColor: 'rgba(200,169,107,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}>
            <User size={18} color={color} />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-color)]">{worker.workerName}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}22`, color }}>
              {worker.status || 'Unknown'}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--border-color)] transition-colors">
          <X size={16} className="text-[var(--muted-color)]" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">Location</label>
          <p className="text-sm text-[var(--text-color)] font-mono">
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
          </div>
        )}
        <button
          onClick={() => onForceStop(worker.workerId)}
          className="w-full py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
        >
          Force Stop Worker
        </button>
      </div>
    </div>
  );
}

export default function LiveMapTracking() {
  const navigate    = useNavigate();
  const wsStatus    = useRealtimeStatus();
  const mapRef      = useRef(null);    // DOM node
  const leafletRef  = useRef(null);    // L.Map instance
  const markersRef  = useRef({});      // workerId → L.Marker
  const unsubRef    = useRef(null);

  const [workers,       setWorkers]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  const normalizeWorkers = useCallback((list) => (
    (list || []).map((w) => ({
      ...w,
      workerId: Number(w.workerId),
      latitude: Number(w.latitude),
      longitude: Number(w.longitude),
    })).filter((w) => Number.isFinite(w.workerId))
  ), []);

  const fitMapToWorkers = useCallback((list) => {
    if (!leafletRef.current || selectedWorker) return;
    const valid = (list || []).filter((w) => Number.isFinite(w.latitude) && Number.isFinite(w.longitude));
    if (!valid.length) return;
    const bounds = L.latLngBounds(valid.map((w) => [w.latitude, w.longitude]));
    leafletRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [selectedWorker]);

  // ── Bootstrap Leaflet map ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const map = L.map(mapRef.current, {
      center: [25.2854, 51.5310], // Doha default — will pan to first worker
      zoom:   12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletRef.current = map;

    // Leaflet can render a blank/black area until size is recalculated after layout.
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      leafletRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // ── Sync worker markers to the map ─────────────────────────────────────────
  const syncMarker = useCallback((worker) => {
    const map = leafletRef.current;
    if (!map || !worker.latitude || !worker.longitude) return;

    const latlng  = [worker.latitude, worker.longitude];
    const color    = STATUS_COLORS[worker.status] || '#6B7280';
    const selected = selectedWorker?.workerId === worker.workerId;

    if (markersRef.current[worker.workerId]) {
      markersRef.current[worker.workerId]
        .setLatLng(latlng)
        .setIcon(_makeMarkerIcon(color, selected));
    } else {
      const marker = L.marker(latlng, { icon: _makeMarkerIcon(color, selected) })
        .addTo(map)
        .on('click', () => setSelectedWorker(w => w?.workerId === worker.workerId ? null : { ...worker }));
      markersRef.current[worker.workerId] = marker;
    }

    // Update tooltip
    markersRef.current[worker.workerId]
      .bindTooltip(`${worker.workerName || worker.workerId} · ${worker.status || ''}`, {
        permanent: false, direction: 'top',
      });
  }, [selectedWorker]);

  // Re-sync all markers when workers or selection changes
  useEffect(() => {
    workers.forEach(syncMarker);

    // Remove markers for workers no longer in list
    const ids = new Set(workers.map(w => w.workerId));
    Object.keys(markersRef.current).forEach((id) => {
      if (!ids.has(Number(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [workers, syncMarker]);

  // ── Fetch initial worker list from REST ─────────────────────────────────────
  const fetchWorkers = useCallback(async () => {
    try {
      const data = await locationAPI.getLiveWorkers();
      const list  = normalizeWorkers(data);
      setWorkers(list);
      setLastUpdate(new Date());
      setError('');
      fitMapToWorkers(list);
    } catch {
      setError('Failed to load worker locations');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fitMapToWorkers, normalizeWorkers]);

  useEffect(() => {
    let alive = true; // guard against setting listeners after unmount

    fetchWorkers().then(() => {
      if (!alive) return;

      unsubRef.current = realtimeService.onLocationUpdate((data) => {
        if (!data?.workerId) return;

        setWorkers((prev) => {
          const idx = prev.findIndex((w) => w.workerId === data.workerId);
          const updated = {
            ...(idx >= 0 ? prev[idx] : {}),
            workerId:  Number(data.workerId),
            latitude:  Number(data.latitude ?? data.lat),
            longitude: Number(data.longitude ?? data.lng),
            timestamp: data.timestamp || new Date().toISOString(),
          };

          // Move marker immediately on map (no React re-render latency)
          const map = leafletRef.current;
          if (map && updated.latitude && updated.longitude) {
            const latlng = [updated.latitude, updated.longitude];
            const color  = STATUS_COLORS[updated.status] || '#6B7280';
            if (markersRef.current[data.workerId]) {
              markersRef.current[data.workerId].setLatLng(latlng);
            } else {
              const marker = L.marker(latlng, { icon: _makeMarkerIcon(color) })
                .addTo(map)
                .on('click', () => setSelectedWorker(w => w?.workerId === data.workerId ? null : updated));
              markersRef.current[data.workerId] = marker;
            }
          }

          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            fitMapToWorkers(next);
            return next;
          }
          const next = [...prev, updated];
          fitMapToWorkers(next);
          return next;
        });

        setLastUpdate(new Date());
      });
    });

    return () => {
      alive = false; // prevent .then() from registering a listener post-unmount
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, [fetchWorkers, fitMapToWorkers]);

  // Subscribe only when websocket is connected; retry naturally on reconnects.
  useEffect(() => {
    if (wsStatus !== 'connected') return;
    realtimeService.subscribeToAllAdminLocations();
  }, [wsStatus]);

  // Fallback polling keeps sidebar/counters alive even if ws drops.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchWorkers();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchWorkers]);

  const handleForceStop = async (workerId) => {
    await realtimeService.forceStopWorker(workerId);
    setSelectedWorker(null);
  };

  const activeWorkers = workers.filter(w => ['OnTheWay', 'InProgress', 'Confirmed', 'Pending'].includes(w.status));

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
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${
                wsStatus === 'connected'
                  ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-green-500'
                  : wsStatus === 'reconnecting'
                  ? 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.3)] text-yellow-500'
                  : 'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)] text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  wsStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-400'
                }`} />
                {wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
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
              onClick={() => { setIsRefreshing(true); fetchWorkers(); }}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--ink)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4">
          {[
            { label: 'Total',       value: workers.length,                                      color: 'var(--primary)' },
            { label: 'On The Way',  value: workers.filter(w => w.status === 'OnTheWay').length,  color: '#7C3AED' },
            { label: 'In Progress', value: workers.filter(w => w.status === 'InProgress').length, color: '#C084FC' },
            { label: 'Idle',        value: workers.filter(w => w.status === 'Confirmed').length,  color: '#60A5FA' },
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
        {/* Leaflet map container */}
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />

        {/* Worker list sidebar */}
        <div className="absolute left-4 top-4 bottom-4 w-72 bg-[var(--card-bg)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-2xl overflow-hidden" style={{ zIndex: 1000 }}>
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
              workers.map(worker => {
                const color = STATUS_COLORS[worker.status] || '#6B7280';
                return (
                  <button
                    key={worker.workerId}
                    onClick={() => {
                      const next = selectedWorker?.workerId === worker.workerId ? null : worker;
                      setSelectedWorker(next);
                      if (next && worker.latitude && worker.longitude && leafletRef.current) {
                        leafletRef.current.setView([worker.latitude, worker.longitude], 15);
                      }
                    }}
                    className={`w-full p-3 border-b border-[var(--border-color)] text-left transition-colors ${
                      selectedWorker?.workerId === worker.workerId ? 'bg-[rgba(200,169,107,0.1)]' : 'hover:bg-[var(--surface-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-none" style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}>
                        <User size={16} color={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text-color)] truncate">{worker.workerName}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}22`, color }}>
                          {worker.status || 'Unknown'}
                        </span>
                        {worker.currentBooking && (
                          <p className="text-xs text-[var(--muted-color)] truncate mt-1">
                            {worker.currentBooking.bookingNumber} · {worker.currentBooking.customerName}
                          </p>
                        )}
                      </div>
                      <Navigation size={14} className="text-[var(--muted-color)] flex-none" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected worker detail */}
        <WorkerDetailPanel
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onForceStop={handleForceStop}
        />

        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-xl text-sm" style={{ zIndex: 1001 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
