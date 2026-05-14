import React, { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  Clock,
  User,
  X,
  RefreshCw,
  Radio,
  Navigation,
} from 'lucide-react';

import { locationAPI } from '../../api/location';
import realtimeService from '../../api/realtimeService';
import { useRealtimeStatus } from '../../hooks/useRealtimeStatus';

/* -------------------------------------------------------------------------- */
/*                               LEAFLET FIXES                                */
/* -------------------------------------------------------------------------- */

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* -------------------------------------------------------------------------- */
/*                                STATUS COLORS                               */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS = {
  OnTheWay: '#7C3AED',
  InProgress: '#C084FC',
  Confirmed: '#60A5FA',
  Pending: '#FBBF24',
  Completed: '#84CC16',
  Cancelled: '#F87171',
};

function hasValidCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;

  // Guard against default/empty coordinates that would skew map fitting.
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;

  return true;
}

/* -------------------------------------------------------------------------- */
/*                              MARKER FACTORY                                */
/* -------------------------------------------------------------------------- */

function makeMarkerIcon(color, selected = false) {
  const size = selected ? 44 : 34;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${size}"
      height="${size + 10}"
      viewBox="0 0 ${size} ${size + 10}">
      
      <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${size / 2 - 3}"
        fill="${color}22"
        stroke="${color}"
        stroke-width="${selected ? 3 : 2}"
      />

      <circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${size / 5}"
        fill="${color}"
      />

      <line
        x1="${size / 2}"
        y1="${size - 3}"
        x2="${size / 2}"
        y2="${size + 8}"
        stroke="${color}"
        stroke-width="2"
      />
    </svg>
  `;

  return L.divIcon({
    html: svg,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    className: '',
  });
}

/* -------------------------------------------------------------------------- */
/*                           WORKER DETAIL PANEL                              */
/* -------------------------------------------------------------------------- */

function WorkerDetailPanel({
  worker,
  onClose,
  onForceStop,
}) {
  if (!worker) return null;

  const color =
    STATUS_COLORS[worker.status] || '#6B7280';

  return (
    <div
      className="absolute right-4 top-4 w-80 backdrop-blur-md border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden z-[9999]"
      style={{ background: 'var(--surface-bg)' }}
    >
      <div
        className="p-4 border-b border-[var(--border-color)] flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(200,169,107,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${color}22`,
              border: `2px solid ${color}`,
            }}
          >
            <User size={18} color={color} />
          </div>

          <div>
            <h3 className="font-bold text-[var(--text-color)]">
              {worker.workerName}
            </h3>

            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}22`,
                color,
              }}
            >
              {worker.status || 'Unknown'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--border-color)] transition-colors"
        >
          <X
            size={16}
            className="text-[var(--muted-color)]"
          />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">
            Location
          </label>

          <p className="text-sm text-[var(--text-color)] font-mono">
            {worker.latitude?.toFixed(6)},
            {' '}
            {worker.longitude?.toFixed(6)}
          </p>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">
            Last Update
          </label>

          <div className="flex items-center gap-2 text-sm text-[var(--text-color)]">
            <Clock size={14} />

            {worker.timestamp
              ? new Date(worker.timestamp).toLocaleTimeString()
              : 'N/A'}
          </div>
        </div>

        {worker.currentBooking && (
          <div className="bg-[var(--surface-bg)] rounded-xl p-3 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-color)] mb-1 block">
              Current Job
            </label>

            <div className="flex items-center gap-2">
              <Navigation
                size={14}
                className="text-[var(--primary)]"
              />

              <span className="font-semibold text-[var(--primary)]">
                {worker.currentBooking.bookingNumber}
              </span>
            </div>

            <p className="text-sm text-[var(--text-color)]">
              {worker.currentBooking.customerName}
            </p>

            <p className="text-xs text-[var(--muted-color)]">
              {worker.currentBooking.customerAddress}
            </p>
          </div>
        )}

        <button
          onClick={() =>
            onForceStop(worker.workerId)
          }
          className="w-full py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{
            backgroundColor:
              'rgba(248,113,113,0.15)',
            color: '#F87171',
            border:
              '1px solid rgba(248,113,113,0.3)',
          }}
        >
          Force Stop Worker
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function LiveMapTracking() {
  const wsStatus = useRealtimeStatus();

  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const unsubRef = useRef(null);

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorker, setSelectedWorker] =
    useState(null);
  const [lastUpdate, setLastUpdate] =
    useState(null);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapTilesFailed, setMapTilesFailed] =
    useState(false);
  const [tileProviderLabel, setTileProviderLabel] =
    useState('OpenStreetMap');

  /* ---------------------------------------------------------------------- */
  /*                            NORMALIZE DATA                              */
  /* ---------------------------------------------------------------------- */

  const normalizeWorkers = useCallback((list) => {
    return (list || [])
      .map((w) => ({
        ...w,
        workerId: Number(w.workerId),
        latitude: Number(
          w.latitude ??
            w.lat ??
            w.currentLatitude
        ),
        longitude: Number(
          w.longitude ??
            w.lng ??
            w.currentLongitude
        ),
      }))
      .filter((w) =>
        Number.isFinite(w.workerId)
      );
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                             FIT MAP                                    */
  /* ---------------------------------------------------------------------- */

  const fitMapToWorkers = useCallback(
    (list) => {
      if (!leafletRef.current) return;

      const valid = (list || []).filter(
        (w) =>
          hasValidCoordinates(
            w.latitude,
            w.longitude
          )
      );

      if (!valid.length) return;

      const bounds = L.latLngBounds(
        valid.map((w) => [
          w.latitude,
          w.longitude,
        ])
      );

      leafletRef.current.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 15,
      });
    },
    []
  );

  /* ---------------------------------------------------------------------- */
  /*                            CREATE MAP                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    document.body.classList.add(
      'admin-live-map-mode'
    );

    if (
      !mapRef.current ||
      leafletRef.current
    )
      return;

    const map = L.map(mapRef.current, {
      center: [25.2854, 51.5310],
      zoom: 12,
      zoomControl: true,
    });

    const tileSources = [
      {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        },
      },
      {
        name: 'Carto Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        options: {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 19,
        },
      },
      {
        name: 'Esri WorldStreetMap',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        options: {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        },
      },
    ];

    let currentProviderIndex = 0;
    let tileErrors = 0;
    let activeLayer = null;

    const mountProvider = (index) => {
      const provider = tileSources[index];
      if (!provider) return;

      if (activeLayer) {
        map.removeLayer(activeLayer);
      }

      tileErrors = 0;
      setMapTilesFailed(false);
      setTileProviderLabel(provider.name);

      const layer = L.tileLayer(
        provider.url,
        provider.options
      );

      layer.on('load', () => {
        setMapReady(true);
      });

      layer.on('tileerror', () => {
        tileErrors += 1;

        if (
          tileErrors >= 4 &&
          currentProviderIndex <
            tileSources.length - 1
        ) {
          currentProviderIndex += 1;
          mountProvider(currentProviderIndex);
          return;
        }

        if (
          tileErrors >= 4 &&
          currentProviderIndex ===
            tileSources.length - 1
        ) {
          setMapTilesFailed(true);
          setMapReady(true);
        }
      });

      layer.addTo(map);
      activeLayer = layer;
    };

    mountProvider(0);

    // Never keep the map blocked by an init overlay forever.
    map.whenReady(() => {
      setMapReady(true);
    });

    const initSafetyTimer = setTimeout(() => {
      setMapReady(true);
    }, 1600);

    leafletRef.current = map;

    // CRITICAL FIX
    setTimeout(() => {
      map.invalidateSize(true);
    }, 500);

    const resizeHandler = () => {
      map.invalidateSize(true);
    };

    window.addEventListener(
      'resize',
      resizeHandler
    );

    return () => {
      document.body.classList.remove(
        'admin-live-map-mode'
      );

      window.removeEventListener(
        'resize',
        resizeHandler
      );

      clearTimeout(initSafetyTimer);

      map.remove();

      leafletRef.current = null;
      markersRef.current = {};
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!leafletRef.current) return;

    const timer = setTimeout(() => {
      leafletRef.current?.invalidateSize(
        true
      );
    }, 120);

    return () => clearTimeout(timer);
  }, [workers.length]);

  /* ---------------------------------------------------------------------- */
  /*                            MARKER SYNC                                 */
  /* ---------------------------------------------------------------------- */

  const syncMarker = useCallback(
    (worker) => {
      const map = leafletRef.current;

      if (
        !map ||
        !Number.isFinite(worker.latitude) ||
        !Number.isFinite(worker.longitude)
      ) {
        return;
      }

      const latlng = [
        worker.latitude,
        worker.longitude,
      ];

      const color =
        STATUS_COLORS[worker.status] ||
        '#6B7280';

      const selected =
        selectedWorker?.workerId ===
        worker.workerId;

      if (
        markersRef.current[worker.workerId]
      ) {
        markersRef.current[
          worker.workerId
        ]
          .setLatLng(latlng)
          .setIcon(
            makeMarkerIcon(color, selected)
          );
      } else {
        const marker = L.marker(latlng, {
          icon: makeMarkerIcon(
            color,
            selected
          ),
        })
          .addTo(map)
          .on('click', () => {
            setSelectedWorker(worker);

            map.setView(latlng, 15);
          });

        markersRef.current[
          worker.workerId
        ] = marker;
      }

      markersRef.current[
        worker.workerId
      ].bindTooltip(
        `${worker.workerName || worker.workerId} · ${worker.status || ''}`,
        {
          permanent: false,
          direction: 'top',
        }
      );
    },
    [selectedWorker]
  );

  /* ---------------------------------------------------------------------- */
  /*                         UPDATE MARKERS                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    workers.forEach(syncMarker);

    const ids = new Set(
      workers.map((w) => w.workerId)
    );

    Object.keys(markersRef.current).forEach(
      (id) => {
        if (!ids.has(Number(id))) {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        }
      }
    );
  }, [workers, syncMarker]);

  /* ---------------------------------------------------------------------- */
  /*                            FETCH WORKERS                               */
  /* ---------------------------------------------------------------------- */

  const fetchWorkers = useCallback(
    async () => {
      try {
        const data =
          await locationAPI.getLiveWorkers();

        console.log(
          'API workers:',
          data
        );

        const list =
          normalizeWorkers(data);

        console.log(
          'Normalized workers:',
          list
        );

        setWorkers(list);

        setLastUpdate(new Date());

        setError('');

        fitMapToWorkers(
          list.filter((w) =>
            hasValidCoordinates(
              w.latitude,
              w.longitude
            )
          )
        );
      } catch (err) {
        console.error(err);

        const status =
          err?.response?.status;

        if (status === 401) {
          setError(
            'Session expired. Please log in again.'
          );
        } else if (status === 403) {
          setError(
            'Admin access required for live worker locations.'
          );
        } else {
          setError(
            'Failed to load worker locations. Check backend connection.'
          );
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [normalizeWorkers, fitMapToWorkers]
  );

  /* ---------------------------------------------------------------------- */
  /*                        INITIAL LOAD + WS                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let alive = true;

    fetchWorkers().then(() => {
      if (!alive) return;

      unsubRef.current =
        realtimeService.onLocationUpdate(
          (data) => {
            if (!data?.workerId) return;

            setWorkers((prev) => {
              const idx = prev.findIndex(
                (w) =>
                  w.workerId ===
                  Number(data.workerId)
              );

              const existing =
                idx >= 0
                  ? prev[idx]
                  : {};

              const updated = {
                ...existing,
                ...data,

                workerId: Number(
                  data.workerId
                ),

                latitude: Number(
                  data.latitude ??
                    data.lat
                ),

                longitude: Number(
                  data.longitude ??
                    data.lng
                ),

                timestamp:
                  data.timestamp ||
                  new Date().toISOString(),
              };

              const map =
                leafletRef.current;

              if (
                map &&
                Number.isFinite(
                  updated.latitude
                ) &&
                Number.isFinite(
                  updated.longitude
                )
              ) {
                const latlng = [
                  updated.latitude,
                  updated.longitude,
                ];

                const color =
                  STATUS_COLORS[
                    updated.status
                  ] || '#6B7280';

                if (
                  markersRef.current[
                    updated.workerId
                  ]
                ) {
                  markersRef.current[
                    updated.workerId
                  ]
                    .setLatLng(latlng)
                    .setIcon(
                      makeMarkerIcon(
                        color
                      )
                    );
                } else {
                  const marker =
                    L.marker(latlng, {
                      icon:
                        makeMarkerIcon(
                          color
                        ),
                    })
                      .addTo(map)
                      .on(
                        'click',
                        () => {
                          setSelectedWorker(
                            updated
                          );
                        }
                      );

                  markersRef.current[
                    updated.workerId
                  ] = marker;
                }
              }

              let next;

              if (idx >= 0) {
                next = [...prev];
                next[idx] = updated;
              } else {
                next = [
                  ...prev,
                  updated,
                ];
              }

              fitMapToWorkers(next);

              return next;
            });

            setLastUpdate(new Date());
          }
        );
    });

    return () => {
      alive = false;

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [fetchWorkers, fitMapToWorkers]);

  /* ---------------------------------------------------------------------- */
  /*                          WS SUBSCRIBE                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (wsStatus !== 'connected')
      return;

    realtimeService.subscribeToAllAdminLocations();
  }, [wsStatus]);

  /* ---------------------------------------------------------------------- */
  /*                          FALLBACK POLLING                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (wsStatus === 'connected')
      return undefined;

    const timer = setInterval(() => {
      fetchWorkers();
    }, 7000);

    return () => clearInterval(timer);
  }, [fetchWorkers, wsStatus]);

  /* ---------------------------------------------------------------------- */
  /*                         FORCE STOP                                     */
  /* ---------------------------------------------------------------------- */

  const handleForceStop = async (
    workerId
  ) => {
    try {
      await realtimeService.forceStopWorker(
        workerId
      );

      setSelectedWorker(null);
    } catch (err) {
      console.error(err);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                              LOADING                                   */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--surface-bg)] overflow-hidden">
      {/* HEADER */}

      <div className="flex-none border-b border-[var(--border-color)] px-6 py-4 bg-[var(--card-bg)] z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-[var(--heading-color)]">
                Live Map Tracking
              </h1>

              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${
                  wsStatus === 'connected'
                    ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-green-500'
                    : wsStatus ===
                      'reconnecting'
                    ? 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.3)] text-yellow-500'
                    : 'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)] text-red-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === 'connected'
                      ? 'bg-green-500 animate-pulse'
                      : wsStatus ===
                        'reconnecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-400'
                  }`}
                />

                {wsStatus === 'connected'
                  ? 'Live'
                  : wsStatus ===
                    'reconnecting'
                  ? 'Reconnecting'
                  : 'Offline'}
              </div>
            </div>

            <p className="text-sm text-[var(--muted-color)]">
              Monitoring {workers.length}{' '}
              worker
              {workers.length !== 1
                ? 's'
                : ''}
              {' · '}
              {workers.filter((w) =>
                hasValidCoordinates(
                  w.latitude,
                  w.longitude
                )
              ).length}{' '}
              with live coordinates
              {' · Tiles: '}
              {tileProviderLabel}
            </p>
          </div>

          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchWorkers();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--ink)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                isRefreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>
        </div>
      </div>

      {/* MAP AREA */}

      <div className="flex-1 relative min-h-0">
        {/* MAP */}

        <div
          ref={mapRef}
          className="absolute inset-0 w-full h-full live-map-canvas"
          style={{
            zIndex: 1,
            minHeight: '100%',
          }}
        />

        {!mapReady && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-color)] bg-[var(--surface-bg)]/70"
            style={{ zIndex: 2 }}
          >
            Initializing map canvas...
          </div>
        )}

        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-color)] bg-[var(--surface-bg)]/55"
            style={{ zIndex: 3 }}
          >
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading worker locations...
            </div>
          </div>
        )}

        {/* SIDEBAR */}

        <div
          className="absolute left-4 top-4 bottom-4 w-72 backdrop-blur-md border border-[var(--border-color)] rounded-2xl overflow-hidden"
          style={{
            zIndex: 1000,
            background: 'var(--surface-bg)',
          }}
        >
          <div className="p-3 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-[var(--text-color)]">
              Active Workers
            </h3>
          </div>

          <div className="overflow-y-auto h-[calc(100%-56px)]">
            {workers.length === 0 ? (
              <div className="p-4 text-center">
                <Radio
                  size={24}
                  className="mx-auto mb-2 text-[var(--muted-color)]"
                />

                <p className="text-sm text-[var(--muted-color)]">
                  No active workers
                </p>
              </div>
            ) : (
              workers.map((worker) => {
                const color =
                  STATUS_COLORS[
                    worker.status
                  ] || '#6B7280';

                return (
                  <button
                    key={worker.workerId}
                    onClick={() => {
                      setSelectedWorker(
                        worker
                      );

                      if (
                        leafletRef.current &&
                        Number.isFinite(
                          worker.latitude
                        ) &&
                        Number.isFinite(
                          worker.longitude
                        )
                      ) {
                        leafletRef.current.setView(
                          [
                            worker.latitude,
                            worker.longitude,
                          ],
                          15
                        );
                      }
                    }}
                    className={`w-full p-3 border-b border-[var(--border-color)] text-left transition-colors ${
                      selectedWorker?.workerId ===
                      worker.workerId
                        ? 'bg-[rgba(200,169,107,0.1)]'
                        : 'hover:bg-[var(--surface-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-none"
                        style={{
                          backgroundColor: `${color}22`,
                          border: `2px solid ${color}`,
                        }}
                      >
                        <User
                          size={16}
                          color={color}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text-color)] truncate">
                          {
                            worker.workerName
                          }
                        </p>

                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${color}22`,
                            color,
                          }}
                        >
                          {worker.status ||
                            'Unknown'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* DETAILS */}

        <WorkerDetailPanel
          worker={selectedWorker}
          onClose={() =>
            setSelectedWorker(null)
          }
          onForceStop={handleForceStop}
        />

        {/* ERROR */}

        {error && (
          <div
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-xl text-sm"
            style={{
              zIndex: 1001,
            }}
          >
            {error}
          </div>
        )}

        {mapTilesFailed && (
          <div
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-black px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ zIndex: 1001 }}
          >
            Map tiles unavailable. Check internet/firewall.
          </div>
        )}

        {!error &&
          workers.length > 0 &&
          workers.every(
            (w) =>
              !hasValidCoordinates(
                w.latitude,
                w.longitude
              )
          ) && (
            <div
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-black px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ zIndex: 1001 }}
            >
              Workers detected, but no valid GPS coordinates yet.
            </div>
          )}
      </div>
    </div>
  );
}