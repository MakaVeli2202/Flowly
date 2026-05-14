import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
  Modal, TextInput, Image, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { bookingsAPI } from '../api/bookings';
import { authAPI } from '../api/auth';
import { servicesAPI } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { subscribeToNotifications } from '../api/notificationBus';
import realtimeService from '../api/realtimeService';
import { formatQAR } from '../utils/currency';
import { canTransition } from '../utils/bookingStateMachine';
import { theme } from '../theme/theme';
import { API_BASE_URL } from '../config/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const statusOptions       = ['Pending', 'Confirmed', 'InProgress', 'Completed', 'Cancelled'];
const workerStatusOptions  = ['Pending', 'Confirmed', 'InProgress', 'Paused', 'Completed'];
const workerArrivalCooldownMs  = 5 * 60 * 1000;

const statusColors = {
  Pending:    '#FBBF24',
  Confirmed:  '#60A5FA',
  InProgress: '#C084FC',
  Completed:  '#84CC16',
  Cancelled:  '#F87171',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toUtcDateKey = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const extractDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return toLocalDateKey(date);
};

const isSameDay = (dateValue, compareDate = new Date(), dayOffset = 0) => {
  const bookingKey = extractDateKey(dateValue);
  if (!bookingKey) return false;
  const adjusted = new Date(compareDate);
  adjusted.setDate(adjusted.getDate() + dayOffset);
  return bookingKey === toLocalDateKey(adjusted);
};

const isWithinWorkerWindow = (dateValue, compareDate = new Date()) =>
  isSameDay(dateValue, compareDate, 0) ||
  isSameDay(dateValue, compareDate, 1) ||
  isSameDay(dateValue, compareDate, 2);

const resolveProfileImageUrl = (value) => {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const apiOrigin = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
};

const getSubscriptionInfo = (booking) => {
  const text  = String(booking?.specialInstructions || '');
  const match = text.match(/monthly subscription:?\s*(\d+)\s*month/i);
  if (!match) return { isMonthly: false, months: null };
  return { isMonthly: true, months: Number(match[1] || 1) };
};

const getTimeSlotStartMinutes = (timeSlot) => {
  const rawStart = String(timeSlot || '').split('-')[0]?.trim();
  const match    = rawStart?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours   = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
};

const getBookingSortValue = (booking) => {
  const date      = new Date(booking?.scheduledDate);
  const dateMs    = Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
  const slotMins  = getTimeSlotStartMinutes(booking?.timeSlot);
  return dateMs * 1440 + slotMins;
};

const getTimeSlotRange = (timeSlot) => {
  const raw   = String(timeSlot || '').trim();
  const parts = raw.split('-');
  if (parts.length < 2) return null;
  const parseMinutes = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const start = parseMinutes(parts[0]);
  const end   = parseMinutes(parts[1]);
  if (start == null || end == null) return null;
  return end <= start ? { start, end: start + 60 } : { start, end };
};

const slotsOverlap = (l, r) =>
  Math.max(l.start, r.start) < Math.min(l.end, r.end);

const getArrivalCooldownRemainingMs = (arrivedAt) => {
  if (!arrivedAt) return 0;
  const ms = Date.parse(arrivedAt);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, ms + workerArrivalCooldownMs - Date.now());
};

