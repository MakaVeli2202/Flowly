// ─── WorkerManagementScreen.js ────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { bookingsAPI } from '../api/bookings';
import { authAPI } from '../api/auth';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { theme } from '../theme/theme';
import realtimeService from '../api/realtimeService';

const PADDING = 20;
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHIFTS = [
  { label: 'Early Morning', start: '06:00', end: '14:00' },
  { label: 'Morning',       start: '07:00', end: '15:00' },
  { label: 'Late Morning',  start: '08:00', end: '16:00' },
  { label: 'Afternoon',     start: '12:00', end: '20:00' },
  { label: 'Evening',       start: '14:00', end: '22:00' },
  { label: 'Late Evening',  start: '16:00', end: '00:00' },
  { label: 'Night',         start: '20:00', end: '06:00' },
];

/* ── Palette ──────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Prism plain styles ──────────────────────────────────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Visual primitives ──────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={prismStyles.topLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={prismStyles.leftBar}
    pointerEvents="none"
  />
);

/* ── Atoms ──────────────────────────────────────────────── */
/*
  SectionLabel upgraded: text + gradient line extending to the right,
  matching the same visual weight as ProfileScreen section headers.
*/
const SectionLabel = ({ children }) => (
  <View style={u.sectionLabelRow}>
    <Text style={u.sectionLabel}>{children}</Text>
    <LinearGradient
      colors={['transparent', G(0.55)]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={u.sectionDivider}
    />
  </View>
);

const FieldLabel = ({ children }) => (
  <Text style={u.fieldLabel}>{children}</Text>
);

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function WorkerManagementScreen() {
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();

  const [workers,          setWorkers]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [error,            setError]            = useState('');
  const [selectedWorker,   setSelectedWorker]   = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updatingWorkerId, setUpdatingWorkerId] = useState(null);
  const [editForm, setEditForm] = useState({ workingDays: '', shiftStart: '09:00', shiftEnd: '18:00' });

  const loadWorkers = useCallback(async () => {
    try {
      setError('');
      const allBookings = await bookingsAPI.getAll();
      const uniqueWorkers = {};
      const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      (allBookings || []).forEach((booking) => {
        if (booking.assignedWorkerId && booking.assignedWorkerName) {
          const wid = booking.assignedWorkerId;
          if (!uniqueWorkers[wid]) {
            uniqueWorkers[wid] = {
              id:           wid,
              name:         booking.assignedWorkerName,
              workingDays:  booking.workerWorkingDays || 'Monday,Tuesday,Wednesday,Thursday,Friday',
              shiftStart:   booking.workerShiftStart  || '09:00',
              shiftEnd:     booking.workerShiftEnd    || '18:00',
              totalJobs:    0,
              completedJobs: 0,
              activeJobs:   0,
              todayJobs:    0,
            };
          }
          const w = uniqueWorkers[wid];
          w.totalJobs += 1;
          if (booking.status === 'Completed')  w.completedJobs += 1;
          if (booking.status === 'InProgress') w.activeJobs    += 1;
          const dateStr = booking.scheduledDate ? booking.scheduledDate.substring(0, 10) : '';
          if (dateStr === todayKey) w.todayJobs += 1;
        }
      });
      setWorkers(Object.values(uniqueWorkers).sort((a, b) => a.name.localeCompare(b.name)));
    } catch { setError('Failed to load workers.'); }
  }, []);

  useEffect(() => {
    const run = async () => { setLoading(true); await loadWorkers(); setLoading(false); };
    run();
  }, [loadWorkers]);

  const onRefresh = async () => { setRefreshing(true); await loadWorkers(); setRefreshing(false); };

  const openEditModal = (worker) => {
    setSelectedWorker(worker);
    setEditForm({
      workingDays: worker.workingDays || 'Monday,Tuesday,Wednesday,Thursday,Friday',
      shiftStart:  worker.shiftStart  || '09:00',
      shiftEnd:    worker.shiftEnd    || '18:00',
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setSelectedWorker(null);
    setEditForm({ workingDays: '', shiftStart: '09:00', shiftEnd: '18:00' });
  };

  const toggleWorkingDay = (day) => {
    const days = editForm.workingDays.split(',').map((d) => d.trim()).filter(Boolean);
    const idx  = days.indexOf(day);
    if (idx !== -1) days.splice(idx, 1);
    else days.push(day);
    setEditForm((p) => ({ ...p, workingDays: days.join(',') }));
  };

  const applyShiftTemplate = (shift) => {
    setEditForm((p) => ({ ...p, shiftStart: shift.start, shiftEnd: shift.end }));
  };

  const saveWorkerSchedule = async () => {
    if (!selectedWorker || !editForm.workingDays.trim()) {
      Alert.alert('Validation', 'Please select at least one working day.');
      return;
    }
    try {
      setUpdatingWorkerId(selectedWorker.id);
      await authAPI.updateWorkerSchedule(selectedWorker.id, {
        workingDays: editForm.workingDays,
        shiftStart:  editForm.shiftStart,
        shiftEnd:    editForm.shiftEnd,
      });
      Alert.alert('Saved', `Shift updated for ${selectedWorker.name}`, [{ text: 'OK', onPress: closeEditModal }]);
      await loadWorkers();
    } catch (err) {
      Alert.alert('Error', `Failed to update schedule: ${err.message}`);
    } finally { setUpdatingWorkerId(null); }
  };

  const selectedDays = useMemo(() =>
    editForm.workingDays.split(',').map((d) => d.trim()).filter(Boolean),
    [editForm.workingDays]
  );

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onScroll={scrollHeader.onScroll}
        scrollEventThrottle={scrollHeader.scrollEventThrottle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={s.pageHeader}>
          <View style={s.eyebrow}>
            <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
            <Ionicons name="people-outline" size={10} color={theme.colors.primary} />
            <Text style={s.eyebrowText}>STAFF</Text>
            <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          </View>
          <Text style={s.heading}>Worker Shifts</Text>
          <Text style={s.sub}>Manage working days and shift times for each detailer</Text>
          <SpectrumLine style={{ marginTop: 12 }} />
        </View>

        {/* ── Error ───────────────────────────────────────── */}
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Summary strip ───────────────────────────────── */}
        {workers.length > 0 && (
          <View style={s.summaryStrip}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{workers.length}</Text>
              <Text style={s.summaryLabel}>Workers</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{workers.filter(w => w.workingDays.split(',').length >= 5).length}</Text>
              <Text style={s.summaryLabel}>Full-week</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{workers.filter(w => w.workingDays.includes('Saturday') || w.workingDays.includes('Sunday')).length}</Text>
              <Text style={s.summaryLabel}>Weekend</Text>
            </View>
          </View>
        )}

        {/* ── Empty / worker list ─────────────────────────── */}
        {workers.length === 0 ? (
          <View style={s.emptyWrap}>
            <LinearGradient
              colors={[G(0.44), T(0.30)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.emptyIconRingOuter}
            >
              <View style={s.emptyIconRingInner}>
                <Ionicons name="people-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            <Text style={s.emptyTitle}>No workers yet</Text>
            <Text style={s.emptyBody}>Workers will appear here once they have been assigned to bookings.</Text>
          </View>
        ) : (
          workers.map((worker) => {
            const workingDays = (worker.workingDays || '').split(',').map((d) => d.trim()).filter(Boolean);
            const hasWeekend  = workingDays.includes('Saturday') || workingDays.includes('Sunday');
            return (
              <View key={worker.id} style={s.workerCard}>
                <PrismTopLine />
                <LinearGradient
                  colors={[G(0.05), 'transparent', T(0.03)]}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <View style={s.workerHeader}>
                  {/* Gradient ring avatar */}
                  <LinearGradient
                    colors={[G(0.80), T(0.50)]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.workerAvatarRingOuter}
                  >
                    <View style={s.workerAvatarRingInner}>
                      <Text style={s.workerAvatarText}>{(worker.name || '?')[0].toUpperCase()}</Text>
                    </View>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.workerName}>{worker.name}</Text>
                    <View style={s.workerMeta}>
                      <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                      <Text style={s.workerMetaText}>{worker.shiftStart} – {worker.shiftEnd}</Text>
                      <Text style={s.workerMetaDot}>·</Text>
                      <Text style={s.workerMetaText}>{workingDays.length} day{workingDays.length !== 1 ? 's' : ''}</Text>
                      {hasWeekend && (
                        <>
                          <Text style={s.workerMetaDot}>·</Text>
                          <Text style={s.weekendTag}>Weekend</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEditModal(worker)} activeOpacity={0.75}>
                    <Ionicons name="pencil-outline" size={15} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={s.daysRow}>
                  {DAYS_OF_WEEK.map((day) => {
                    const active = workingDays.includes(day);
                    return (
                      <View key={day} style={[s.dayChip, active && s.dayChipActive]}>
                        <Text style={[s.dayChipText, active && s.dayChipTextActive]}>
                          {day.substring(0, 3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* ── Performance stats ───────────────────── */}
                {worker.totalJobs > 0 && (
                  <>
                    <View style={s.perfRow}>
                      {[
                        { label: 'Total Jobs',  value: worker.totalJobs,    color: theme.colors.text    },
                        { label: 'Completed',   value: worker.completedJobs, color: '#84CC16'            },
                        { label: 'Today',       value: worker.todayJobs,    color: theme.colors.primary },
                        { label: 'Active Now',  value: worker.activeJobs,   color: '#C084FC'            },
                      ].map(({ label, value, color }) => (
                        <View key={label} style={s.perfStat}>
                          <Text style={[s.perfValue, { color }]}>{value}</Text>
                          <Text style={s.perfLabel}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    {/* Completion progress bar */}
                    <View style={s.progressBarWrap}>
                      <View style={s.progressBarTrack}>
                        <LinearGradient
                          colors={['#84CC16', '#22C55E']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={[s.progressBarFill, { width: `${Math.round((worker.completedJobs / worker.totalJobs) * 100)}%` }]}
                        />
                      </View>
                      <Text style={s.progressBarLabel}>
                        {Math.round((worker.completedJobs / worker.totalJobs) * 100)}% completion rate
                      </Text>
                    </View>
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ════════════════ EDIT MODAL ════════════════════════ */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={closeEditModal}>
        <View style={m.overlay}>
          {/*
            overflow:'hidden' on sheet clips PrismTopLine gradient
            to the rounded top corners (borderTopLeftRadius: 24).
            The child ScrollView's native scroll is unaffected.
          */}
          <View style={m.sheet}>
            <PrismTopLine />
            <View style={m.handle} />
            {/* Header — flat borderBottom removed; SpectrumLine replaces it */}
            <View style={m.header}>
              <View style={{ flex: 1 }}>
                <Text style={m.eyebrow}>Edit Schedule</Text>
                <Text style={m.title}>{selectedWorker?.name}</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={closeEditModal} activeOpacity={0.75}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SpectrumLine />

            <ScrollView style={m.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* ── Working days ────────────────────────── */}
              <SectionLabel>Working Days</SectionLabel>
              <View style={m.daysGrid}>
                {DAYS_OF_WEEK.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    /*
                      overflow:'hidden' on dayBtn clips the absoluteFillObject
                      gradient fill to borderRadius: 12 when active.
                    */
                    <TouchableOpacity
                      key={day}
                      style={[m.dayBtn, active && m.dayBtnActive]}
                      onPress={() => toggleWorkingDay(day)}
                      activeOpacity={0.75}
                    >
                      {active && (
                        <LinearGradient
                          colors={[theme.colors.primary, G(0.82)]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                      )}
                      <Text style={[m.dayBtnText, active && m.dayBtnTextActive]}>{day}</Text>
                      {active && (
                        <Ionicons name="checkmark" size={13} color={theme.colors.ink} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Shift time ──────────────────────────── */}
              <SectionLabel>Shift Time</SectionLabel>
              <View style={m.timeRow}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Start</FieldLabel>
                  <View style={m.timeInput}>
                    <Ionicons name="sunny-outline" size={14} color={theme.colors.textMuted} />
                    <TextInput
                      style={m.timeTextInput}
                      placeholder="HH:MM"
                      value={editForm.shiftStart}
                      onChangeText={(v) => setEditForm((p) => ({ ...p, shiftStart: v }))}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <View style={m.timeArrow}>
                  <Ionicons name="arrow-forward" size={14} color={theme.colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>End</FieldLabel>
                  <View style={m.timeInput}>
                    <Ionicons name="moon-outline" size={14} color={theme.colors.textMuted} />
                    <TextInput
                      style={m.timeTextInput}
                      placeholder="HH:MM"
                      value={editForm.shiftEnd}
                      onChangeText={(v) => setEditForm((p) => ({ ...p, shiftEnd: v }))}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </View>

              {/* ── Shift templates ─────────────────────── */}
              <SectionLabel>Quick Templates</SectionLabel>
              <View style={m.templatesGrid}>
                {SHIFTS.map((shift) => {
                  const isActive = editForm.shiftStart === shift.start && editForm.shiftEnd === shift.end;
                  return (
                    /*
                      overflow:'hidden' clips the gold-teal gradient tint
                      to the template card's borderRadius.
                    */
                    <TouchableOpacity
                      key={shift.label}
                      style={[m.template, isActive && m.templateActive]}
                      onPress={() => applyShiftTemplate(shift)}
                      activeOpacity={0.75}
                    >
                      {isActive && (
                        <LinearGradient
                          colors={[G(0.14), T(0.09)]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                      )}
                      <Text style={[m.templateLabel, isActive && m.templateLabelActive]}>{shift.label}</Text>
                      <Text style={[m.templateTime,  isActive && m.templateTimeActive]}>{shift.start} – {shift.end}</Text>
                      {isActive && <View style={m.templateActiveDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* ── Admin Control ───────────────────────────── */}
            <TouchableOpacity
              style={m.forceStopBtn}
              onPress={() => {
                Alert.alert(
                  'Force Stop Worker',
                  `Stop all live tracking for ${selectedWorker?.firstName} ${selectedWorker?.lastName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Force Stop',
                      style: 'destructive',
                      onPress: () => {
                        realtimeService.forceStopWorker(selectedWorker.id);
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="stop-circle-outline" size={15} color="#F87171" />
              <Text style={m.forceStopText}>Force Stop Tracking</Text>
            </TouchableOpacity>

            {/* ── Actions ─────────────────────────────────── */}
            <View style={m.actions}>
              <TouchableOpacity
                style={m.cancelBtn}
                onPress={closeEditModal}
                disabled={updatingWorkerId === selectedWorker?.id}
                activeOpacity={0.75}
              >
                <Text style={m.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {/*
                saveBtnWrap has overflow:'hidden' to clip the gradient
                to borderRadius: 13. Opacity disabled state applied to
                the wrapper so gradient dims with the text together.
              */}
              <View style={[m.saveBtnWrap, updatingWorkerId === selectedWorker?.id && m.saveBtnDisabled]}>
                <LinearGradient
                  colors={[theme.colors.primary, G(0.82)]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  style={m.saveBtnTouch}
                  onPress={saveWorkerSchedule}
                  disabled={updatingWorkerId === selectedWorker?.id}
                  activeOpacity={0.85}
                >
                  {updatingWorkerId === selectedWorker?.id
                    ? <ActivityIndicator size="small" color={theme.colors.ink} />
                    : (
                      <>
                        <Ionicons name="checkmark-done" size={15} color={theme.colors.ink} />
                        <Text style={m.saveBtnText}>Save Schedule</Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ── Shared atoms ─────────────────────────────────────────── */
const u = StyleSheet.create({
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 },
  sectionLabel:    { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  sectionDivider:  { flex: 1, height: 1, borderRadius: 1 },
  fieldLabel:      { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  pageHeader:  { marginBottom: 18 },
  eyebrow:     { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 12 },
  eyebrowLine: { height: 1, width: 22 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  heading:     { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  sub:         { color: theme.colors.textMuted, fontSize: 14 },

  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14, backgroundColor: 'rgba(127,29,29,0.24)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', borderRadius: 12, padding: 10 },
  errorText:   { color: '#FCA5A5', flex: 1, fontSize: 12 },

  /* Summary strip — overflow:'hidden' required */
  summaryStrip:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)', paddingVertical: 14, paddingHorizontal: 18, marginBottom: 18, overflow: 'hidden' },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryValue:   { color: theme.colors.primary, fontSize: 20, fontWeight: '900' },
  summaryLabel:   { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: theme.colors.border, marginHorizontal: 4 },

  /* Empty state */
  emptyWrap:          { alignItems: 'center', paddingVertical: 48, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 20, backgroundColor: 'rgba(19,27,37,0.8)', gap: 10 },
  emptyIconRingOuter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:         { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  emptyBody:          { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  /* Worker cards — overflow:'hidden' required */
  workerCard:    { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 12, overflow: 'hidden' },
  workerHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },

  /* Gradient ring avatar */
  workerAvatarRingOuter: { width: 46, height: 46, borderRadius: 23, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  workerAvatarRingInner: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  workerAvatarText:      { color: theme.colors.primary, fontWeight: '900', fontSize: 16 },

  workerName:     { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  workerMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  workerMetaText: { color: theme.colors.textMuted, fontSize: 11 },
  workerMetaDot:  { color: theme.colors.textMuted, fontSize: 11 },
  weekendTag:     { color: '#FBBF24', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(251,191,36,0.1)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  editBtn:        { width: 34, height: 34, borderRadius: 17, flexShrink: 0, borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)', backgroundColor: 'rgba(200,169,107,0.08)', alignItems: 'center', justifyContent: 'center' },

  daysRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dayChip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  dayChipActive:    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayChipText:      { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  dayChipTextActive:{ color: theme.colors.ink },

  /* Performance stats */
  perfRow:           { flexDirection: 'row', gap: 6, marginBottom: 10 },
  perfStat:          { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 8 },
  perfValue:         { fontSize: 18, fontWeight: '900' },
  perfLabel:         { color: theme.colors.textMuted, fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  progressBarWrap:   { gap: 5 },
  progressBarTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill:   { height: '100%', borderRadius: 4 },
  progressBarLabel:  { color: theme.colors.textMuted, fontSize: 10 },
});

/* ── Modal styles ─────────────────────────────────────────── */
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  /* overflow:'hidden' clips PrismTopLine to rounded top corners */
  sheet: { backgroundColor: theme.colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.border, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },

  /* Header — borderBottom removed; SpectrumLine handles separation */
  header:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  eyebrow:  { color: theme.colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  title:    { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  body:     { paddingHorizontal: 18, paddingBottom: 8 },

  /* Day buttons — overflow:'hidden' clips gradient to borderRadius */
  daysGrid:         { gap: 8, marginBottom: 4 },
  dayBtn:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' },
  dayBtnActive:     { borderColor: theme.colors.primary },
  dayBtnText:       { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
  dayBtnTextActive: { color: theme.colors.ink, fontWeight: '800' },

  timeRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 4 },
  timeArrow:     { paddingBottom: 13, paddingHorizontal: 2 },
  timeInput:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, paddingHorizontal: 12, paddingVertical: 11 },
  timeTextInput: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '700' },

  /* Templates — overflow:'hidden' clips gradient tint */
  templatesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  template:            { width: '47%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' },
  templateActive:      { borderColor: theme.colors.primary },
  templateLabel:       { color: theme.colors.text, fontWeight: '700', fontSize: 12, marginBottom: 4 },
  templateLabelActive: { color: theme.colors.primary },
  templateTime:        { color: theme.colors.textMuted, fontSize: 11 },
  templateTimeActive:  { color: theme.colors.primary, opacity: 0.8 },
  templateActiveDot:   { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },

  actions:       { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  cancelBtn:     { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  cancelBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  forceStopBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 4, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)' },
  forceStopText: { color: '#F87171', fontWeight: '700', fontSize: 13 },

  /* Save button — gradient fill */
  saveBtnWrap:     { flex: 2, borderRadius: 13, overflow: 'hidden' },
  saveBtnTouch:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText:     { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});