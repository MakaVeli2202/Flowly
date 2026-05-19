import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { locationAPI } from '../api/location';
import realtimeService from '../api/realtimeService';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';

const STATUS_COLORS = {
  OnTheWay: '#7C3AED',
  InProgress: '#C084FC',
  Confirmed: '#60A5FA',
  Pending: '#FBBF24',
  Completed: '#84CC16',
  Cancelled: '#F87171',
};

const DOHA_REGION = {
  latitude: 25.2854,
  longitude: 51.531,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

function hasValidCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return false;
  return true;
}

export default function LiveWorkerMapScreen() {
  const wsStatus = useRealtimeStatus();

  const mapRef = useRef(null);
  const unsubRef = useRef(null);

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const normalizeWorkers = useCallback((list) => {
    return (list || [])
      .map((w) => ({
        ...w,
        workerId: Number(w.workerId),
        latitude: Number(w.latitude ?? w.lat ?? w.currentLatitude),
        longitude: Number(w.longitude ?? w.lng ?? w.currentLongitude),
      }))
      .filter((w) => Number.isFinite(w.workerId));
  }, []);

  const validWorkers = useMemo(() => {
    return workers.filter((w) => hasValidCoordinates(w.latitude, w.longitude));
  }, [workers]);

  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.workerId === selectedWorkerId) || null;
  }, [workers, selectedWorkerId]);

  const fitToWorkers = useCallback((list) => {
    const valid = (list || []).filter((w) => hasValidCoordinates(w.latitude, w.longitude));
    if (!mapRef.current || valid.length === 0) return;

    if (valid.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: valid[0].latitude,
          longitude: valid[0].longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        350
      );
      return;
    }

    mapRef.current.fitToCoordinates(
      valid.map((w) => ({ latitude: w.latitude, longitude: w.longitude })),
      {
        edgePadding: { top: 90, right: 70, bottom: 230, left: 70 },
        animated: true,
      }
    );
  }, []);

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await locationAPI.getLiveWorkers();
      const list = normalizeWorkers(data);
      setWorkers(list);
      setError('');
      setLastUpdate(new Date());
      fitToWorkers(list);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 403) {
        setError('Admin access required for live worker map.');
      } else {
        setError('Failed to load worker locations.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fitToWorkers, normalizeWorkers]);

  useEffect(() => {
    let alive = true;

    fetchWorkers().then(() => {
      if (!alive) return;

      unsubRef.current = realtimeService.onLocationUpdate((data) => {
        if (data?.workerId == null) return;

        setWorkers((prev) => {
          const next = [...prev];
          const idx = next.findIndex((w) => w.workerId === Number(data.workerId));
          const existing = idx >= 0 ? next[idx] : {};

          const updated = {
            ...existing,
            ...data,
            workerId: Number(data.workerId),
            latitude: Number(data.latitude ?? data.lat ?? existing.latitude),
            longitude: Number(data.longitude ?? data.lng ?? existing.longitude),
            timestamp: data.timestamp || new Date().toISOString(),
          };

          if (idx >= 0) next[idx] = updated;
          else next.push(updated);

          return next;
        });

        setLastUpdate(new Date());
      });
    });

    return () => {
      alive = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [fetchWorkers]);

  useEffect(() => {
    if (wsStatus === 'connected') {
      realtimeService.subscribeToAllAdminLocations();
      return undefined;
    }

    const timer = setInterval(() => {
      fetchWorkers();
    }, 7000);

    return () => clearInterval(timer);
  }, [fetchWorkers, wsStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWorkers();
  }, [fetchWorkers]);

  const openWorker = useCallback((worker) => {
    setSelectedWorkerId(worker.workerId);
    if (!hasValidCoordinates(worker.latitude, worker.longitude) || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: worker.latitude,
        longitude: worker.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      300
    );
  }, []);

  return (
    <View style={styles.root}>
      <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={styles.map} initialRegion={DOHA_REGION}>
        {validWorkers.map((worker) => {
          const color = STATUS_COLORS[worker.status] || '#6B7280';
          return (
            <Marker
              key={worker.workerId}
              coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
              pinColor={color}
              title={worker.workerName || `Worker ${worker.workerId}`}
              description={worker.status || 'Unknown'}
              onPress={() => setSelectedWorkerId(worker.workerId)}
            />
          );
        })}
      </MapView>

      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Live Worker Map</Text>
          <Text style={styles.subtitle}>
            {workers.length} workers · {validWorkers.length} with GPS · {wsStatus}
          </Text>
          {lastUpdate ? <Text style={styles.lastUpdate}>Last: {lastUpdate.toLocaleTimeString()}</Text> : null}
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <Ionicons name="refresh" size={18} color="#111827" />
          )}
        </Pressable>
      </View>

      <View style={styles.listCard}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#c8a96b" />
            <Text style={styles.muted}>Loading workers...</Text>
          </View>
        ) : workers.length === 0 ? (
          <View style={styles.centerWrap}>
            <Text style={styles.muted}>No active workers</Text>
          </View>
        ) : (
          <FlatList
            data={workers}
            keyExtractor={(item) => String(item.workerId)}
            renderItem={({ item }) => {
              const color = STATUS_COLORS[item.status] || '#6B7280';
              const selected = item.workerId === selectedWorkerId;

              return (
                <Pressable style={[styles.workerRow, selected && styles.workerRowSelected]} onPress={() => openWorker(item)}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={styles.workerMeta}>
                    <Text numberOfLines={1} style={styles.workerName}>
                      {item.workerName || `Worker ${item.workerId}`}
                    </Text>
                    <Text style={[styles.workerStatus, { color }]}>{item.status || 'Unknown'}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {selectedWorker && (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedWorker.workerName || `Worker ${selectedWorker.workerId}`}</Text>
          <Text style={styles.detailLine}>Status: {selectedWorker.status || 'Unknown'}</Text>
          <Text style={styles.detailLine}>
            Lat/Lng: {Number.isFinite(selectedWorker.latitude) ? selectedWorker.latitude.toFixed(6) : '-'},
            {' '}
            {Number.isFinite(selectedWorker.longitude) ? selectedWorker.longitude.toFixed(6) : '-'}
          </Text>
          {selectedWorker.currentBooking?.bookingNumber ? (
            <Text style={styles.detailLine}>Booking: {selectedWorker.currentBooking.bookingNumber}</Text>
          ) : null}
        </View>
      )}

      {!!error && (
        <View style={styles.errorChip}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  map: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#94a3b8', marginTop: 4, fontSize: 12 },
  lastUpdate: { color: '#94a3b8', marginTop: 2, fontSize: 11 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c8a96b',
  },
  listCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    height: 210,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    overflow: 'hidden',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: { color: '#94a3b8', fontSize: 13 },
  workerRow: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workerRowSelected: { backgroundColor: 'rgba(200,169,107,0.16)' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  workerMeta: { flex: 1 },
  workerName: { color: '#f8fafc', fontWeight: '700' },
  workerStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  detailCard: {
    position: 'absolute',
    right: 16,
    top: 90,
    width: 250,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    padding: 12,
  },
  detailTitle: { color: '#f8fafc', fontWeight: '800', marginBottom: 8 },
  detailLine: { color: '#cbd5e1', marginTop: 2, fontSize: 12 },
  errorChip: {
    position: 'absolute',
    alignSelf: 'center',
    top: 78,
    backgroundColor: 'rgba(239,68,68,0.94)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  errorText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});