const formatCountdown = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '00:00';
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const formatTimeAMPM = (timeSlot) => {
  const raw = String(timeSlot || '').trim();
  const [startRaw, endRaw] = raw.split('-').map((p) => String(p || '').trim());
  const to12 = (t) => {
    const match = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return t;
    let h = Number(match[1]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${match[2]} ${ampm}`;
  };
  return `${to12(startRaw)} – ${to12(endRaw)}`;
};

const isAddonItem = (item) => {
  const tier = String(item?.packageTier || '').trim().toLowerCase();
  const name = String(item?.packageName || '').trim().toLowerCase();
  return /add[\s_-]?on/.test(tier) || /add[\s_-]?on|service add/.test(name);
};

const buildBookingBreakdown = (booking) => {
  const items       = booking?.items || [];
  const addonItems  = items.filter(isAddonItem);
  const baseItems   = items.filter((i) => !isAddonItem(i));
  const baseTotal   = baseItems.reduce((s, i)  => s + Number(i.subtotal || 0), 0);
  const addonsTotal = addonItems.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const finalTotal  = Number(booking?.totalAmount || 0);
  const selectedServices = [...new Set(
    addonItems.flatMap((i) => i.includedServices || [])
      .map((s) => String(s || '').trim()).filter(Boolean)
  )];
  return { baseItems, addonItems, selectedServices, baseTotal, addonsTotal, finalTotal };
};

// ─── Shared mini-components ───────────────────────────────────────────────────

const SectionLabel = ({ children, icon }) => (
  <View style={u.sectionRow}>
    {!!icon && <Ionicons name={icon} size={14} color={theme.colors.primary} />}
    <Text style={u.sectionLabel}>{children}</Text>
  </View>
);

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const color = statusColors[status] || '#6B7280';
  return (
    <View style={[u.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[u.badgeText, { color }]}>{t(`status.${status}`)}</Text>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminJobsScreen({ route, navigation }) {
  const [selectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const mode       = route?.params?.mode     || 'all';
  const roleMode   = route?.params?.roleMode || 'admin';
  const isWorkerView = roleMode === 'worker';
  const { user, logout } = useAuth();
  const { startTracking } = useLocationTracking();
  const settings = useSettings();
  const { t } = useTranslation();
  const headerHeight = useHeaderHeight(); // ← used to push content below transparent nav
  const shouldEnsureLocalTracking = isWorkerView && user?.role !== 'Employee';

  // ── State ─────────────────────────────────────────────────────────────────
  const [bookings,                  setBookings]                  = useState([]);
  const workerBookings = isWorkerView ? bookings : [];
  const [loading,                   setLoading]                   = useState(true);
  const [refreshing,                setRefreshing]                = useState(false);
  const [updatingId,                setUpdatingId]                = useState(null);
  const [error,                     setError]                     = useState('');
  const [selectedWorkerBookingId,   setSelectedWorkerBookingId]   = useState(null);
  const [startedAtByBooking,        setStartedAtByBooking]        = useState({});
  const [pausedAtByBooking,         setPausedAtByBooking]         = useState({});
  const [accumulatedPausedByBooking,setAccumulatedPausedByBooking]= useState({});
  const [pauseModalVisible,         setPauseModalVisible]         = useState(false);
  const [pauseReason,               setPauseReason]               = useState('');
  const [pauseBookingId,            setPauseBookingId]            = useState(null);
  // Photo capture flow
  const [photoModal,                setPhotoModal]                = useState({ visible: false, bookingId: null, photoType: 'Before', onDone: null });
  const [capturedPhoto,             setCapturedPhoto]             = useState(null);
  const [photoUploading,            setPhotoUploading]            = useState(false);
  const [updatingChecklistId,       setUpdatingChecklistId]       = useState(null);
  const [completionSummary,         setCompletionSummary]         = useState(null);
  const [lateModalVisible,          setLateModalVisible]          = useState(false);
  const [lateBookingId,             setLateBookingId]             = useState(null);
  const [lateMinutes,               setLateMinutes]               = useState('10');
  const [lateReason,                setLateReason]                = useState('Traffic delay');
  const [finishConfirmVisible,      setFinishConfirmVisible]      = useState(false);
  const [finishBookingId,           setFinishBookingId]           = useState(null);
  const [salesKitModalVisible,      setSalesKitModalVisible]      = useState(false);
  const [salesKitBookingId,         setSalesKitBookingId]         = useState(null);
  const [availableServices,         setAvailableServices]         = useState([]);
  const [selectedSalesKitServiceIds,setSelectedSalesKitServiceIds]= useState([]);
  const [loadingPackages,           setLoadingPackages]           = useState(false);
  const [,                          setTick]                      = useState(0);
  const [detailBooking,             setDetailBooking]             = useState(null);
  const [periodFilter,              setPeriodFilter]              = useState(mode === 'today' ? 'today' : 'all');
  const [statusFilter,              setStatusFilter]              = useState('All');
  const [unassignedOpen,            setUnassignedOpen]            = useState(true);
  const [assignModalBooking,        setAssignModalBooking]        = useState(null);
  const [assignWorkersList,         setAssignWorkersList]         = useState([]);
  const [loadingWorkers,            setLoadingWorkers]            = useState(false);
  const [assigningWorkerId,         setAssigningWorkerId]         = useState(null);
  const [requestActionLoading,      setRequestActionLoading]      = useState(null); // 'approve-cancel' | 'reject-cancel' | 'approve-reschedule' | 'reject-reschedule'
  const [reminderDismissed,      setReminderDismissed]      = useState({}); // dismissed booking IDs

  // Check if worker is currently on a job OR has already left (notified "On My Way")
  const hasActiveJob = useMemo(() => {
    if (!isWorkerView) return false;
    return workerBookings.some((b) => {
      if (b.status === 'InProgress') return true;
      if ((b.status === 'Pending' || b.status === 'Confirmed') && b.workerOnMyWayAt) return true;
      return false;
    });
  }, [isWorkerView, workerBookings]);

  const nextUpcomingJob = useMemo(() => {
    if (!isWorkerView) return null;
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    return workerBookings
      .filter((b) => {
        if (b.status === 'Completed' || b.status === 'Cancelled') return false;
        if (reminderDismissed[b.id]) return false;
        const dateKey = extractDateKey(b.scheduledDate);
        if (!dateKey) return false;
        return dateKey >= todayKey;
      })
      .sort((a, b) => getBookingSortValue(a) - getBookingSortValue(b))[0] || null;
  }, [workerBookings, isWorkerView, reminderDismissed]);

  const minutesUntilNextJob = useMemo(() => {
    if (!nextUpcomingJob) return null;
    const now = new Date();
    const slotStart = getTimeSlotStartMinutes(nextUpcomingJob.timeSlot);
    if (slotStart === Number.POSITIVE_INFINITY) return null;
    const travelBuffer = settings?.workerTravelBufferMinutes || 30;
    const schedDate = new Date(nextUpcomingJob.scheduledDate);
    schedDate.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);
    const departureTime = schedDate.getTime() - (travelBuffer * 60000);
    const diffMs = departureTime - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins >= 0 ? diffMins : null;
  }, [nextUpcomingJob, settings?.workerTravelBufferMinutes]);

  const reminderMinutes = useMemo(() => {
    return settings?.workerReminderBeforeTravelMinutes || 5;
  }, [settings?.workerReminderBeforeTravelMinutes]);

  const showReminder = isWorkerView && nextUpcomingJob && !hasActiveJob && minutesUntilNextJob !== null && minutesUntilNextJob <= reminderMinutes && minutesUntilNextJob >= 0;

  const inFlightActionsRef = useRef(new Set());
  const beginAction = (key) => {
    if (inFlightActionsRef.current.has(key)) return false;
    inFlightActionsRef.current.add(key); return true;
  };
  const endAction = (key) => inFlightActionsRef.current.delete(key);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    try {
      setError('');
      const data = isWorkerView
        ? await bookingsAPI.getWorkerBookings()
        : await bookingsAPI.getAll();
      const nextBookings = data || [];
      setBookings((prevBookings) =>
        nextBookings.map((nb) => {
          const ob = prevBookings.find((b) => b.id === nb.id);
          if (!ob || !nb.checklistItems) return nb;
          return {
            ...nb,
            checklistItems: (nb.checklistItems || []).map((ni) => {
              const oi = (ob.checklistItems || []).find((i) => i.id === ni.id);
              if (!oi) return ni;
              return {
                ...ni,
                startTime: oi.startTime ?? ni.startTime,
                finishTime: oi.finishTime ?? ni.finishTime,
                firstCompletedAt: oi.firstCompletedAt ?? ni.firstCompletedAt,
                completedDuration: oi.completedDuration ?? ni.completedDuration,
                accumulatedDuration: oi.accumulatedDuration ?? ni.accumulatedDuration,
                lastUncheckedAt: oi.lastUncheckedAt ?? ni.lastUncheckedAt,
                isCompleted: oi.isCompleted ?? ni.isCompleted,
              };
            }),
          };
        })
      );
      if (isWorkerView) {
        setStartedAtByBooking((prev) => {
          const next = { ...prev };
          nextBookings.forEach((b) => {
            if (b.status === 'InProgress') {
              const ms = b.workStartedAt ? Date.parse(b.workStartedAt) : NaN;
              if (Number.isFinite(ms)) next[b.id] = next[b.id] || ms;
            } else if (b.status === 'Completed') {
              delete next[b.id];
            }
          });
          return next;
        });
      }
    } catch (err) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.message;
      if (status === 401) { setError('Session expired. Please log in again.'); return; }
      if (status === 403) { setError('Your account is not allowed to load these bookings.'); return; }
      setError(message || 'Failed to load bookings.');
    }
  }, [isWorkerView]);

  useEffect(() => {
    const run = async () => { setLoading(true); await loadBookings(); setLoading(false); };
    run();
  }, [loadBookings]);

  const onRefresh = async () => { setRefreshing(true); await loadBookings(); setRefreshing(false); };

  useEffect(() => {
    return subscribeToNotifications(() => { loadBookings(); });
  }, [loadBookings]);

  useEffect(() => {
    const id = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setPeriodFilter(mode === 'today' ? 'today' : 'all'); }, [mode]);

  // Deep-link from notification tap — open detail modal for the target booking
  useEffect(() => {
    const openId = route?.params?.openBookingId;
    if (!openId || bookings.length === 0) return;
    const target = bookings.find((b) => b.id === Number(openId));
    if (target) setDetailBooking(target);
  }, [route?.params?.openBookingId, bookings]);

  // ── Derived: visible bookings ──────────────────────────────────────────────
  const visibleBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => getBookingSortValue(a) - getBookingSortValue(b));
    const base = (mode === 'today' || isWorkerView)
      ? sorted.filter((b) => isWorkerView
          ? isWithinWorkerWindow(b.scheduledDate, new Date())
          : isSameDay(b.scheduledDate, new Date()))
      : sorted;
    if (!isWorkerView) return base;
    if (user?.workingDays && user?.shiftStart && user?.shiftEnd) {
      const allowedDays = user.workingDays.split(',').map((d) => d.trim());
      const [ssh, ssm] = user.shiftStart.split(':').map(Number);
      const [seh, sem] = user.shiftEnd.split(':').map(Number);
      const shiftStart = ssh * 60 + ssm;
      const shiftEnd   = seh * 60 + sem;
      return base.filter((b) => {
        if (b.assignedWorkerId != null && Number(b.assignedWorkerId) === Number(user.id)) return true;
        if (b.assignedWorkerId == null && b.status !== 'Completed' && b.status !== 'Cancelled') {
          const day = new Date(b.scheduledDate).toLocaleDateString('en-US', { weekday: 'long' });
          if (!allowedDays.includes(day)) return false;
          const slot = getTimeSlotRange(b.timeSlot);
          if (!slot) return false;
          const jobDuration = b.estimatedDurationMinutes || 60;
          if (slot.start < shiftStart) return false;
          if (slot.end + jobDuration > shiftEnd) return false;
          return !bookings.some((ob) => {
            if (!ob || ob.id === b.id) return false;
            if (ob.status === 'Cancelled' || ob.status === 'Completed') return false;
            if (Number(ob.assignedWorkerId) !== Number(user.id)) return false;
            if (extractDateKey(ob.scheduledDate) !== extractDateKey(b.scheduledDate)) return false;
            const os = getTimeSlotRange(ob.timeSlot);
            return os ? slotsOverlap(slot, os) : false;
          });
        }
        return false;
      });
    }
    return base;
  }, [bookings, mode, isWorkerView, user]);

  const isOwnedByCurrentWorker = useCallback((b) => {
    if (!isWorkerView || b?.assignedWorkerId == null || user?.id == null) return false;
    return Number(b.assignedWorkerId) === Number(user.id);
  }, [isWorkerView, user?.id]);

  const summary = useMemo(() => {
    const jobs = isWorkerView ? visibleBookings.filter(isOwnedByCurrentWorker) : visibleBookings;
    return {
      total:     jobs.length,
      pending:   jobs.filter((b) => b.status === 'Pending').length,
      active:    jobs.filter((b) => b.status === 'Confirmed' || b.status === 'InProgress').length,
      completed: jobs.filter((b) => b.status === 'Completed').length,
    };
  }, [visibleBookings, isWorkerView, isOwnedByCurrentWorker]);

  const selectedWorkerBooking = useMemo(() =>
    isWorkerView && selectedWorkerBookingId != null
      ? visibleBookings.find((b) => b.id === selectedWorkerBookingId) || null
      : null,
  [isWorkerView, selectedWorkerBookingId, visibleBookings]);

  const salesKitBooking = useMemo(() =>
    salesKitBookingId != null ? bookings.find((b) => b.id === salesKitBookingId) || null : null,
  [bookings, salesKitBookingId]);

  const includedServiceNamesInSalesKitBooking = useMemo(() => {
    const names = new Set();
    (salesKitBooking?.items || []).forEach((item) =>
      (item.includedServices || []).forEach((s) => {
        const n = String(s || '').trim().toLowerCase();
        if (n) names.add(n);
      })
    );
    return names;
  }, [salesKitBooking]);

  const salesKitServices = useMemo(() =>
    (availableServices || []).filter((s) => {
      if (!s?.isActive) return false;
      const n = String(s.name || '').trim().toLowerCase();
      return n && !includedServiceNamesInSalesKitBooking.has(n);
    }),
  [availableServices, includedServiceNamesInSalesKitBooking]);

  useEffect(() => {
    if (!isWorkerView || selectedWorkerBookingId == null) return;
    if (!visibleBookings.some((b) => b.id === selectedWorkerBookingId)) setSelectedWorkerBookingId(null);
  }, [isWorkerView, selectedWorkerBookingId, visibleBookings]);

  // ── Admin computed ─────────────────────────────────────────────────────────
  const adminFilteredBookings = useMemo(() => {
    if (isWorkerView) return [];
    const now      = new Date();
    const todayKey = toLocalDateKey(now);
    const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndKey = toLocalDateKey(weekEnd);
    let filtered   = [...bookings].sort((a, b) => getBookingSortValue(a) - getBookingSortValue(b));
    if (mode === 'today') {
      filtered = filtered.filter((b) => extractDateKey(b.scheduledDate) === todayKey);
    } else {
      if (periodFilter === 'today')         filtered = filtered.filter((b) => extractDateKey(b.scheduledDate) === todayKey);
      else if (periodFilter === 'week')     filtered = filtered.filter((b) => { const k = extractDateKey(b.scheduledDate); return k >= todayKey && k <= weekEndKey; });
      else if (periodFilter === 'upcoming') filtered = filtered.filter((b) => { const k = extractDateKey(b.scheduledDate); return k >= todayKey && b.status !== 'Completed' && b.status !== 'Cancelled'; });
    }
    if (statusFilter !== 'All') filtered = filtered.filter((b) => b.status === statusFilter);
    return filtered;
  }, [isWorkerView, bookings, mode, periodFilter, statusFilter]);

  const adminGroupedByDate = useMemo(() => {
    const groups = {};
    adminFilteredBookings.forEach((b) => {
      const key = extractDateKey(b.scheduledDate) || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [adminFilteredBookings]);

  const adminUnassigned = useMemo(() => {
    if (isWorkerView) return [];
    const todayKey = toLocalDateKey(new Date());
    return bookings
      .filter((b) => !b.assignedWorkerId && b.status !== 'Completed' && b.status !== 'Cancelled' && (extractDateKey(b.scheduledDate) || '') >= todayKey)
      .sort((a, b) => getBookingSortValue(a) - getBookingSortValue(b));
  }, [isWorkerView, bookings]);

  const getClaimConflict = useCallback((target) => {
    if (!target || user?.id == null) return null;
    const targetDateKey = extractDateKey(target.scheduledDate);
    const targetSlot    = getTimeSlotRange(target.timeSlot);
    if (!targetDateKey || !targetSlot) return null;
    return bookings.find((b) => {
      if (!b || b.id === target.id) return false;
      if (b.status === 'Cancelled' || b.status === 'Completed') return false;
      if (Number(b.assignedWorkerId) !== Number(user.id)) return false;
      if (extractDateKey(b.scheduledDate) !== targetDateKey) return false;
      const bs = getTimeSlotRange(b.timeSlot);
      return bs ? slotsOverlap(targetSlot, bs) : false;
    }) || null;
  }, [bookings, user?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const callCustomer = async (phone) => { if (phone) await Linking.openURL(`tel:${phone}`); };
  const callDispatch  = async () => {
    const phone = settings?.businessConfig?.phone || '+974 4444 4444';
    await Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const openAssignModal = async (booking) => {
    setAssignModalBooking(booking);
    setAssignWorkersList([]);
    setLoadingWorkers(true);
    try {
      const data = await authAPI.getWorkers();
      setAssignWorkersList((data || []).filter((w) => w.isActive));
    } catch {
      Alert.alert(t('common.error'), t('adminJobs.failedLoadWorkers'));
    } finally {
      setLoadingWorkers(false);
    }
  };

  const assignWorkerToBooking = async (workerId) => {
    if (!assignModalBooking || assigningWorkerId) return;
    setAssigningWorkerId(workerId);
    try {
      await bookingsAPI.assignWorker(assignModalBooking.id, workerId);
      await loadBookings();
      setAssignModalBooking(null);
    } catch (err) {
      // Phase 2B — specific 409 conflict message shows which booking blocks the slot
      if (err?.response?.status === 409) {
        const conflict = err.response.data?.conflictingBookingNumber;
        Alert.alert(
          t('adminJobs.workerUnavailable'),
          conflict
            ? t('adminJobs.workerOverlapBooking', { bookingNumber: conflict })
            : t('adminJobs.workerConflictGeneric'),
        );
      } else {
        Alert.alert(t('adminJobs.assignmentFailed'), err?.response?.data?.message || t('adminJobs.failedAssignWorker'));
      }
    } finally {
      setAssigningWorkerId(null);
    }
  };

  const openInGoogleMaps = async (address) => {
    const addr = String(address || '').trim();
    if (!addr) { Alert.alert(t('alerts.addressUnavailable.title'), t('alerts.addressUnavailable.message')); return; }
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`);
    } catch { Alert.alert(t('alerts.mapsError.title'), t('alerts.mapsError.message')); }
  };

  const updateStatus = async (bookingId, status) => {
    const key = `status-${bookingId}-${status}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(bookingId);
      const b = bookings.find((x) => x.id === bookingId);
      // ── State machine guard ─────────────────────────────────────────────────
      if (b && !canTransition(b.status, status, 'admin')) {
        Alert.alert(
          t('adminJobs.invalidStatusChange'),
          t('adminJobs.invalidStatusChangeMessage', { fromStatus: b.status, toStatus: status }),
        );
        endAction(key);
        setUpdatingId(null);
        return;
      }
      // ── Timer reset when admin undoes a Completed job ──────────────────────
      if (b?.status === 'Completed' && status === 'Confirmed') {
        setStartedAtByBooking((p) => ({ ...p, [bookingId]: null }));
        setPausedAtByBooking((p) => ({ ...p, [bookingId]: null }));
        setAccumulatedPausedByBooking((p) => ({ ...p, [bookingId]: 0 }));
      }
      await bookingsAPI.updateStatus(bookingId, status);
      await loadBookings();
    } catch (err) {
      setError(err?.response?.data?.message || t('errors.updateStatus'));
    } finally { setUpdatingId(null); endAction(key); }
  };

  const handleApproveCancellation = (booking) => {
    Alert.alert(
      t('adminJobs.approveCancellation'),
      t('adminJobs.cancelBookingConfirm', { customerName: booking.customerName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('adminJobs.approveAndCancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              setRequestActionLoading('approve-cancel');
              await bookingsAPI.cancel(booking.id);
              await loadBookings();
              setDetailBooking(null);
            } catch (err) {
              Alert.alert(t('common.error'), err?.response?.data?.message || t('adminJobs.failedCancelBooking'));
            } finally {
              setRequestActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleRejectCancellation = async (bookingId) => {
    try {
      setRequestActionLoading('reject-cancel');
      await bookingsAPI.rejectCancellationRequest(bookingId);
      await loadBookings();
      setDetailBooking((prev) => prev ? { ...prev, cancellationRequested: false, cancellationRequestReason: null } : null);
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminJobs.failedRejectCancellationRequest'));
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleApproveReschedule = (booking) => {
    const preferredDate = booking.reschedulePreferredDate
      ? new Date(booking.reschedulePreferredDate).toLocaleDateString()
      : null;
    Alert.alert(
      t('adminJobs.approveReschedule'),
      preferredDate
        ? t('adminJobs.updateBookingDateTo', { date: preferredDate })
        : t('adminJobs.noPreferredDateProvided'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('adminJobs.confirm'),
          onPress: async () => {
            try {
              setRequestActionLoading('approve-reschedule');
              const newDate = booking.reschedulePreferredDate
                ? new Date(booking.reschedulePreferredDate).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
              await bookingsAPI.adminEdit(booking.id, { scheduledDate: newDate });
              await loadBookings();
              setDetailBooking((prev) => prev ? { ...prev, rescheduleRequested: false, scheduledDate: newDate } : null);
            } catch (err) {
              Alert.alert(t('common.error'), err?.response?.data?.message || t('adminJobs.failedApproveReschedule'));
            } finally {
              setRequestActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleRejectReschedule = async (bookingId) => {
    try {
      setRequestActionLoading('reject-reschedule');
      await bookingsAPI.rejectRescheduleRequest(bookingId);
      await loadBookings();
      setDetailBooking((prev) => prev ? { ...prev, rescheduleRequested: false, reschedulePreferredDate: null, rescheduleRequestNote: null } : null);
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminJobs.failedRejectRescheduleRequest'));
    } finally {
      setRequestActionLoading(null);
    }
  };

  const claimBooking = async (bookingId) => {
    const key = `claim-${bookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(bookingId);
      await bookingsAPI.claim(bookingId);
      await loadBookings();
      Alert.alert(t('alerts.claimSuccess.title'), t('alerts.claimSuccess.message'));
    } catch (err) {
      const msg = err?.response?.data?.message || t('errors.claimBooking');
      setError(msg); Alert.alert(t('alerts.cannotClaim.title'), msg);
    } finally { setUpdatingId(null); endAction(key); }
  };

  const claimBookingWithAvailabilityCheck = async (booking) => {
    const conflict = getClaimConflict(booking);
    if (conflict) {
      Alert.alert(t('adminJobs.cannotClaimThisJob'), t('adminJobs.claimOverlapMessage', { bookingNumber: conflict.bookingNumber, timeSlot: formatTimeAMPM(conflict.timeSlot) }));
      return;
    }
    await claimBooking(booking.id);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const openPhotoCapture = (bookingId, photoType, onDone) => {
    setCapturedPhoto(null);
    setPhotoModal({ visible: true, bookingId, photoType, onDone });
  };

  const handlePickPhoto = async () => {
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert(t('adminJobs.cameraPermission'), t('adminJobs.cameraPermissionRequired'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]) {
      setCapturedPhoto(result.assets[0]);
    }
  };

  const handleUploadAndProceed = async () => {
    const { bookingId, photoType, onDone } = photoModal;
    if (capturedPhoto) {
      try {
        setPhotoUploading(true);
        await bookingsAPI.uploadBookingPhoto(bookingId, { uri: capturedPhoto.uri, photoType });
      } catch {
        // Non-blocking — photo upload failure doesn't block the job action
      } finally {
        setPhotoUploading(false);
      }
    }
    setPhotoModal({ visible: false, bookingId: null, photoType: 'Before', onDone: null });
    setCapturedPhoto(null);
    if (onDone) onDone();
  };

  const startJob = async (bookingId) => {
    openPhotoCapture(bookingId, 'Before', async () => {
      const key = `start-${bookingId}`;
      if (!beginAction(key)) return;
      try {
        setUpdatingId(bookingId);
        const result      = await bookingsAPI.startJob(bookingId);
        const startedAtMs = result?.workStartedAt ? Date.parse(result.workStartedAt) : NaN;
        setStartedAtByBooking((p) => ({ ...p, [bookingId]: p[bookingId] || (Number.isFinite(startedAtMs) ? startedAtMs : Date.now()) }));
        setPausedAtByBooking((p)        => ({ ...p, [bookingId]: null }));
        setAccumulatedPausedByBooking((p) => ({ ...p, [bookingId]: 0  }));
        // Stop customer-visible tracking — job is now In Progress
        await realtimeService.stopCustomerStream(bookingId);
        await loadBookings();
      } catch (err) { setError(err?.response?.data?.message || t('errors.startJob')); }
      finally { setUpdatingId(null); endAction(key); }
    });
  };

  const markArrived = async (bookingId) => {
    const key = `arrived-${bookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(bookingId);
      await bookingsAPI.markArrived(bookingId);
      // Customer tracking must end when worker arrives.
      await realtimeService.stopCustomerStream(bookingId);
      await loadBookings();
    } catch (err) { setError(err?.response?.data?.message || t('errors.markArrived')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const markOnMyWay = async (bookingId) => {
    const key = `onmyway-${bookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(bookingId);
      if (shouldEnsureLocalTracking) {
        await startTracking(bookingId);
      }
      await bookingsAPI.markOnMyWay(bookingId);
      // Start customer-visible location stream — worker is En Route
      await realtimeService.startCustomerStream(bookingId);
      const targetBooking = bookings.find((b) => b.id === bookingId);
      const destinationAddress = String(targetBooking?.customerAddress || '').trim();
      if (destinationAddress) {
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}&travelmode=driving`;
        await Linking.openURL(mapsUrl).catch(() => {});
      }
      await loadBookings();
    } catch (err) { setError(err?.response?.data?.message || t('adminJobs.failedNotifyCustomer')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const openRunningLateModal = (bookingId) => {
    setLateBookingId(bookingId); setLateMinutes('10'); setLateReason(t('adminJobs.trafficDelayDefault')); setLateModalVisible(true);
  };

  const submitRunningLate = async () => {
    if (lateBookingId == null) return;
    const mins = Number.parseInt(String(lateMinutes).trim(), 10);
    if (!Number.isFinite(mins) || mins < 5 || mins > 120) { Alert.alert(t('alerts.invalidDelay.title'), t('alerts.invalidDelay.message')); return; }
    const reason = String(lateReason || '').trim();
    if (!reason) { Alert.alert(t('alerts.reasonRequired.title'), t('alerts.reasonRequired.message')); return; }
    const key = `late-${lateBookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(lateBookingId);
      await bookingsAPI.markRunningLate(lateBookingId, mins, reason);
      await loadBookings();
      setLateModalVisible(false); setLateBookingId(null);
    } catch (err) { setError(err?.response?.data?.message || t('errors.markLate')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const finishJob = (bookingId) => {
    openPhotoCapture(bookingId, 'After', () => {
      setFinishBookingId(bookingId);
      setFinishConfirmVisible(true);
    });
  };

  const confirmFinishJob = async () => {
    if (finishBookingId == null) return;
    const bookingId = finishBookingId;
    const key = `finish-${bookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(bookingId);
      const booking   = bookings.find((x) => x.id === bookingId);
      const result    = await bookingsAPI.finishJob(bookingId);
      const startedAt = startedAtByBooking[bookingId];
      const elapsedMinutes = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : null;
      setStartedAtByBooking((p) => { const n = { ...p }; delete n[bookingId]; return n; });
      await loadBookings();
      setSelectedWorkerBookingId(null);
      setCompletionSummary({
        bookingNumber: booking?.bookingNumber || `#${bookingId}`,
        customerName:  booking?.customerName || t('adminJobs.customerFallback'),
        durationText:  result?.workDurationSeconds
          ? formatWorkDuration(result.workDurationSeconds)
          : (elapsedMinutes ? `${String(elapsedMinutes).padStart(2, '0')}:00` : null),
      });
      setFinishConfirmVisible(false); setFinishBookingId(null);
    } catch (err) { setError(err?.response?.data?.message || t('errors.finishJob')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const openSalesKit = async (bookingId) => {
    setSalesKitBookingId(bookingId); setSelectedSalesKitServiceIds([]); setLoadingPackages(true);
    try {
      const services = await servicesAPI.getAll();
      setAvailableServices(services || []);
    } catch { Alert.alert(t('common.error'), t('errors.loadServices')); }
    finally { setLoadingPackages(false); setSalesKitModalVisible(true); }
  };

  const toggleSalesKitService = (serviceId) =>
    setSelectedSalesKitServiceIds((p) =>
      p.includes(serviceId) ? p.filter((id) => id !== serviceId) : [...p, serviceId]
    );

  const confirmSalesKitSelection = async () => {
    if (!salesKitBookingId || selectedSalesKitServiceIds.length === 0) return;
    const key = `confirm-sales-kit-${salesKitBookingId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingId(salesKitBookingId);
      let latest = null;
      // Stage 2 upsell commitment: add each service, which persists the booking
      // extension on the backend (Booking.EndTime updated, future availability recalculated).
      for (const sid of selectedSalesKitServiceIds) {
        latest = await bookingsAPI.addService(salesKitBookingId, sid, 1);
      }
      if (latest?.id) setBookings((p) => p.map((b) => b.id === latest.id ? latest : b));
      else await loadBookings();
      setSelectedSalesKitServiceIds([]); setSalesKitModalVisible(false);
      Alert.alert(
        t('adminJobs.upsellsConfirmed'),
        t('adminJobs.upsellsConfirmedMessage'),
      );
    } catch (err) { Alert.alert(t('common.error'), err?.response?.data?.message || t('errors.applyServices')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const updateChecklistItem = async (bookingId, checklistItemId, isCompleted) => {
    const key = `checklist-${bookingId}-${checklistItemId}`;
    if (!beginAction(key)) return;
    try {
      setUpdatingChecklistId(checklistItemId);
      const booking  = bookings.find((b) => b.id === bookingId);
      const checklist = [...(booking?.checklistItems || [])].sort((a, b) => a.displayOrder - b.displayOrder);
      const idx  = checklist.findIndex((i) => i.id === checklistItemId);
      const item = checklist[idx];
      const jobStartedAt = startedAtByBooking[bookingId] || Date.now();
      let lockedStartTime;
      if (item.startTime != null) {
        lockedStartTime = typeof item.startTime === 'string' ? new Date(item.startTime).getTime() : item.startTime;
      } else if (idx === 0) {
        lockedStartTime = jobStartedAt;
      } else {
        const prev = checklist[idx - 1];
        const pff  = prev?.firstCompletedAt ?? prev?.completedAt ?? null;
        lockedStartTime = pff ? (typeof pff === 'string' ? new Date(pff).getTime() : pff) : jobStartedAt;
      }
      let finishTime = null, completedDuration = 0, lastUncheckedAt = item.lastUncheckedAt ?? null;
      if (isCompleted) {
        finishTime = Date.now();
        const prevAcc = item.completedDuration ?? item.accumulatedDuration ?? 0;
        if (lastUncheckedAt) {
          completedDuration = prevAcc + Math.max(0, Math.floor((finishTime - lastUncheckedAt) / 1000));
          lastUncheckedAt   = null;
        } else if (!item.isCompleted) {
          completedDuration = Math.max(0, Math.floor((finishTime - lockedStartTime) / 1000));
        } else { completedDuration = prevAcc; }
      } else {
        completedDuration = item.completedDuration ?? item.accumulatedDuration ?? 0;
        lastUncheckedAt   = Date.now();
      }
      const firstCompletedAt = isCompleted && !item.firstCompletedAt ? Date.now() : (item.firstCompletedAt ?? null);
      const updatedItem = await bookingsAPI.updateChecklistItem(bookingId, checklistItemId, isCompleted, completedDuration, lockedStartTime, finishTime);
      setBookings((p) => p.map((b) => b.id !== bookingId ? b : {
        ...b,
        checklistItems: (b.checklistItems || []).map((it) =>
          it.id !== checklistItemId ? it : { ...it, ...updatedItem, completedDuration, accumulatedDuration: completedDuration, startTime: lockedStartTime, finishTime, firstCompletedAt, lastUncheckedAt, isCompleted }
        ),
      }));
    } catch (err) { setError(err?.response?.data?.message || t('errors.updateChecklist')); }
    finally { setUpdatingChecklistId(null); endAction(key); }
  };

  const formatElapsed = (bookingId) => {
    const startedAt = startedAtByBooking[bookingId];
    if (!startedAt) return null;
    const pausedAt         = pausedAtByBooking[bookingId];
    const accumulatedPaused = accumulatedPausedByBooking[bookingId] || 0;
    const elapsed = pausedAt
      ? Math.max(0, Math.floor((pausedAt - startedAt - accumulatedPaused) / 1000))
      : Math.max(0, Math.floor((Date.now() - startedAt - accumulatedPaused) / 1000));
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const pauseJob = (bookingId) => { setPauseBookingId(bookingId); setPauseReason(''); setPauseModalVisible(true); };

  const confirmPauseJob = async () => {
    if (!pauseBookingId) return;
    const now = Date.now();
    setPausedAtByBooking((p) => ({ ...p, [pauseBookingId]: now }));
    setPauseModalVisible(false);
    try {
      await bookingsAPI.pauseJob(pauseBookingId, pauseReason);
    } catch (err) {
      setError(err?.response?.data?.message || t('adminJobs.failedPauseJob'));
      // Revert optimistic timer update on failure
      setPausedAtByBooking((p) => { const n = { ...p }; delete n[pauseBookingId]; return n; });
    }
    setPauseBookingId(null); setPauseReason('');
  };

  const resumeJob = async (bookingId) => {
    const key = `resume-${bookingId}`;
    if (!beginAction(key)) return;
    const pausedAt = pausedAtByBooking[bookingId];
    if (!pausedAt) { endAction(key); return; }
    const now = Date.now();
    setAccumulatedPausedByBooking((p) => ({ ...p, [bookingId]: (p[bookingId] || 0) + (now - pausedAt) }));
    setPausedAtByBooking((p) => ({ ...p, [bookingId]: null }));
    try {
      setUpdatingId(bookingId);
      await bookingsAPI.resumeJob(bookingId);
    } catch (err) { setError(err?.response?.data?.message || t('errors.resumeJob')); }
    finally { setUpdatingId(null); endAction(key); }
  };

  const formatWorkDuration = (secs) => {
    if (!Number.isFinite(secs) || secs < 0) return null;
    const total = Math.floor(secs);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  // ── Upcoming job alert (worker) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isWorkerView) return;
    const check = () => {
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000);
      const job = visibleBookings.find((b) => {
        if (b.status !== 'Confirmed') return false;
        const slot = getTimeSlotRange(b.timeSlot);
        if (!slot) return false;
        const start = new Date(b.scheduledDate);
        start.setHours(Math.floor(slot.start / 60), slot.start % 60, 0);
        return start > now && start <= soon;
      });
      if (job) {
        const slot    = getTimeSlotRange(job.timeSlot);
        const start   = new Date(job.scheduledDate);
        start.setHours(Math.floor(slot.start / 60), slot.start % 60);
        const minutes = Math.round((start - now) / 60000);
        Alert.alert(t('alerts.upcomingJob.title'), t('alerts.upcomingJob.message', {
          customerName: job.customerName,
          vehicle: `${job.vehicleYear || ''} ${job.vehicleMake || ''}`.trim(),
          minutes,
          time: formatTimeAMPM(job.timeSlot)
        }), [{ text: t('common.ok') }]);
      }
    };
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [isWorkerView, visibleBookings]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WORKER VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (isWorkerView) {
    const CompletionModal = completionSummary ? (
      <Modal transparent animationType="fade" visible onRequestClose={() => setCompletionSummary(null)}>
        <View style={m.backdrop}>
          <View style={m.card}>
            <View style={m.successRing}>
              <Ionicons name="checkmark" size={32} color="#052E16" />
            </View>
            <Text style={m.eyebrow}>{t('adminJobs.jobFinished')}</Text>
            <Text style={m.title}>{completionSummary.bookingNumber}</Text>
            <Text style={m.body}>{t('adminJobs.detailingCompleteNotified', { customerName: completionSummary.customerName })}</Text>
            <View style={m.statsRow}>
              {completionSummary.durationText && (
                <View style={m.statCard}>
                  <Text style={m.statLabel}>{t('adminJobs.duration')}</Text>
                  <Text style={m.statValue}>{completionSummary.durationText}</Text>
                </View>
              )}
              <View style={m.statCard}>
                <Text style={m.statLabel}>{t('adminJobs.status')}</Text>
                <Text style={m.statValue}>{t('adminJobs.customerUpdated')}</Text>
              </View>
            </View>
            <TouchableOpacity style={m.primaryBtn} onPress={() => setCompletionSummary(null)}>
              <Text style={m.primaryBtnText}>{t('adminJobs.backToJobs')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ) : null;

    const LateModal = lateModalVisible ? (
      <Modal transparent animationType="fade" visible onRequestClose={() => setLateModalVisible(false)}>
        <View style={m.backdrop}>
          <View style={m.card}>
            <Text style={m.eyebrow}>{t('adminJobs.notifyDelay')}</Text>
            <Text style={m.title}>{t('adminJobs.runningLate')}</Text>
            <Text style={m.body}>{t('adminJobs.tellCustomerDelayWhy')}</Text>
            <View style={m.fieldWrap}>
              <Text style={m.fieldLabel}>{t('adminJobs.delayMinutes')}</Text>
              <TextInput value={lateMinutes} onChangeText={setLateMinutes} keyboardType="number-pad" placeholder="10" placeholderTextColor="#64748B" style={m.input} maxLength={3} />
            </View>
            <View style={m.fieldWrap}>
              <Text style={m.fieldLabel}>{t('adminJobs.reason')}</Text>
              <TextInput value={lateReason} onChangeText={setLateReason} placeholder={t('adminJobs.trafficDelayDefault')} placeholderTextColor="#64748B" style={[m.input, m.inputMulti]} multiline numberOfLines={3} maxLength={250} />
            </View>
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setLateModalVisible(false)}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={submitRunningLate} disabled={lateBookingId != null && updatingId === lateBookingId}>
                <Text style={m.primaryBtnText}>{lateBookingId != null && updatingId === lateBookingId ? t('common.sending') : t('adminJobs.sendNotice')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

    const PhotoCaptureModal = photoModal.visible ? (
      <Modal transparent animationType="slide" visible onRequestClose={() => {
        setPhotoModal({ visible: false, bookingId: null, photoType: 'Before', onDone: null });
        setCapturedPhoto(null);
      }}>
        <View style={m.backdrop}>
          <View style={[m.card, { maxHeight: '90%' }]}>
            <Text style={m.eyebrow}>{photoModal.photoType === 'Before' ? t('adminJobs.beforeJobPhoto') : t('adminJobs.afterJobPhoto')}</Text>
            <Text style={m.title}>{photoModal.photoType === 'Before' ? t('adminJobs.captureBeforeState') : t('adminJobs.captureAfterState')}</Text>
            <Text style={[m.body, { marginBottom: 12 }]}>
              {photoModal.photoType === 'Before'
                ? t('adminJobs.takePhotoBeforeWork')
                : t('adminJobs.takePhotoAfterWork')}
            </Text>

            {/* Alignment overlay placeholder */}
            <View style={{
              width: '100%', height: 180, borderRadius: 12, marginBottom: 12,
              backgroundColor: '#0f172a', borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {capturedPhoto ? (
                <Image source={{ uri: capturedPhoto.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  {/* Car silhouette guide */}
                  <View style={{
                    width: 120, height: 55, borderRadius: 8,
                    borderWidth: 2, borderColor: 'rgba(200,169,107,0.5)',
                    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="car-outline" size={32} color="rgba(200,169,107,0.6)" />
                  </View>
                  <Text style={{ color: 'rgba(200,169,107,0.7)', fontSize: 11, textAlign: 'center' }}>
                    {t('adminJobs.alignVehicleWithinFrame')}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={handlePickPhoto}
              style={[m.primaryBtn, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(200,169,107,0.4)', marginBottom: 8 }]}>
              <Ionicons name="camera-outline" size={18} color="#c8a96b" style={{ marginRight: 6 }} />
              <Text style={[m.primaryBtnText, { color: '#c8a96b' }]}>{capturedPhoto ? t('adminJobs.retakePhoto') : t('adminJobs.openCamera')}</Text>
            </TouchableOpacity>

            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => {
                setPhotoModal({ visible: false, bookingId: null, photoType: 'Before', onDone: null });
                setCapturedPhoto(null);
              }}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.primaryBtn, { flex: 1, marginTop: 0 }]}
                onPress={handleUploadAndProceed}
                disabled={photoUploading}>
                <Text style={m.primaryBtnText}>
                  {photoUploading ? t('adminJobs.uploading') : capturedPhoto ? t('adminJobs.saveContinue') : t('adminJobs.skipPhoto')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

    const FinishModal = finishConfirmVisible ? (
      <Modal transparent animationType="fade" visible onRequestClose={() => setFinishConfirmVisible(false)}>
        <View style={m.backdrop}>
          <View style={m.card}>
            <Text style={m.eyebrow}>{t('adminJobs.confirmAction')}</Text>
            <Text style={m.title}>{t('adminJobs.finishJobQuestion')}</Text>
            <Text style={m.body}>{t('adminJobs.finishJobExplain')}</Text>
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setFinishConfirmVisible(false)}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={confirmFinishJob} disabled={finishBookingId != null && updatingId === finishBookingId}>
                <Text style={m.primaryBtnText}>{finishBookingId != null && updatingId === finishBookingId ? t('common.finishing') : t('adminJobs.yesFinish')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

    const PauseModal = pauseModalVisible ? (
      <Modal transparent animationType="fade" visible onRequestClose={() => setPauseModalVisible(false)}>
        <View style={m.backdrop}>
          <View style={m.card}>
            <Text style={m.eyebrow}>{t('adminJobs.pauseJob')}</Text>
            <Text style={m.title}>{t('adminJobs.reasonForPause')}</Text>
            <Text style={m.body}>{t('adminJobs.pauseNotifyBoth')}</Text>
            <View style={m.fieldWrap}>
              <Text style={m.fieldLabel}>{t('adminJobs.reason')}</Text>
              <TextInput value={pauseReason} onChangeText={setPauseReason} placeholder={t('adminJobs.pauseReasonPlaceholder')} placeholderTextColor="#64748B" style={[m.input, m.inputMulti]} multiline numberOfLines={3} maxLength={250} />
            </View>
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setPauseModalVisible(false)}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={confirmPauseJob} disabled={!pauseReason.trim()}>
                <Text style={m.primaryBtnText}>{t('adminJobs.pauseJob')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ) : null;

    const SalesKitModal = salesKitModalVisible ? (
      <Modal transparent animationType="fade" visible onRequestClose={() => setSalesKitModalVisible(false)}>
        <View style={m.backdrop}>
          <View style={sk.card}>
            <View style={sk.header}>
              <View style={{ flex: 1 }}>
                <Text style={sk.eyebrow}>{t('adminJobs.serviceAddOns')}</Text>
                <Text style={sk.title}>{t('adminJobs.salesKit')}</Text>
                <Text style={sk.subtitle}>{t('adminJobs.addExtrasNotIncluded')}</Text>
              </View>
              <TouchableOpacity style={sk.closeBtn} onPress={() => setSalesKitModalVisible(false)}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={sk.metaCard}>
              <Text style={sk.metaPrimary}>{salesKitBooking?.bookingNumber || t('adminJobs.currentJob')}</Text>
              <Text style={sk.metaSecondary}>{salesKitBooking?.customerName || t('adminJobs.customerFallback')}</Text>
              <View style={sk.statsRow}>
                {[
                  { label: t('adminJobs.items'), value: (salesKitBooking?.items || []).reduce((s, i) => s + (i.quantity || 1), 0) },
                  { label: t('adminJobs.total'), value: formatQAR(salesKitBooking?.totalAmount || 0) },
                  { label: t('adminJobs.estimatedTime'), value: t('adminJobs.minutesShort', { count: salesKitBooking?.estimatedDurationMinutes || 0 }) },
                ].map(({ label, value }) => (
                  <View key={label} style={sk.statChip}>
                    <Text style={sk.statLabel}>{label}</Text>
                    <Text style={sk.statValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
            {loadingPackages ? (
              <View style={sk.loaderWrap}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
              <ScrollView style={sk.list}>
                {salesKitServices.length === 0 ? (
                  <Text style={sk.emptyText}>{t('adminJobs.allServicesAlreadyIncluded')}</Text>
                ) : (
                  salesKitServices.map((svc) => {
                    const isSelected = selectedSalesKitServiceIds.includes(svc.id);
                    return (
                      <TouchableOpacity key={svc.id} style={[sk.svcCard, isSelected && sk.svcCardSelected]} onPress={() => toggleSalesKitService(svc.id)} activeOpacity={0.8}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={sk.svcName}>{svc.name}</Text>
                          <Text style={sk.svcDesc}>{svc.description || t('adminJobs.professionalDetailingService')}</Text>
                          <Text style={sk.svcMeta}>{t('adminJobs.plusApproxMinutes', { count: Number(svc.defaultDurationMinutes || 0) })}</Text>
                        </View>
                        <View style={[sk.selectBadge, isSelected && sk.selectBadgeActive]}>
                          <Ionicons name={isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={isSelected ? '#22C55E' : theme.colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[sk.confirmBtn, (updatingId === salesKitBookingId || selectedSalesKitServiceIds.length === 0) && s.btnDisabled]}
              onPress={confirmSalesKitSelection}
              disabled={updatingId === salesKitBookingId || selectedSalesKitServiceIds.length === 0}
            >
              <Text style={sk.confirmBtnText}>
                {updatingId === salesKitBookingId ? t('common.applying') : t('adminJobs.confirmSelectionCount', { count: selectedSalesKitServiceIds.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => setSalesKitModalVisible(false)}>
              <Text style={m.cancelBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    ) : null;

    const ListView = () => {
      const myJobs        = visibleBookings.filter(isOwnedByCurrentWorker);
      const activeJobs    = myJobs.filter((b) => b.status !== 'Completed');
      const completedJobs = myJobs.filter((b) => b.status === 'Completed');
      const unassigned    = visibleBookings.filter((b) => !b.assignedWorkerId && b.status !== 'Completed' && b.status !== 'Cancelled');
      return (
        <>
          <View style={w.statsStrip}>
            {[
              { label: 'Jobs Today', value: summary.total,     color: theme.colors.primary },
              { label: 'Active',     value: summary.active,    color: '#C084FC' },
              { label: 'Completed',  value: summary.completed, color: '#84CC16' },
            ].map(({ label, value, color }, i, arr) => (
              <React.Fragment key={label}>
                <View style={w.statItem}>
                  <Text style={[w.statValue, { color }]}>{value}</Text>
                  <Text style={w.statLabel}>{label}</Text>
                </View>
                {i < arr.length - 1 && <View style={w.statDivider} />}
              </React.Fragment>
            ))}
          </View>
          {activeJobs.length > 0 && (
            <>
              <View style={w.groupHeader}>
                <View style={[w.groupDot, { backgroundColor: '#60A5FA' }]} />
                <Text style={[w.groupTitle, { color: '#60A5FA' }]}>Active Jobs</Text>
                <Text style={w.groupCount}>{activeJobs.length}</Text>
              </View>
              {activeJobs.map((b) => (
                <TouchableOpacity key={b.id} style={w.jobCard} onPress={() => setSelectedWorkerBookingId(b.id)} activeOpacity={0.75}>
                  <View style={[w.jobAccent, { backgroundColor: statusColors[b.status] || '#6B7280' }]} />
                  <View style={w.jobBody}>
                    <View style={w.jobTopRow}>
                      <Text style={w.jobTime}>{formatTimeAMPM(b.timeSlot)}</Text>
                      <StatusBadge status={b.status} />
                    </View>
                    <Text style={w.jobNumber}>{b.bookingNumber}</Text>
                    <Text style={w.jobCustomer}>{b.customerName}</Text>
                    <Text style={w.jobMeta} numberOfLines={1}>{b.customerAddress || t('adminJobs.noAddressSavedShort')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} style={{ alignSelf: 'center' }} />
                </TouchableOpacity>
              ))}
            </>
          )}
          {completedJobs.length > 0 && (
            <>
              <View style={w.groupHeader}>
                <View style={[w.groupDot, { backgroundColor: '#84CC16' }]} />
                <Text style={[w.groupTitle, { color: '#84CC16' }]}>Completed</Text>
                <Text style={w.groupCount}>{completedJobs.length}</Text>
              </View>
              {completedJobs.map((b) => (
                <View key={b.id} style={w.completedCard}>
                  <View style={w.completedLeft}>
                    <Text style={w.completedNumber}>{b.bookingNumber}</Text>
                    <Text style={w.completedCustomer}>{b.customerName}</Text>
                  </View>
                  <View style={w.completedRight}>
                    <Text style={w.completedTime}>{formatTimeAMPM(b.timeSlot)}</Text>
                    <Text style={w.completedDuration}>{formatWorkDuration(b.workDurationSeconds) || '—'}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          {unassigned.length > 0 && (
            <>
              <View style={w.groupHeader}>
                <View style={[w.groupDot, { backgroundColor: '#34D399' }]} />
                <Text style={[w.groupTitle, { color: '#34D399' }]}>Available to Claim</Text>
                <Text style={w.groupCount}>{unassigned.length}</Text>
              </View>
              {unassigned.map((b) => (
                <View key={b.id} style={[w.jobCard, w.claimCard]}>
                  <View style={[w.jobAccent, { backgroundColor: '#34D399' }]} />
                  <View style={w.jobBody}>
                    <View style={w.jobTopRow}>
                      <Text style={w.jobTime}>{formatTimeAMPM(b.timeSlot)}</Text>
                      <View style={w.availableBadge}><Text style={w.availableBadgeText}>Available</Text></View>
                    </View>
                    <Text style={w.jobNumber}>{b.bookingNumber}</Text>
                    <Text style={w.jobCustomer}>{b.customerName}</Text>
                    <Text style={w.jobMeta} numberOfLines={1}>{b.customerAddress || t('adminJobs.noAddressSavedShort')}</Text>
                    <Text style={w.estimatedDuration}>~{b.estimatedDurationMinutes || 60} min estimated</Text>
                    <TouchableOpacity style={[w.claimBtn, updatingId === b.id && s.btnDisabled]} onPress={() => claimBookingWithAvailabilityCheck(b)} disabled={updatingId === b.id}>
                      <Text style={w.claimBtnText}>{updatingId === b.id ? 'Claiming…' : 'Claim This Job'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
          {myJobs.length === 0 && unassigned.length === 0 && (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={s.emptyText}>{t('adminJobs.noJobsToday')}</Text>
            </View>
          )}
        </>
      );
    };

const DetailView = () => {
      const booking = selectedWorkerBooking;
      if (!booking) return null;
      const isMyJob                = isOwnedByCurrentWorker(booking);
      const hasArrived             = Boolean(booking.workerArrivedAt);
      const hasOnMyWay              = Boolean(booking.workerOnMyWayAt);
      const hasMarkedLate          = Boolean(booking.workerRunningLateAt);
      const hasStartedJob          = Boolean(booking.workStartedAt) || booking.status === 'InProgress' || booking.status === 'Completed';
      const arrivalCooldown        = getArrivalCooldownRemainingMs(booking.workerArrivedAt);
      const canSendArrivalOrDelay  = isMyJob && !hasStartedJob && booking.status !== 'Cancelled' && booking.status !== 'Completed';
      const canMarkArrived         = canSendArrivalOrDelay && hasOnMyWay && !hasArrived;
      const canMarkRunningLate     = canSendArrivalOrDelay && !hasArrived && !hasMarkedLate;
      const canStartJob            = booking.status === 'Pending' || booking.status === 'Confirmed';
      const completedDuration      = formatWorkDuration(booking.workDurationSeconds);
      const checklistItems         = [...(booking.checklistItems || [])].sort((a, b) => a.displayOrder - b.displayOrder);
      const completedCount         = checklistItems.filter((i) => i.isCompleted).length;
      const canToggleChecklist     = isMyJob && booking.status === 'InProgress';
      return (
        <View style={w.detailCard}>
          <TouchableOpacity style={w.backBtn} onPress={() => setSelectedWorkerBookingId(null)}>
            <Ionicons name="arrow-back" size={15} color={theme.colors.primary} />
            <Text style={w.backBtnText}>{t('adminJobs.backToOverview')}</Text>
          </TouchableOpacity>
          <View style={w.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={w.detailNumber}>{booking.bookingNumber}</Text>
              <Text style={w.detailCustomer}>{booking.customerName}</Text>
            </View>
            <StatusBadge status={booking.status} />
          </View>
          <View style={w.infoStrip}>
            <View style={w.infoItem}><Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} /><Text style={w.infoText}>{new Date(booking.scheduledDate).toLocaleDateString()}</Text></View>
            <View style={w.infoItem}><Ionicons name="time-outline" size={12} color={theme.colors.textMuted} /><Text style={w.infoText}>{formatTimeAMPM(booking.timeSlot)}</Text></View>
            <View style={w.infoItem}><Ionicons name="call-outline" size={12} color={theme.colors.textMuted} /><Text style={w.infoText}>{booking.customerPhone}</Text></View>
          </View>
          <Text style={w.vehicleText}>{[booking.vehicleYear, booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ')} · {booking.vehicleType}</Text>
          <Text style={w.durationHint}>Est. duration: ~{booking.estimatedDurationMinutes || 60} min</Text>
          <View style={w.statsStrip}>
            {[
              { label: 'Packages', value: (booking.items || []).reduce((s, i) => s + (i.quantity || 1), 0) },
              { label: 'Amount',   value: formatQAR(booking.totalAmount || 0) },
              { label: 'Duration', value: `${booking.estimatedDurationMinutes || 0}m` },
            ].map(({ label, value }, i, arr) => (
              <React.Fragment key={label}>
                <View style={w.statItem}><Text style={w.statValue}>{value}</Text><Text style={w.statLabel}>{label}</Text></View>
                {i < arr.length - 1 && <View style={w.statDivider} />}
              </React.Fragment>
            ))}
          </View>
          <SectionLabel icon="cube-outline">Packages</SectionLabel>
          <View style={w.pkgBox}>
            {(booking.items || []).map((item, idx) => (
              <Text key={`${booking.id}-item-${idx}`} style={w.pkgItem}>
                · {item.packageName} ×{item.quantity || 1} — {formatQAR(item.subtotal || 0)}
              </Text>
            ))}
          </View>
          <TouchableOpacity style={w.salesKitBtn} onPress={() => openSalesKit(booking.id)} disabled={updatingId === booking.id}>
            <Ionicons name="bag-add-outline" size={16} color="#fff" />
            <Text style={w.salesKitBtnText}>{t('adminJobs.salesKit')}</Text>
          </TouchableOpacity>
          <View style={w.timerCard}>
            <View style={{ flex: 1 }}>
              {booking.status === 'InProgress' ? (<><Text style={w.timerLabel}>Elapsed Time</Text><Text style={w.timerValue}>{formatElapsed(booking.id) || '00:00'}</Text></>) :
               booking.status === 'Completed' && completedDuration ? (<><Text style={w.timerLabel}>Total Duration</Text><Text style={[w.timerValue, { color: '#84CC16' }]}>{completedDuration}</Text></>) :
               (<><Text style={w.timerLabel}>Status</Text><Text style={w.timerIdle}>Ready to Start</Text></>)}
            </View>
            <View style={[w.timerDot, { backgroundColor: booking.status === 'InProgress' ? '#EF4444' : booking.status === 'Completed' ? '#22C55E' : '#475569' }]} />
          </View>
          <View style={w.quickRow}>
            <TouchableOpacity style={[w.quickBtn, w.quickBtnGreen]} onPress={() => callCustomer(booking.customerPhone)}>
              <Ionicons name="call-outline" size={15} color="#fff" />
              <Text style={w.quickBtnText}>{t('adminJobs.callCustomer')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[w.quickBtn, w.quickBtnPurple]} onPress={callDispatch}>
              <Ionicons name="call-outline" size={15} color="#fff" />
              <Text style={w.quickBtnText}>{t('adminJobs.dispatch')}</Text>
            </TouchableOpacity>
          </View>
          {!booking.assignedWorkerId && (
            <TouchableOpacity style={[w.actionBtn, w.actionBtnBlue, updatingId === booking.id && s.btnDisabled]} onPress={() => claimBookingWithAvailabilityCheck(booking)} disabled={updatingId === booking.id}>
              <Text style={w.actionBtnText}>{updatingId === booking.id ? 'Claiming…' : 'Claim Job'}</Text>
            </TouchableOpacity>
          )}
          {isMyJob && booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
            <>
              {!hasOnMyWay && (
                <TouchableOpacity style={[w.actionBtn, w.actionBtnBlue, updatingId === booking.id && s.btnDisabled]} onPress={() => markOnMyWay(booking.id)} disabled={updatingId === booking.id}>
                  <Ionicons name="car-outline" size={15} color="#fff" />
                  <Text style={w.actionBtnText}>{updatingId === booking.id ? t('common.notifying') : t('adminJobs.onMyWay')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[w.actionBtn, w.actionBtnTeal, (!canMarkArrived || updatingId === booking.id) && s.btnDisabled]} onPress={() => markArrived(booking.id)} disabled={updatingId === booking.id || !canMarkArrived}>
                <Ionicons name="location-outline" size={15} color="#fff" />
                <Text style={w.actionBtnText}>{updatingId === booking.id ? t('common.notifying') : t('adminJobs.iAmHere')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[w.actionBtn, w.actionBtnAmber, (!canMarkRunningLate || updatingId === booking.id) && s.btnDisabled]} onPress={() => openRunningLateModal(booking.id)} disabled={updatingId === booking.id || !canMarkRunningLate}>
                <Ionicons name="time-outline" size={15} color="#fff" />
                <Text style={w.actionBtnText}>{updatingId === booking.id ? t('common.notifying') : t('adminJobs.runningLate')}</Text>
              </TouchableOpacity>
            </>
          )}
          {hasOnMyWay && (
            <View style={[w.noticeCard, { borderColor: '#3B82F6' }]}>
              <Text style={w.noticeTitle}>{t('adminJobs.onMyWay')}</Text>
              <Text style={w.noticeText}>{t('adminJobs.notifiedAt', { time: new Date(booking.workerOnMyWayAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</Text>
            </View>
          )}
          {hasArrived && (
            <View style={w.noticeCard}>
              <Text style={w.noticeTitle}>Arrival alert sent</Text>
              <Text style={w.noticeText}>Last sent at {new Date(booking.workerArrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={w.noticeMeta}>{arrivalCooldown > 0 ? `Cooldown: ${formatCountdown(arrivalCooldown)} remaining` : 'Cooldown finished — can notify again.'}</Text>
            </View>
          )}
          {hasMarkedLate && (
            <View style={[w.noticeCard, w.noticeCardAmber]}>
              <Text style={w.noticeTitle}>Delay notice sent</Text>
              <Text style={w.noticeText}>Sent at {new Date(booking.workerRunningLateAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
          {isMyJob && canStartJob && (
            <>
              {!hasArrived && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4, paddingHorizontal: 2 }}>
                  <Ionicons name="information-circle-outline" size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, color: '#64748B' }}>{t('adminJobs.pressIAmHereToUnlock')}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[w.actionBtn, w.actionBtnGreen, (!hasArrived || updatingId === booking.id) && s.btnDisabled]}
                onPress={() => startJob(booking.id)}
                disabled={!hasArrived || updatingId === booking.id}
              >
                <Ionicons name="play-circle-outline" size={17} color="#fff" />
                <Text style={w.actionBtnText}>{updatingId === booking.id ? t('common.starting') : t('adminJobs.startJob')}</Text>
              </TouchableOpacity>
            </>
          )}
          {isMyJob && booking.status === 'InProgress' && (
            <View style={w.controlRow}>
              <TouchableOpacity style={[w.controlBtn, w.controlBtnFinish, updatingId === booking.id && s.btnDisabled]} onPress={() => finishJob(booking.id)} disabled={updatingId === booking.id}>
                <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                <Text style={w.controlBtnText}>{updatingId === booking.id ? t('common.finishing') : t('adminJobs.finish')}</Text>
              </TouchableOpacity>
              {pausedAtByBooking[booking.id] ? (
                <TouchableOpacity style={[w.controlBtn, w.controlBtnResume, updatingId === booking.id && s.btnDisabled]} onPress={() => resumeJob(booking.id)} disabled={updatingId === booking.id}>
                  <Ionicons name="play-outline" size={15} color="#fff" />
                  <Text style={w.controlBtnText}>{t('adminJobs.resume')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[w.controlBtn, w.controlBtnPause, updatingId === booking.id && s.btnDisabled]} onPress={() => pauseJob(booking.id)} disabled={updatingId === booking.id}>
                  <Ionicons name="pause-outline" size={15} color="#fff" />
                  <Text style={w.controlBtnText}>{t('adminJobs.pause')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <SectionLabel icon="location-outline">Location</SectionLabel>
          <View style={w.locationCard}>
            <Text style={w.locationText}>{booking.customerAddress ? `${booking.addressType || t('adminJobs.service')}: ${booking.customerAddress}` : t('adminJobs.noAddressSaved')}</Text>
            <TouchableOpacity style={w.mapsBtn} onPress={() => openInGoogleMaps(booking.customerAddress)}>
              <Ionicons name="map-outline" size={13} color={theme.colors.primary} />
              <Text style={w.mapsBtnText}>{t('adminJobs.openInMaps')}</Text>
            </TouchableOpacity>
          </View>
          <View style={w.checklistCard}>
            <View style={w.checklistHeader}>
              <View>
                <Text style={w.checklistTitle}>{t('adminJobs.workSteps')}</Text>
                <Text style={w.checklistSubtitle}>{t('adminJobs.completeEachTaskInOrder')}</Text>
              </View>
              <View style={w.progressBadge}>
                <Text style={w.progressValue}>{completedCount}</Text>
                <Text style={w.progressTotal}>/ {checklistItems.length}</Text>
              </View>
            </View>
            {!canToggleChecklist && (
              <View style={w.checklistHint}>
                <Ionicons name="time-outline" size={13} color="#BAE6FD" />
                <Text style={w.checklistHintText}>{t('adminJobs.startJobToEnableChecklist')}</Text>
              </View>
            )}
            {checklistItems.length > 0 ? checklistItems.map((item, idx) => {
              const isUpdating = updatingChecklistId === item.id;
              const startTime  = item.startTime ?? item.startedAt ?? null;
              const finishTime = item.finishTime ?? item.completedAt ?? null;
              const lastUncheckedAt = item.lastUncheckedAt ?? null;
              let duration = item.completedDuration ?? item.accumulatedDuration ?? 0;
              if (startTime && (!item.isCompleted || lastUncheckedAt)) {
                const now = Date.now();
                if (lastUncheckedAt) {
                  const uncheckedMs = typeof lastUncheckedAt === 'string' ? new Date(lastUncheckedAt).getTime() : lastUncheckedAt;
                  duration += Math.max(0, Math.floor((now - uncheckedMs) / 1000));
                } else {
                  const startMs = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
                  duration = Math.max(0, Math.floor((now - startMs) / 1000));
                }
              }
              const fmt = (t) => t ? new Date(typeof t === 'string' ? t : t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
              return (
                <TouchableOpacity key={item.id} style={[w.checkItem, item.isCompleted && w.checkItemDone]} onPress={() => updateChecklistItem(booking.id, item.id, !item.isCompleted)} disabled={isUpdating || !canToggleChecklist} activeOpacity={0.75}>
                  <View style={w.checkItemNum}><Text style={w.checkItemNumText}>{idx + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[w.checkItemLabel, item.isCompleted && w.checkItemLabelDone]}>{item.label}</Text>
                    <View style={w.checkTimings}>
                      {[
                        { label: t('adminJobs.time'), value: `${Math.floor(duration / 60)}m ${duration % 60}s` },
                        { label: t('adminJobs.started'), value: fmt(startTime) },
                        { label: t('adminJobs.finished'), value: fmt(finishTime) },
                      ].map(({ label, value }) => (
                        <View key={label} style={w.checkTiming}>
                          <Text style={w.checkTimingLabel}>{label}</Text>
                          <Text style={w.checkTimingValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={w.checkboxWrap}>
                    {isUpdating ? <ActivityIndicator size="small" color={theme.colors.primary} /> : (
                      <View style={[w.checkbox, item.isCompleted && w.checkboxDone]}>
                        {item.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={w.checklistEmpty}>
                <Ionicons name="list-outline" size={28} color={theme.colors.textMuted} />
                <Text style={w.checklistEmptyText}>{t('adminJobs.noChecklistItems')}</Text>
              </View>
            )}
          </View>
          {!isMyJob && booking.assignedWorkerId && (
            <Text style={w.assignedHint}>{t('adminJobs.assignedToAnotherWorker')}</Text>
          )}
        </View>
      );
    };

    return (
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {PhotoCaptureModal}{CompletionModal}{LateModal}{FinishModal}{PauseModal}{SalesKitModal}
        {showReminder && (
          <Modal transparent animationType="fade" visible onRequestClose={() => setReminderDismissed((p) => ({ ...p, [nextUpcomingJob.id]: true }))}>
            <View style={m.backdrop}>
              <View style={m.card}>
                <View style={m.successRing}>
                  <Ionicons name="alarm-outline" size={28} color="#0E165F" />
                </View>
                <Text style={m.eyebrow}>{t('adminJobs.timeToLeave')}</Text>
                <Text style={m.title}>{t('adminJobs.leaveInMinutes', { count: minutesUntilNextJob })}</Text>
                <Text style={m.body}>
                  {nextUpcomingJob.customerName} · {nextUpcomingJob.vehicleMake} {nextUpcomingJob.vehicleModel}{'\n'}
                  {nextUpcomingJob.customerAddress || nextUpcomingJob.addressType}
                </Text>
                <View style={m.statsRow}>
                  <View style={m.statCard}>
                    <Text style={m.statLabel}>{t('adminJobs.jobAt')}</Text>
                    <Text style={m.statValue}>{String(nextUpcomingJob.timeSlot || '').split('-')[0].trim()}</Text>
                  </View>
                  <View style={m.statCard}>
                    <Text style={m.statLabel}>{t('adminJobs.travel')}</Text>
                    <Text style={m.statValue}>{t('adminJobs.minutesShort', { count: settings?.workerTravelBufferMinutes || 30 })}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[m.primaryBtn, { backgroundColor: '#15803d' }]} onPress={() => {
                  setReminderDismissed((p) => ({ ...p, [nextUpcomingJob.id]: true }));
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextUpcomingJob.customerAddress || nextUpcomingJob.addressType || '')}`);
                }}>
                  <Ionicons name="navigate-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={m.primaryBtnText}>{t('adminJobs.openInMaps')}</Text>
                </TouchableOpacity>
                <View style={m.btnRow}>
                  <TouchableOpacity style={m.cancelBtn} onPress={() => setReminderDismissed((p) => ({ ...p, [nextUpcomingJob.id]: true }))}>
                    <Text style={m.cancelBtnText}>{t('adminJobs.dismiss')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[m.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: '#0ea5e9' }]} onPress={() => {
                    setReminderDismissed((p) => ({ ...p, [nextUpcomingJob.id]: true }));
                    setSelectedWorkerBookingId(nextUpcomingJob.id);
                  }}>
                    <Text style={m.primaryBtnText}>{t('adminJobs.viewJob')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
        <View style={w.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>{selectedWorkerBooking ? t('worker.header.titleDetail') : t('worker.header.titleQueue')}</Text>
            <Text style={s.sub}>{selectedWorkerBooking ? t('worker.header.subtitleDetail') : t('worker.header.subtitleQueue')}</Text>
            {!selectedWorkerBooking && (
              <View style={w.profileCard}>
                <Image source={{ uri: resolveProfileImageUrl(user?.profileImageUrl) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }} style={w.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={w.profileName}>{`${user?.firstName || 'Worker'} ${user?.lastName || ''}`.trim()}</Text>
                  <Text style={w.profileRole}>{t('worker.header.role')}</Text>
                </View>
                <TouchableOpacity style={w.profileBtn} onPress={() => navigation.navigate('Worker Profile')}>
                  <Text style={w.profileBtnText}>{t('worker.header.profileBtn')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={w.headerActions}>
            <TouchableOpacity style={w.refreshBtn} onPress={onRefresh} disabled={refreshing}>
              <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={w.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={16} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        </View>
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        {selectedWorkerBooking ? <DetailView /> : <ListView />}
      </ScrollView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN DETAIL MODAL
  // ══════════════════════════════════════════════════════════════════════════

  const db = detailBooking;
  const dbBreakdown = db ? buildBookingBreakdown(db) : null;

  const AdminDetailModal = db ? (
    <Modal visible transparent animationType="slide" onRequestClose={() => setDetailBooking(null)}>
      <View style={ad.backdrop}>
        <View style={ad.sheet}>
          <View style={ad.sheetHandle} />
          <View style={ad.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={ad.sheetBkNum}>{db.bookingNumber}</Text>
              <Text style={ad.sheetCustomer}>{db.customerName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <StatusBadge status={db.status} />
              <TouchableOpacity style={ad.closeBtn} onPress={() => setDetailBooking(null)}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={ad.sheetBody} showsVerticalScrollIndicator={false}>
            {[
              { icon: 'calendar-outline', text: `${new Date(db.scheduledDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTimeAMPM(db.timeSlot)}` },
              { icon: 'car-outline',      text: `${[db.vehicleYear, db.vehicleMake, db.vehicleModel].filter(Boolean).join(' ')} · ${db.vehicleType}` },
              { icon: 'call-outline',     text: db.customerPhone },
              ...(db.customerAddress ? [{ icon: 'location-outline', text: db.customerAddress }] : []),
            ].map(({ icon, text }, i) => (
              <View key={i} style={ad.infoRow}>
                <Ionicons name={icon} size={13} color={theme.colors.textMuted} />
                <Text style={ad.infoText} numberOfLines={2}>{text}</Text>
              </View>
            ))}
            <View style={ad.statsRow}>
              {[
                { label: 'Total',    value: formatQAR(db.totalAmount || 0),            color: theme.colors.primary },
                { label: 'Est. Time',value: `${db.estimatedDurationMinutes || 0}m`,   color: theme.colors.text },
                { label: 'Payment',  value: db.paymentStatus || 'Unpaid',              color: db.paymentStatus === 'Paid' ? '#84CC16' : '#FBBF24' },
              ].map(({ label, value, color }) => (
                <View key={label} style={ad.statBox}>
                  <Text style={[ad.statVal, { color }]}>{value}</Text>
                  <Text style={ad.statLbl}>{label}</Text>
                </View>
              ))}
            </View>
            {(db.cancellationRequested || db.rescheduleRequested) && (
              <View style={ad.requestBox}>
                {db.cancellationRequested && (
                  <View>
                    <View style={ad.requestRow}>
                      <Ionicons name="close-circle-outline" size={16} color="#FB923C" />
                      <View style={{ flex: 1 }}>
                        <Text style={ad.requestTitle}>Cancellation Request</Text>
                        <Text style={ad.requestBody}>{db.cancellationRequestReason || 'No reason given'}</Text>
                      </View>
                    </View>
                    <View style={ad.requestActions}>
                      <TouchableOpacity
                        style={[ad.requestBtn, ad.requestBtnApprove]}
                        onPress={() => handleApproveCancellation(db)}
                        disabled={!!requestActionLoading}
                      >
                        {requestActionLoading === 'approve-cancel'
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={ad.requestBtnText}>Approve & Cancel</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ad.requestBtn, ad.requestBtnReject]}
                        onPress={() => handleRejectCancellation(db.id)}
                        disabled={!!requestActionLoading}
                      >
                        {requestActionLoading === 'reject-cancel'
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={ad.requestBtnText}>Reject</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {db.rescheduleRequested && (
                  <View>
                    <View style={ad.requestRow}>
                      <Ionicons name="calendar-outline" size={16} color="#FB923C" />
                      <View style={{ flex: 1 }}>
                        <Text style={ad.requestTitle}>Reschedule Request</Text>
                        <Text style={ad.requestBody}>{db.rescheduleRequestNote || 'No note'}{db.reschedulePreferredDate ? ` · Prefers: ${new Date(db.reschedulePreferredDate).toLocaleDateString()}` : ''}</Text>
                      </View>
                    </View>
                    <View style={ad.requestActions}>
                      <TouchableOpacity
                        style={[ad.requestBtn, ad.requestBtnApprove]}
                        onPress={() => handleApproveReschedule(db)}
                        disabled={!!requestActionLoading}
                      >
                        {requestActionLoading === 'approve-reschedule'
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={ad.requestBtnText}>Approve</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ad.requestBtn, ad.requestBtnReject]}
                        onPress={() => handleRejectReschedule(db.id)}
                        disabled={!!requestActionLoading}
                      >
                        {requestActionLoading === 'reject-reschedule'
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={ad.requestBtnText}>Reject</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            <Text style={ad.sectionLabel}>Packages</Text>
            {(dbBreakdown?.baseItems || []).map((item, i) => (
              <Text key={i} style={ad.pkgRow}>· {item.packageName} ×{item.quantity || 1} — {formatQAR(item.subtotal || 0)}</Text>
            ))}
            {(dbBreakdown?.addonItems || []).map((item, i) => (
              <Text key={i} style={[ad.pkgRow, { color: '#C084FC' }]}>+ {item.packageName} ×{item.quantity || 1} — {formatQAR(item.subtotal || 0)}</Text>
            ))}
            <View style={ad.totalRow}>
              <Text style={ad.totalLabel}>Total</Text>
              <Text style={ad.totalValue}>{formatQAR(db.totalAmount || 0)}</Text>
            </View>
            <Text style={ad.sectionLabel}>Change Status</Text>
            <View style={ad.statusGrid}>
              {statusOptions.filter((st) => st !== db.status).map((st) => (
                <TouchableOpacity key={st} style={[ad.statusChip, { borderColor: statusColors[st] || '#475569' }]} onPress={async () => { await updateStatus(db.id, st); setDetailBooking((p) => p ? { ...p, status: st } : null); }} disabled={updatingId === db.id}>
                  <Text style={[ad.statusChipText, { color: statusColors[st] || '#CBD5E1' }]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={ad.actionBtns}>
              <TouchableOpacity style={ad.callBtn} onPress={() => callCustomer(db.customerPhone)}>
                <Ionicons name="call-outline" size={15} color="#0F172A" />
                <Text style={ad.callBtnText}>Call Customer</Text>
              </TouchableOpacity>
              {db.customerAddress && (
                <TouchableOpacity style={ad.mapsBtn} onPress={() => openInGoogleMaps(db.customerAddress)}>
                  <Ionicons name="map-outline" size={15} color="#60A5FA" />
                  <Text style={ad.mapsBtnText}>Maps</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  ) : null;

  // ── Compact job row ────────────────────────────────────────────────────────
  const renderJobRow = (booking) => {
    const sc     = statusColors[booking.status] || '#6B7280';
    const hasReq = booking.cancellationRequested || booking.rescheduleRequested;
    const timeStr = String(booking.timeSlot || '').split('-')[0].trim();
    return (
      <TouchableOpacity key={booking.id} style={[ad.row, { borderLeftColor: sc }]} onPress={() => setDetailBooking(booking)} activeOpacity={0.75}>
        <View style={ad.rowLeft}>
          <Text style={ad.rowTime}>{timeStr}</Text>
          {hasReq && <View style={ad.rowReqDot} />}
        </View>
        <View style={ad.rowMid}>
          <Text style={ad.rowCustomer} numberOfLines={1}>{booking.customerName}</Text>
          <Text style={ad.rowMeta} numberOfLines={1}>{[booking.vehicleYear, booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ') || booking.vehicleType}</Text>
        </View>
        <View style={ad.rowRight}>
          <View style={[ad.rowDot, { backgroundColor: sc }]} />
          <Text style={[ad.rowStatus, { color: sc }]}>{booking.status}</Text>
          <Text style={ad.rowAmount}>{formatQAR(booking.totalAmount || 0)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Assign Worker Modal ────────────────────────────────────────────────────
  const AssignWorkerModal = assignModalBooking ? (
    <Modal visible transparent animationType="slide" onRequestClose={() => setAssignModalBooking(null)}>
      <View style={asgn.backdrop}>
        <View style={asgn.sheet}>
          <View style={asgn.handle} />
          {/* Header */}
          <View style={asgn.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={asgn.eyebrow}>Assign Detailer</Text>
              <Text style={asgn.bookingNum}>{assignModalBooking.bookingNumber}</Text>
              <Text style={asgn.bookingMeta}>
                {assignModalBooking.customerName} · {String(assignModalBooking.timeSlot || '').split('-')[0].trim()}
              </Text>
            </View>
            <TouchableOpacity style={asgn.closeBtn} onPress={() => setAssignModalBooking(null)}>
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={asgn.infoRow}>
            <Ionicons name="car-outline" size={13} color={theme.colors.textMuted} />
            <Text style={asgn.infoText}>
              {[assignModalBooking.vehicleYear, assignModalBooking.vehicleMake, assignModalBooking.vehicleModel].filter(Boolean).join(' ') || assignModalBooking.vehicleType}
              {' · '}{formatQAR(assignModalBooking.totalAmount || 0)}
              {' · ~'}{assignModalBooking.estimatedDurationMinutes || 60}min
            </Text>
          </View>

          <Text style={asgn.sectionLabel}>Select Detailer</Text>

          {loadingWorkers ? (
            <View style={asgn.loaderRow}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={asgn.loaderText}>Loading workers…</Text>
            </View>
          ) : assignWorkersList.length === 0 ? (
            <View style={asgn.emptyWrap}>
              <Ionicons name="people-outline" size={28} color={theme.colors.textMuted} />
              <Text style={asgn.emptyText}>No active workers available</Text>
            </View>
          ) : (
            <ScrollView style={asgn.workerList} showsVerticalScrollIndicator={false}>
              {assignWorkersList.map((worker) => {
                const isAssigning = assigningWorkerId === worker.id;
                const isCurrentWorker = Number(assignModalBooking.assignedWorkerId) === Number(worker.id);
                return (
                  <TouchableOpacity
                    key={worker.id}
                    style={[asgn.workerRow, isCurrentWorker && asgn.workerRowActive]}
                    onPress={() => assignWorkerToBooking(worker.id)}
                    disabled={!!assigningWorkerId || isCurrentWorker}
                    activeOpacity={0.75}
                  >
                    <View style={[asgn.workerAvatar, { backgroundColor: isCurrentWorker ? theme.colors.primaryBg : 'rgba(14,165,160,0.1)' }]}>
                      <Text style={[asgn.workerInitial, { color: isCurrentWorker ? theme.colors.primary : theme.colors.secondary }]}>
                        {(worker.firstName || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={asgn.workerName}>{worker.firstName} {worker.lastName}</Text>
                      <Text style={asgn.workerSub}>{worker.email || 'Detailer'}</Text>
                    </View>
                    {isCurrentWorker ? (
                      <View style={asgn.assignedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                        <Text style={asgn.assignedBadgeText}>Assigned</Text>
                      </View>
                    ) : isAssigning ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <View style={asgn.assignBtn}>
                        <Text style={asgn.assignBtnText}>Assign</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={asgn.cancelBtn} onPress={() => setAssignModalBooking(null)}>
            <Text style={asgn.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;

  // ── Unassigned bookings section (admin only) ────────────────────────────────
  const UnassignedSection = (!isWorkerView && adminUnassigned.length > 0) ? (
    <View style={ua.section}>
      {/* Section header */}
      <TouchableOpacity
        style={ua.header}
        onPress={() => setUnassignedOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(251,191,36,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={ua.warningDot} />
        <View style={{ flex: 1 }}>
          <Text style={ua.headerTitle}>Needs Assignment</Text>
          <Text style={ua.headerSub}>
            {adminUnassigned.length} booking{adminUnassigned.length !== 1 ? 's' : ''} without a detailer
          </Text>
        </View>
        <View style={ua.countBadge}>
          <Text style={ua.countBadgeText}>{adminUnassigned.length}</Text>
        </View>
        <Ionicons
          name={unassignedOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#FBBF24"
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {unassignedOpen && (
        <View style={ua.cardList}>
          {adminUnassigned.map((b) => {
            const dateKey = extractDateKey(b.scheduledDate);
            const today   = toLocalDateKey(new Date());
            const isToday = dateKey === today;
            const dateLabel = isToday ? 'Today' : (dateKey ? new Date(dateKey + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');

            return (
              <View key={b.id} style={ua.card}>
                {/* Left accent */}
                <View style={ua.accent} />

                <View style={ua.cardBody}>
                  {/* Top row — time + date chip */}
                  <View style={ua.cardTopRow}>
                    <Text style={ua.timeText}>{formatTimeAMPM(b.timeSlot)}</Text>
                    <View style={[ua.datePill, isToday && ua.datePillToday]}>
                      <Text style={[ua.datePillText, isToday && ua.datePillTextToday]}>{dateLabel}</Text>
                    </View>
                  </View>

                  {/* Booking number + customer */}
                  <Text style={ua.bookingNum}>{b.bookingNumber}</Text>
                  <Text style={ua.customerName}>{b.customerName}</Text>

                  {/* Vehicle + amount row */}
                  <View style={ua.metaRow}>
                    <Ionicons name="car-outline" size={11} color={theme.colors.textMuted} />
                    <Text style={ua.metaText} numberOfLines={1}>
                      {[b.vehicleYear, b.vehicleMake, b.vehicleModel].filter(Boolean).join(' ') || b.vehicleType}
                    </Text>
                    <Text style={ua.metaDot}>·</Text>
                    <Text style={ua.metaAmount}>{formatQAR(b.totalAmount || 0)}</Text>
                    <Text style={ua.metaDot}>·</Text>
                    <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                    <Text style={ua.metaText}>~{b.estimatedDurationMinutes || 60}min</Text>
                  </View>

                  {/* Action buttons row */}
                  <View style={ua.cardActions}>
                    <TouchableOpacity
                      style={ua.assignBtn}
                      onPress={() => openAssignModal(b)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="person-add-outline" size={13} color="#0F172A" />
                      <Text style={ua.assignBtnText}>Assign Detailer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={ua.viewBtn}
                      onPress={() => setDetailBooking(b)}
                      activeOpacity={0.8}
                    >
                      <Text style={ua.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  ) : null;

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN DISPATCH BOARD (mode='today')
  // ══════════════════════════════════════════════════════════════════════════

  if (mode === 'today') {
    const total    = adminFilteredBookings.length;
    const active   = adminFilteredBookings.filter((b) => b.status === 'InProgress').length;
    const confirmed = adminFilteredBookings.filter((b) => b.status === 'Confirmed').length;
    const done     = adminFilteredBookings.filter((b) => b.status === 'Completed').length;
    const revenue  = adminFilteredBookings.filter((b) => b.status === 'Completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
      <View style={s.screen}>
        {AdminDetailModal}
        {AssignWorkerModal}

        {/* ── Fixed header — paddingTop accounts for the transparent nav ── */}
        <View style={[ad.fixedHeader, { paddingTop: headerHeight + 14 }]}>
          <View style={{ flex: 1 }}>
            <Text style={ad.pageTitle}>Dispatch Board</Text>
            <Text style={ad.pageSubtitle}>{todayLabel}</Text>
          </View>
          <TouchableOpacity style={ad.refreshChip} onPress={onRefresh} disabled={refreshing}>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={ad.statsStrip}>
          {[
            { label: 'Jobs',     value: total,              color: '#60A5FA' },
            { label: 'Live',     value: active,             color: '#C084FC' },
            { label: 'Upcoming', value: confirmed,          color: '#60A5FA' },
            { label: 'Done',     value: done,               color: '#84CC16' },
            { label: 'Earned',   value: formatQAR(revenue), color: '#84CC16' },
          ].map(({ label, value, color }, i, arr) => (
            <React.Fragment key={label}>
              <View style={ad.stripStat}>
                <Text style={[ad.stripVal, { color }]}>{value}</Text>
                <Text style={ad.stripLbl}>{label}</Text>
              </View>
              {i < arr.length - 1 && <View style={ad.stripDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Status distribution bar */}
        {total > 0 && (
          <View style={ad.distBar}>
            {[
              { count: adminFilteredBookings.filter((b) => b.status === 'Pending').length,    color: '#FBBF24' },
              { count: confirmed,                                                              color: '#60A5FA' },
              { count: active,                                                                 color: '#C084FC' },
              { count: done,                                                                   color: '#84CC16' },
              { count: adminFilteredBookings.filter((b) => b.status === 'Cancelled').length,  color: '#F87171' },
            ].filter((d) => d.count > 0).map((d, i) => (
              <View key={i} style={[ad.distBarSlice, { flex: d.count, backgroundColor: d.color + 'CC' }]} />
            ))}
          </View>
        )}

        {!!error && <View style={s.errorBanner}><Ionicons name="alert-circle" size={14} color="#FCA5A5" /><Text style={s.errorText}>{error}</Text></View>}

        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {UnassignedSection}
          {adminFilteredBookings.length === 0 ? (
            <View style={s.emptyCard}><Ionicons name="calendar-outline" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} /><Text style={s.emptyText}>No jobs today.</Text></View>
          ) : (
            <View style={ad.listCard}>{adminFilteredBookings.map(renderJobRow)}</View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN PIPELINE (mode='all')
  // ══════════════════════════════════════════════════════════════════════════

  const PERIOD_OPTS = [
    { key: 'today',    label: 'Today'    },
    { key: 'week',     label: '7 Days'   },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'all',      label: 'All'      },
  ];

  return (
    <View style={s.screen}>
      {AdminDetailModal}
      {AssignWorkerModal}

      {/* ── Fixed header — paddingTop accounts for the transparent nav ── */}
      <View style={[ad.fixedHeader, { paddingTop: headerHeight + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={ad.pageTitle}>All Jobs</Text>
          <Text style={ad.pageSubtitle}>
            {adminFilteredBookings.length} booking{adminFilteredBookings.length !== 1 ? 's' : ''}
            {periodFilter !== 'all' ? ` · ${PERIOD_OPTS.find(o => o.key === periodFilter)?.label}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={ad.refreshChip} onPress={onRefresh} disabled={refreshing}>
          <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Filters — single bar combining period + status ── */}
      <View style={ad.filterSection}>
        {/* Period row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={ad.filterScroll}
          contentContainerStyle={ad.filterScrollContent}
        >
          {PERIOD_OPTS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[ad.filterChip, periodFilter === opt.key && ad.filterChipActive]}
              onPress={() => setPeriodFilter(opt.key)}
              activeOpacity={0.75}
            >
              <Text style={[ad.filterChipText, periodFilter === opt.key && ad.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={ad.filterDivider} />

        {/* Status row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={ad.filterScroll}
          contentContainerStyle={ad.filterScrollContent}
        >
          {['All', ...statusOptions].map((st) => {
            const sc = statusColors[st] || theme.colors.primary;
            const isActive = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                style={[ad.filterChip, isActive && { borderColor: sc, backgroundColor: sc + '22' }]}
                onPress={() => setStatusFilter(st)}
                activeOpacity={0.75}
              >
                {isActive && st !== 'All' && <View style={[ad.filterChipDot, { backgroundColor: sc }]} />}
                <Text style={[ad.filterChipText, isActive && { color: isActive && st !== 'All' ? sc : theme.colors.primary }]}>{st}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!!error && <View style={s.errorBanner}><Ionicons name="alert-circle" size={14} color="#FCA5A5" /><Text style={s.errorText}>{error}</Text></View>}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {UnassignedSection}
        {adminGroupedByDate.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="search-outline" size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={s.emptyText}>No jobs match this filter.</Text>
          </View>
        ) : (
          adminGroupedByDate.map(([dateKey, dayBookings]) => {
            const d        = new Date(dateKey + 'T12:00:00');
            const todayKey = toLocalDateKey(new Date());
            const label    = dateKey === todayKey ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <View key={dateKey}>
                <View style={ad.dateHeader}>
                  <Text style={ad.dateHeaderText}>{label}</Text>
                  <Text style={ad.dateHeaderCount}>{dayBookings.length} job{dayBookings.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={ad.listCard}>{dayBookings.map(renderJobRow)}</View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Shared utility styles ────────────────────────────────────────────────────
const u = StyleSheet.create({
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, marginBottom: 10 },
  sectionLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '800', flex: 1 },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText:    { fontSize: 11, fontWeight: '800' },
});

// ─── Screen-level shared styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  heading: { color: theme.colors.text, fontSize: 24, fontWeight: '900', marginBottom: 3 },
  sub:     { color: theme.colors.textMuted, fontSize: 13, marginBottom: 14 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#1C0A0A', borderWidth: 1, borderColor: '#7F1D1D',
    borderRadius: 10, padding: 10,
  },
  errorText:   { color: '#FCA5A5', flex: 1, fontSize: 12 },
  emptyCard: {
    margin: 20, borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 32, alignItems: 'center',
  },
  emptyText:   { color: theme.colors.textMuted, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});

// ─── Worker view styles ───────────────────────────────────────────────────────
const w = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 },
  headerActions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  refreshBtn:    { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)', backgroundColor: 'rgba(200,169,107,0.08)', alignItems: 'center', justifyContent: 'center' },
  logoutBtn:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(252,165,165,0.2)', backgroundColor: 'rgba(31,10,10,0.4)', alignItems: 'center', justifyContent: 'center' },
  profileCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: 'rgba(19,27,37,0.8)', padding: 10, marginBottom: 4 },
  avatar:        { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.primary },
  profileName:   { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  profileRole:   { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },
  profileBtn:    { borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(200,169,107,0.08)' },
  profileBtnText:{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  statsStrip:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)', paddingVertical: 12, paddingHorizontal: 18, marginBottom: 18 },
  statItem:      { flex: 1, alignItems: 'center' },
  statValue:     { color: theme.colors.primary, fontSize: 20, fontWeight: '900' },
  statLabel:     { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  statDivider:   { width: 1, height: 26, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  groupHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  groupDot:      { width: 8, height: 8, borderRadius: 4 },
  groupTitle:    { fontSize: 13, fontWeight: '800', flex: 1 },
  groupCount:    { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  jobCard:       { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)', marginBottom: 10, overflow: 'hidden' },
  claimCard:     { borderColor: 'rgba(52,211,153,0.3)' },
  jobAccent:     { width: 4 },
  jobBody:       { flex: 1, padding: 12 },
  jobTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobTime:       { color: '#FBBF24', fontSize: 13, fontWeight: '800' },
  jobNumber:     { color: theme.colors.primary, fontWeight: '700', fontSize: 12, marginBottom: 2 },
  jobCustomer:   { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  jobMeta:       { color: theme.colors.textMuted, fontSize: 12 },
  availableBadge:{ backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' },
  availableBadgeText: { color: '#34D399', fontWeight: '700', fontSize: 11 },
  estimatedDuration: { color: '#FBBF24', fontSize: 11, fontWeight: '600', marginTop: 4 },
  claimBtn:      { marginTop: 10, backgroundColor: '#34D399', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  claimBtnText:  { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  completedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(132,204,22,0.2)', borderRadius: 12, backgroundColor: 'rgba(13,45,31,0.6)', padding: 10, marginBottom: 8 },
  completedLeft: {},
  completedRight:{ alignItems: 'flex-end' },
  completedNumber:  { color: '#84CC16', fontWeight: '800', fontSize: 12 },
  completedCustomer:{ color: '#BBF7D0', fontWeight: '600', fontSize: 13, marginTop: 2 },
  completedTime:    { color: '#84CC16', fontWeight: '700', fontSize: 12 },
  completedDuration:{ color: '#86EFAC', fontSize: 11, marginTop: 2 },
  detailCard:    { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(200,169,107,0.06)' },
  backBtnText:   { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  detailHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  detailNumber:  { color: theme.colors.primary, fontWeight: '800', fontSize: 13, marginBottom: 2 },
  detailCustomer:{ color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  infoStrip:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  infoItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText:      { color: theme.colors.textMuted, fontSize: 12 },
  vehicleText:   { color: theme.colors.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  durationHint:  { color: '#FBBF24', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  pkgBox:        { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 4 },
  pkgItem:       { color: theme.colors.text, fontSize: 13, marginBottom: 3 },
  salesKitBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, marginBottom: 10, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 11 },
  salesKitBtnText:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  timerCard:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#0F172A', padding: 14, marginBottom: 10, gap: 12 },
  timerLabel:    { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  timerValue:    { fontSize: 30, fontWeight: '900', color: '#38BDF8', letterSpacing: 1 },
  timerIdle:     { fontSize: 16, fontWeight: '800', color: theme.colors.textMuted },
  timerDot:      { width: 10, height: 10, borderRadius: 5 },
  quickRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11 },
  quickBtnGreen: { backgroundColor: '#065F46' },
  quickBtnPurple:{ backgroundColor: '#4C1D95' },
  quickBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 11, marginBottom: 6 },
  actionBtnBlue: { backgroundColor: '#1D4ED8' },
  actionBtnTeal: { backgroundColor: '#0E7490' },
  actionBtnAmber:{ backgroundColor: '#B45309' },
  actionBtnGreen:{ backgroundColor: '#059669' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  noticeCard:    { marginBottom: 8, borderWidth: 1, borderColor: '#1D4ED8', borderRadius: 12, backgroundColor: '#0B1E3B', padding: 12 },
  noticeCardAmber:{ borderColor: '#B45309', backgroundColor: '#1C1202' },
  noticeTitle:   { color: '#BFDBFE', fontWeight: '800', marginBottom: 2 },
  noticeText:    { color: '#DBEAFE', fontSize: 12 },
  noticeMeta:    { color: '#93C5FD', fontSize: 11, marginTop: 4 },
  controlRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  controlBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11 },
  controlBtnFinish:{ backgroundColor: '#D97706' },
  controlBtnPause: { backgroundColor: '#3B82F6' },
  controlBtnResume:{ backgroundColor: '#059669' },
  controlBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  locationCard:  { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, marginBottom: 4 },
  locationText:  { color: theme.colors.text, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  mapsBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(200,169,107,0.06)' },
  mapsBtnText:   { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  checklistCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: '#0A1021', padding: 14, marginBottom: 4 },
  checklistHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  checklistTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  checklistSubtitle:{ color: theme.colors.textMuted, fontSize: 11 },
  progressBadge: { alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 56 },
  progressValue: { fontSize: 18, fontWeight: '900', color: '#38BDF8' },
  progressTotal: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  checklistHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0C2438', borderRadius: 10, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#0E7490' },
  checklistHintText:{ color: '#BAE6FD', fontSize: 12, fontWeight: '600' },
  checkItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, backgroundColor: '#141B2D', padding: 10, marginBottom: 8 },
  checkItemDone: { backgroundColor: '#0B1D14', borderColor: '#14532D' },
  checkItemNum:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkItemNumText:{ fontSize: 11, fontWeight: '900', color: '#94A3B8' },
  checkItemLabel:{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  checkItemLabelDone:{ color: '#86EFAC', textDecorationLine: 'line-through' },
  checkTimings:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  checkTiming:   { backgroundColor: '#0F172A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  checkTimingLabel:{ fontSize: 9, color: '#475569', fontWeight: '600', marginBottom: 1 },
  checkTimingValue:{ fontSize: 11, color: '#38BDF8', fontWeight: '700' },
  checkboxWrap:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkbox:      { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  checkboxDone:  { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  checklistEmpty:{ alignItems: 'center', paddingVertical: 20 },
  checklistEmptyText:{ color: theme.colors.textMuted, fontSize: 13, marginTop: 6 },
  assignedHint:  { color: '#FBBF24', fontWeight: '700', marginTop: 10, textAlign: 'center', fontSize: 13 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(2,6,23,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card:       { width: '100%', maxWidth: 420, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 22, backgroundColor: 'rgba(19,27,37,0.97)', padding: 22, alignItems: 'center' },
  successRing:{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 3, borderColor: '#22C55E' },
  eyebrow:    { color: theme.colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title:      { color: theme.colors.text, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  body:       { color: theme.colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: 'center' },
  statsRow:   { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  statCard:   { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10 },
  statLabel:  { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  statValue:  { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  fieldWrap:  { width: '100%', marginTop: 12 },
  fieldLabel: { color: theme.colors.mist, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, color: theme.colors.text, paddingHorizontal: 12, paddingVertical: 10, width: '100%' },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  primaryBtn: { marginTop: 16, width: '100%', backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  cancelBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
});

// ─── Sales kit modal styles ───────────────────────────────────────────────────
const sk = StyleSheet.create({
  card:        { width: '94%', maxWidth: 460, maxHeight: '86%', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 22, backgroundColor: 'rgba(13,17,23,0.98)', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  eyebrow:     { color: theme.colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  title:       { color: theme.colors.text, fontSize: 22, fontWeight: '900', marginTop: 3 },
  subtitle:    { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  metaCard:    { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, marginBottom: 10 },
  metaPrimary: { color: theme.colors.text, fontWeight: '900', fontSize: 15 },
  metaSecondary:{ color: theme.colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 8 },
  statsRow:    { flexDirection: 'row', gap: 8 },
  statChip:    { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)', paddingVertical: 7, paddingHorizontal: 8 },
  statLabel:   { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statValue:   { color: theme.colors.text, fontWeight: '800', fontSize: 13, marginTop: 3 },
  loaderWrap:  { paddingVertical: 40, alignItems: 'center' },
  list:        { maxHeight: 380 },
  emptyText:   { color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  svcCard:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, marginBottom: 8 },
  svcCardSelected: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.06)' },
  svcName:     { color: theme.colors.text, fontWeight: '800', fontSize: 14, marginBottom: 3 },
  svcDesc:     { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  svcMeta:     { color: theme.colors.primary, fontSize: 11, fontWeight: '700', marginTop: 4 },
  selectBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  selectBadgeActive: {},
  confirmBtn:  { marginTop: 10, backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});

// ─── Admin view styles ────────────────────────────────────────────────────────
const ad = StyleSheet.create({
  // ── Fixed header — paddingTop is set INLINE using headerHeight ─────────────
  // Do NOT set paddingTop here; it's applied via style array in the JSX so it
  // can use the dynamic `headerHeight` value from `useHeaderHeight()`.
  fixedHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  pageTitle:    { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  pageSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 1 },
  refreshChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(200,169,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Stats strip ───────────────────────────────────────────────────────────
  statsStrip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.panel, paddingVertical: 10 },
  distBar:     { flexDirection: 'row', height: 5, backgroundColor: theme.colors.panel, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  distBarSlice:{ height: '100%' },
  stripStat:   { flex: 1, alignItems: 'center' },
  stripVal:    { fontSize: 17, fontWeight: '800' },
  stripLbl:    { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },
  stripDivider:{ width: 1, height: 26, backgroundColor: theme.colors.border },

  // ── Filter section (replaces separate filterBar rows) ─────────────────────
  // A single card that contains both period chips and status chips with a
  // thin separator between them. No maxHeight constraint → chips always visible.
  filterSection: {
    backgroundColor: theme.colors.panel,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    paddingVertical: 8,
  },
  filterScroll:        { flexGrow: 0 },                   // don't stretch vertically
  filterScrollContent: { paddingHorizontal: 12, gap: 7, flexDirection: 'row', paddingVertical: 4 },
  filterDivider:       { height: 1, backgroundColor: theme.colors.border, marginHorizontal: 12, marginVertical: 4 },

  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterChipActive:    { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.12)' },
  filterChipDot:       { width: 6, height: 6, borderRadius: 3 },
  filterChipText:      { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive:{ color: theme.colors.primary },

  // ── Date group header ──────────────────────────────────────────────────────
  dateHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  dateHeaderText:  { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  dateHeaderCount: { color: theme.colors.textMuted, fontSize: 11 },

  // ── Job list card ──────────────────────────────────────────────────────────
  listCard: { marginHorizontal: 12, marginBottom: 4, backgroundColor: theme.card.bg, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderLeftWidth: 3, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLeft:  { width: 50, alignItems: 'center', gap: 3 },
  rowTime:  { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  rowReqDot:{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F97316' },
  rowMid:   { flex: 1, marginHorizontal: 10 },
  rowCustomer:{ color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  rowMeta:  { color: theme.colors.textMuted, fontSize: 12, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowDot:   { width: 6, height: 6, borderRadius: 3 },
  rowStatus:{ fontSize: 11, fontWeight: '700' },
  rowAmount:{ color: theme.colors.textMuted, fontSize: 11 },

  // ── Unassigned strip ───────────────────────────────────────────────────────
  unassignedBox:    { marginHorizontal: 12, marginTop: 12, marginBottom: 4, backgroundColor: 'rgba(28,18,0,0.8)', borderWidth: 1, borderColor: '#78450A', borderRadius: 12, overflow: 'hidden' },
  unassignedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  unassignedTitle:  { color: '#FBBF24', fontSize: 13, fontWeight: '800', flex: 1 },
  unassignedRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(120,69,10,0.3)' },
  unassignedTime:   { color: '#FBBF24', fontSize: 12, fontWeight: '700', width: 46 },
  unassignedName:   { flex: 1, color: '#FDE68A', fontSize: 13 },
  unassignedDate:   { color: '#92600A', fontSize: 11 },

  // ── Detail modal bottom sheet ──────────────────────────────────────────────
  backdrop:      { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: theme.colors.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.border },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetBkNum:    { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  sheetCustomer: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  closeBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  sheetBody:     { padding: 16 },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  infoText:      { color: theme.colors.textMuted, fontSize: 13, flex: 1 },
  statsRow:      { flexDirection: 'row', gap: 8, marginVertical: 12 },
  statBox:       { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 10, alignItems: 'center' },
  statVal:       { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  statLbl:       { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  requestBox:    { backgroundColor: 'rgba(28,18,0,0.8)', borderWidth: 1, borderColor: '#92340A', borderRadius: 10, padding: 10, marginBottom: 12, gap: 10 },
  requestRow:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  requestTitle:  { color: '#FB923C', fontSize: 13, fontWeight: '700' },
  requestBody:   { color: '#FED7AA', fontSize: 12, marginTop: 2 },
  sectionLabel:  { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  pkgRow:        { color: theme.colors.text, fontSize: 13, marginBottom: 3 },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel:    { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  totalValue:    { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  statusGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  statusChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  statusChipText:{ fontSize: 13, fontWeight: '700' },
  actionBtns:    { flexDirection: 'row', gap: 10, marginBottom: 24 },
  callBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 11 },
  callBtnText:   { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  mapsBtn:       { paddingHorizontal: 14, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 5 },
  mapsBtnText:   { color: '#60A5FA', fontWeight: '700', fontSize: 13 },
  requestActions:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  requestBtn:        { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  requestBtnApprove: { backgroundColor: '#22C55E' },
  requestBtnReject:  { backgroundColor: '#EF4444' },
  requestBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ─── Unassigned bookings section styles ───────────────────────────────────────
const ua = StyleSheet.create({
  section:        { marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(28,18,0,0.85)',
    borderWidth: 1, borderColor: '#78450A',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    overflow: 'hidden',
  },
  warningDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FBBF24',
  },
  headerTitle:    { color: '#FBBF24', fontSize: 14, fontWeight: '900' },
  headerSub:      { color: '#92600A', fontSize: 11, marginTop: 1 },
  countBadge: {
    backgroundColor: '#78350F', borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: '#92600A',
  },
  countBadgeText: { color: '#FBBF24', fontSize: 12, fontWeight: '900' },

  cardList:       { borderWidth: 1, borderTopWidth: 0, borderColor: '#78450A', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: 'rgba(20,13,0,0.9)',
    borderTopWidth: 1, borderTopColor: 'rgba(120,69,10,0.35)',
  },
  accent:         { width: 3, backgroundColor: '#FBBF24' },
  cardBody:       { flex: 1, padding: 12 },
  cardTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  timeText:       { color: '#FBBF24', fontSize: 14, fontWeight: '900' },
  datePill: {
    backgroundColor: 'rgba(120,69,10,0.3)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(120,69,10,0.5)',
  },
  datePillToday:  { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
  datePillText:   { color: '#D97706', fontSize: 11, fontWeight: '700' },
  datePillTextToday: { color: '#F87171' },
  bookingNum:     { color: theme.colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  customerName:   { color: '#FDE68A', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 10 },
  metaText:       { color: theme.colors.textMuted, fontSize: 11 },
  metaDot:        { color: theme.colors.textMuted, fontSize: 11 },
  metaAmount:     { color: '#A3E635', fontSize: 11, fontWeight: '700' },
  cardActions:    { flexDirection: 'row', gap: 8 },
  assignBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: '#FBBF24', borderRadius: 10, paddingVertical: 9,
  },
  assignBtnText:  { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  viewBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)',
    backgroundColor: 'rgba(200,169,107,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewBtnText:    { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
});

// ─── Assign worker modal styles ───────────────────────────────────────────────
const asgn = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.panel,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.border,
    maxHeight: '82%',
    paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  eyebrow:     { color: '#FBBF24', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  bookingNum:  { color: theme.colors.primary, fontSize: 13, fontWeight: '800' },
  bookingMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoText:  { color: theme.colors.textMuted, fontSize: 12, flex: 1 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 18, marginTop: 14, marginBottom: 6 },
  loaderRow:    { alignItems: 'center', paddingVertical: 28, gap: 12 },
  loaderText:   { color: theme.colors.textMuted, fontSize: 13 },
  emptyWrap:    { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText:    { color: theme.colors.textMuted, fontSize: 13 },
  workerList:   { maxHeight: 300, paddingHorizontal: 12 },
  workerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 8,
  },
  workerRowActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.06)' },
  workerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  workerInitial: { fontSize: 16, fontWeight: '900' },
  workerName:   { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  workerSub:    { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  assignedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  assignedBadgeText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  assignBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  assignBtnText:{ color: '#0F172A', fontSize: 13, fontWeight: '800' },
  cancelBtn: {
    marginHorizontal: 18, marginTop: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  cancelBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
});