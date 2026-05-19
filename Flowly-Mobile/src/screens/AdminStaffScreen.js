// AdminStaffScreen.js — Mobile version of AdminStaff.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api/auth';
import { theme } from '../theme/theme';

const PADDING = 20;
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHIFT_HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const BLANK_FORM = { firstName: '', lastName: '', email: '', phone: '', password: '' };
const BLANK_SCHEDULE = { workingDays: [], shiftStart: '09:00', shiftEnd: '18:00', dayOverrides: {} };

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

const PrismLeftBar = ({ color = 'default' }) => (
  <LinearGradient
    colors={color === 'green' ? [T(0.90), T(0.55), 'transparent'] : color === 'amber' ? ['rgba(251,191,36,0.90)', 'rgba(251,191,36,0.55)', 'transparent'] : [G(0.90), G(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={prismStyles.leftBar}
    pointerEvents="none"
  />
);

const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Atoms ──────────────────────────────────────────────── */
const Eyebrow = ({ children }) => (
  <View style={u.eyebrow}>
    <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
    <Text style={u.eyebrowText}>{children}</Text>
    <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
  </View>
);

const SectionLabel = ({ children }) => (
  <View style={u.sectionLabelRow}>
    <Text style={u.sectionLabel}>{children}</Text>
    <LinearGradient colors={['transparent', G(0.55)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.sectionDivider} />
  </View>
);

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function AdminStaffScreen() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  const [workers,      setWorkers]      = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [refreshing,  setRefreshing]= useState(false);
  const [showAddForm,   setShowAddForm]= useState(false);

  const [form,    setForm]    = useState(BLANK_FORM);
  const [saving,   setSaving] = useState(null);
  const [error,   setError] = useState('');

  const [salaryInputs, setSalaryInputs] = useState({});
  const [salarySaving, setSalarySaving] = useState(null);
  const [salarySaved, setSalarySaved] = useState(null);

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [payroll, setPayroll] = useState([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [payrollLoading, setPayrollLoading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await authAPI.getWorkers();
      setWorkers(data || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || t('adminStaff.failedLoadStaff'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const loadPayroll = useCallback(async () => {
    if (workers.length === 0) return;
    setPayrollLoading(true);
    try {
      const data = await authAPI.getPayrollSummary(payrollMonth, payrollYear);
      setPayroll(data || []);
    } catch { setPayroll([]); }
    finally { setPayrollLoading(false); }
  }, [payrollMonth, payrollYear, workers.length]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (workers.length > 0) loadPayroll(); }, [payrollMonth, payrollYear, workers.length, loadPayroll]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const handleInputChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAddWorker = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim() || !form.phone.trim()) {
      Alert.alert(t('adminStaff.validationTitle'), t('adminStaff.fillAllFields')); return;
    }
    try {
      setSaving('new');
      await authAPI.createWorker({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setForm(BLANK_FORM);
      setShowAddForm(false);
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminStaff.failedAddWorker'));
    } finally { setSaving(null); }
  };

  const handleDeleteWorker = (worker) => {
    Alert.alert(
      t('adminStaff.removeDetailer'),
      t('adminStaff.removeDetailerConfirm', { name: `${worker.firstName} ${worker.lastName}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('adminStaff.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(worker.id);
              await authAPI.deleteWorker(worker.id);
              await load();
            } catch (err) {
              Alert.alert(t('common.error'), err?.response?.data?.message || t('adminStaff.failedDeleteWorker'));
            } finally { setDeletingId(null); }
          },
        },
      ]
    );
  };

  const handleToggleWorkerStatus = (worker) => {
    const nextStatus = !worker.isActive;
    const actionText = nextStatus ? t('adminStaff.activateAction') : t('adminStaff.deactivateAction');
    Alert.alert(
      `${nextStatus ? t('adminStaff.activate') : t('adminStaff.deactivate')} ${t('adminStaff.detailer')}`,
      t('adminStaff.confirmStatusChange', { action: actionText, name: `${worker.firstName} ${worker.lastName}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('adminStaff.confirm'),
          onPress: async () => {
            try {
              setSaving(`status-${worker.id}`);
              await authAPI.updateWorkerStatus(worker.id, nextStatus);
              await load();
            } catch (err) {
              Alert.alert(t('common.error'), err?.response?.data?.message || t('adminStaff.failedStatusChange', { action: actionText }));
            } finally { setSaving(null); }
          },
        },
      ]
    );
  };

  const handleSaveSalary = async (workerId) => {
    const val = parseFloat(salaryInputs[workerId]);
    if (!Number.isFinite(val) || val < 0) {
      Alert.alert(t('adminStaff.validationTitle'), t('adminStaff.enterValidSalary')); return;
    }
    try {
      setSalarySaving(workerId);
      await authAPI.updateWorkerSalary(workerId, val);
      setSalarySaved(workerId);
      setTimeout(() => setSalarySaved(null), 2500);
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminStaff.failedSaveSalary'));
    } finally { setSalarySaving(null); }
  };

  const openScheduleModal = (worker) => {
    setSelectedWorker({ ...worker, schedule: parseSchedule(worker) });
  };

  const parseSchedule = (worker) => {
    const workingDays = worker.workingDays
      ? worker.workingDays.split(',').map(d => d.trim()).filter(Boolean)
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOverrides = {};
    if (Array.isArray(worker.daySchedules)) {
      for (const entry of worker.daySchedules) {
        if (entry.day) dayOverrides[entry.day] = { start: entry.shiftStart || '09:00', end: entry.shiftEnd || '18:00' };
      }
    }
    return { workingDays, shiftStart: worker.shiftStart || '09:00', shiftEnd: worker.shiftEnd || '18:00', dayOverrides };
  };

  const toggleDay = (day) => {
    if (!selectedWorker) return;
    const sched = selectedWorker.schedule;
    const workingDays = sched.workingDays.includes(day)
      ? sched.workingDays.filter(d => d !== day)
      : [...sched.workingDays, day];
    setSelectedWorker({ ...selectedWorker, schedule: { ...sched, workingDays } });
  };

  const setDayOverride = (day, field, value) => {
    if (!selectedWorker) return;
    const sched = selectedWorker.schedule;
    setSelectedWorker({
      ...selectedWorker,
      schedule: {
        ...sched,
        dayOverrides: { ...sched.dayOverrides, [day]: { ...(sched.dayOverrides[day] || { start: sched.shiftStart, end: sched.shiftEnd }), [field]: value } },
      },
    });
  };

  const getEffectiveShift = (day) => {
    if (!selectedWorker) return { start: '09:00', end: '18:00', custom: false };
    const sched = selectedWorker.schedule;
    const override = sched.dayOverrides[day];
    if (override) return { start: override.start, end: override.end, custom: true };
    return { start: sched.shiftStart, end: sched.shiftEnd, custom: false };
  };

  const handleSaveSchedule = async () => {
    if (!selectedWorker) return;
    try {
      setSaving(`schedule-${selectedWorker.id}`);
      const daySchedules = Object.entries(selectedWorker.schedule.dayOverrides).map(([day, v]) => ({ day, shiftStart: v.start, shiftEnd: v.end }));
      await authAPI.updateWorkerSchedule(selectedWorker.id, {
        workingDays: selectedWorker.schedule.workingDays.join(','),
        shiftStart: selectedWorker.schedule.shiftStart,
        shiftEnd: selectedWorker.schedule.shiftEnd,
        daySchedules: daySchedules.length > 0 ? daySchedules : null,
      });
      setSelectedWorker(null);
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminStaff.failedSaveSchedule'));
    } finally { setSaving(null); }
  };

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Eyebrow>{t('adminStaff.adminPanel')}</Eyebrow>
          <View style={s.titleRow}>
            <LinearGradient colors={[G(0.14), T(0.09)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titleIconBox}>
              <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
            </LinearGradient>
            <Text style={s.heading}>{t('adminStaff.manageStaff')}</Text>
          </View>
          <Text style={s.sub}>{t('adminStaff.manageStaffSubtitle')}</Text>
          <SpectrumLine style={{ marginTop: 14 }} />
        </View>

        {/* ── Error banner ───────────────────────────────── */}
        {!!error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Add button ──────────────────────────────────── */}
        <TouchableOpacity onPress={() => setShowAddForm(true)} activeOpacity={0.8} style={s.addBtnOuter}>
          <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtnGradient}>
            <Ionicons name="add" size={16} color={theme.colors.ink} />
            <Text style={s.addBtnText}>{t('adminStaff.addDetailer')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Empty state ──────────────────���───────────────── */}
        {workers.length === 0 ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={[G(0.44), T(0.30)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIconRingOuter}>
              <View style={s.emptyIconRingInner}>
                <Ionicons name="people-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            <Text style={s.emptyTitle}>{t('adminStaff.noStaffMembers')}</Text>
            <Text style={s.emptyBody}>{t('adminStaff.addFirstDetailerHint')}</Text>
            <TouchableOpacity onPress={() => setShowAddForm(true)} style={s.emptyAction} activeOpacity={0.8}>
              <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
              <Text style={s.emptyActionText}>{t('adminStaff.addFirstDetailer')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Worker list ───────────────────────────────── */}
            {workers.map((worker, idx) => {
              const isActive = worker.isActive !== false;
              const accentColor = isActive ? '#22c55e' : '#94a3b8';
              const workingDays = (worker.workingDays || 'Monday,Tuesday,Wednesday,Thursday,Friday').split(',').map(d => d.trim());

              return (
                <View key={worker.id} style={s.workerCard}>
                  <PrismLeftBar color={isActive ? 'green' : 'default'} />
                  <LinearGradient
                    colors={[G(0.05), 'transparent', T(0.03)]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />

                  <View style={s.workerHeader}>
                    {/* Avatar */}
                    <LinearGradient colors={[G(0.80), T(0.50)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
                      <Text style={s.avatarText}>{(worker.firstName || '?')[0].toUpperCase()}</Text>
                    </LinearGradient>

                    <View style={{ flex: 1 }}>
                      <Text style={s.workerName}>{worker.firstName} {worker.lastName}</Text>
                      <View style={s.statusChip}>
                        <Text style={[s.statusChipText, { color: accentColor }]}>{isActive ? t('adminStaff.active') : t('adminStaff.inactive')}</Text>
                      </View>
                      <Text style={s.workerEmail}>{worker.email}</Text>
                      {worker.phone && <Text style={s.workerPhone}>{worker.phone}</Text>}
                      <Text style={s.workerAdded}>{t('adminStaff.addedOn', { date: new Date(worker.createdAt).toLocaleDateString() })}</Text>
                      <View style={s.scheduleInfo}>
                        <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                        <Text style={s.scheduleText}>{worker.shiftStart || '09:00'} – {worker.shiftEnd || '18:00'}</Text>
                        {Array.isArray(worker.daySchedules) && worker.daySchedules.length > 0 && (
                          <View style={s.customDayBadge}>
                            <Text style={s.customDayText}>{t('adminStaff.customCount', { count: worker.daySchedules.length })}</Text>
                          </View>
                        )}
                        <Text style={s.scheduleText}> · </Text>
                        <Text style={s.scheduleText}>{t('adminStaff.daysCount', { count: workingDays.length })}</Text>
                      </View>
                    </View>
                  </View>

                  {/* ── Actions ────────────────────────────────── */}
                  <View style={s.actionsRow}>
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => openScheduleModal(worker)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="calendar-outline" size={12} color={theme.colors.primary} />
                      <Text style={s.actionBtnText}>{t('adminStaff.schedule')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => handleToggleWorkerStatus(worker)}
                      disabled={saving === `status-${worker.id}`}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.actionBtnText, { color: isActive ? '#FBBF24' : '#86EFAC' }]}>
                        {saving === `status-${worker.id}` ? t('adminStaff.saving') : isActive ? t('adminStaff.deactivate') : t('adminStaff.activate')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnDanger]}
                      onPress={() => handleDeleteWorker(worker)}
                      disabled={deletingId === worker.id}
                      activeOpacity={0.75}
                    >
                      <Text style={s.actionBtnTextDanger}>
                        {deletingId === worker.id ? t('adminStaff.removing') : t('adminStaff.remove')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── Salary ──────────────────────────────── */}
                  <View style={s.salaryBox}>
                    <View style={s.salaryHeader}>
                      <Ionicons name="cash-outline" size={12} color={theme.colors.primary} />
                      <Text style={s.salaryLabel}>{t('adminStaff.monthlySalaryQar')}</Text>
                    </View>
                    <View style={s.salaryRow}>
                      <TextInput
                        style={s.salaryInput}
                        placeholder={t('adminStaff.salaryPlaceholder')}
                        value={salaryInputs[worker.id] ?? (worker.monthlySalary ?? '').toString()}
                        onChangeText={(v) => setSalaryInputs(p => ({ ...p, [worker.id]: v }))}
                        keyboardType="numeric"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                      <TouchableOpacity
                        style={s.salarySaveBtn}
                        onPress={() => handleSaveSalary(worker.id)}
                        disabled={salarySaving === worker.id}
                        activeOpacity={0.75}
                      >
                        {salarySaving === worker.id ? (
                          <ActivityIndicator size="small" color={theme.colors.ink} />
                        ) : salarySaved === worker.id ? (
                          <Ionicons name="checkmark" size={12} color={theme.colors.ink} />
                        ) : (
                          <Ionicons name="save-outline" size={12} color={theme.colors.ink} />
                        )}
                        <Text style={s.salarySaveText}>
                          {salarySaving === worker.id ? t('adminStaff.saving') : salarySaved === worker.id ? t('adminStaff.saved') : t('adminStaff.save')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* ── Stats ──────────────────────────────────────── */}
            <View style={s.statsCard}>
              <PrismTopLine />
              <PrismLeftBar />
              <SectionLabel>{t('adminStaff.staffStatistics')}</SectionLabel>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{workers.length}</Text>
                  <Text style={s.statLabel}>{t('adminStaff.totalDetailers')}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: '#22c55e' }]}>{workers.filter(w => w.isActive !== false).length}</Text>
                  <Text style={s.statLabel}>{t('adminStaff.active')}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.colors.primary }]}>
                    {workers.length > 0 ? new Date(Math.max(...workers.map(w => new Date(w.createdAt)))).toLocaleDateString() : '—'}
                  </Text>
                  <Text style={s.statLabel}>{t('adminStaff.lastAdded')}</Text>
                </View>
              </View>
            </View>

            {/* ── Payroll Summary ──────────────────────────────── */}
            <View style={s.payrollCard}>
              <PrismTopLine />
              <PrismLeftBar />
              <View style={s.payrollHeader}>
                <SectionLabel>{t('adminStaff.payrollSummary')}</SectionLabel>
                <View style={s.payrollSelectRow}>
                  <View style={s.payrollSelect}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNumber) => (
                      <TouchableOpacity
                        key={monthNumber}
                        style={[s.payrollMonthBtn, payrollMonth === monthNumber && s.payrollMonthBtnActive]}
                        onPress={() => setPayrollMonth(monthNumber)}
                      >
                        <Text style={[s.payrollMonthText, payrollMonth === monthNumber && s.payrollMonthTextActive]}>
                          {t(`adminStaff.monthShort.${monthNumber}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={s.payrollYearInput}
                    value={payrollYear.toString()}
                    onChangeText={(v) => setPayrollYear(parseInt(v) || new Date().getFullYear())}
                    keyboardType="numeric"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
              </View>

              {payrollLoading ? (
                <View style={s.payrollLoading}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : payroll.length === 0 ? (
                <Text style={s.payrollEmpty}>{t('adminStaff.noPayrollDataForPeriod')}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.payrollTableWrap}>
                  <View style={s.payrollTable}>
                    <View style={s.payrollTableHead}>
                      <Text style={s.payrollTableHeadCell}>{t('adminStaff.worker')}</Text>
                      <Text style={s.payrollTableHeadCell}>{t('adminStaff.salary')}</Text>
                      <Text style={s.payrollTableHeadCell}>{t('adminStaff.jobs')}</Text>
                      <Text style={s.payrollTableHeadCell}>{t('adminStaff.revenue')}</Text>
                      <Text style={s.payrollTableHeadCell}>{t('adminStaff.status')}</Text>
                    </View>
                    {payroll.map((p) => (
                      <View key={p.workerId} style={s.payrollTableRow}>
                        <Text style={s.payrollTableCell}>{p.workerName}</Text>
                        <Text style={s.payrollTableCell}>QAR {p.monthlySalary?.toLocaleString() || 0}</Text>
                        <Text style={s.payrollTableCell}>{p.jobsCompleted}</Text>
                        <Text style={[s.payrollTableCell, { color: '#86EFAC' }]}>QAR {p.totalRevenue?.toLocaleString() || 0}</Text>
                        <View style={p.isPaid ? s.statusPaid : s.statusUnpaid}>
                          <Text style={s.statusPaidText}>{p.isPaid ? t('adminStaff.paid') : t('adminStaff.unpaid')}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={s.payrollTableFoot}>
                      <Text style={s.payrollTableFootCell}>{t('adminStaff.total')}</Text>
                      <Text style={s.payrollTableFootCell}>QAR {payroll.reduce((s, p) => s + (p.monthlySalary ?? 0), 0).toLocaleString()}</Text>
                      <Text style={s.payrollTableFootCell}>{payroll.reduce((s, p) => s + p.jobsCompleted, 0)}</Text>
                      <Text style={[s.payrollTableFootCell, { color: '#86EFAC' }]}>QAR {payroll.reduce((s, p) => s + p.totalRevenue, 0).toLocaleString()}</Text>
                      <Text style={s.payrollTableFootCell}>{payroll.filter(p => p.isPaid).length}/{payroll.length}</Text>
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ════════════════ ADD FORM MODAL ════════════════════════ */}
      <Modal visible={showAddForm} transparent animationType="slide" onRequestClose={() => setShowAddForm(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <PrismTopLine />
            <View style={m.handle} />
            <View style={m.header}>
              <View style={{ flex: 1 }}>
                <Text style={m.eyebrow}>{t('adminStaff.newMember')}</Text>
                <Text style={m.title}>{t('adminStaff.addNewDetailer')}</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setShowAddForm(false)} activeOpacity={0.75}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SpectrumLine />

            <ScrollView style={m.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SectionLabel>{t('adminStaff.personalInfo')}</SectionLabel>
              <View style={m.row}>
                <View style={m.col}>
                  <Text style={m.fieldLabel}>{t('adminStaff.firstName')}</Text>
                  <TextInput style={m.input} value={form.firstName} onChangeText={(v) => handleInputChange('firstName', v)} placeholder={t('adminStaff.enterFirstName')} placeholderTextColor={theme.colors.textMuted} />
                </View>
                <View style={m.col}>
                  <Text style={m.fieldLabel}>{t('adminStaff.lastName')}</Text>
                  <TextInput style={m.input} value={form.lastName} onChangeText={(v) => handleInputChange('lastName', v)} placeholder={t('adminStaff.enterLastName')} placeholderTextColor={theme.colors.textMuted} />
                </View>
              </View>

              <SectionLabel>{t('adminStaff.contact')}</SectionLabel>
              <Text style={m.fieldLabel}>{t('adminStaff.emailAddress')}</Text>
              <TextInput style={m.input} value={form.email} onChangeText={(v) => handleInputChange('email', v)} placeholder={t('adminStaff.emailPlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <Text style={m.fieldLabel}>{t('adminStaff.phoneNumber')}</Text>
              <TextInput style={m.input} value={form.phone} onChangeText={(v) => handleInputChange('phone', v)} placeholder={t('adminStaff.phonePlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" />

              <SectionLabel>{t('adminStaff.security')}</SectionLabel>
              <Text style={m.fieldLabel}>{t('adminStaff.password')}</Text>
              <View style={m.passwordRow}>
                <TextInput
                  style={[m.input, { flex: 1 }]}
                  value={form.password}
                  onChangeText={(v) => handleInputChange('password', v)}
                  placeholder={t('adminStaff.minimumEightCharacters')}
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={m.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={m.actions}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowAddForm(false)} disabled={saving === 'new'} activeOpacity={0.75}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <View style={[m.saveBtnWrap, saving === 'new' && m.saveBtnDisabled]}>
                <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                <TouchableOpacity style={m.saveBtnTouch} onPress={handleAddWorker} disabled={saving === 'new'} activeOpacity={0.85}>
                  {saving === 'new' ? (
                    <ActivityIndicator size="small" color={theme.colors.ink} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={15} color={theme.colors.ink} />
                      <Text style={m.saveBtnText}>{t('adminStaff.addDetailer')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════ SCHEDULE MODAL ════════════════════════ */}
      <Modal visible={!!selectedWorker} transparent animationType="slide" onRequestClose={() => setSelectedWorker(null)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <PrismTopLine />
            <View style={m.handle} />
            <View style={m.header}>
              <View style={{ flex: 1 }}>
                <Text style={m.eyebrow}>{t('adminStaff.editSchedule')}</Text>
                <Text style={m.title}>{selectedWorker?.firstName} {selectedWorker?.lastName}</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setSelectedWorker(null)} activeOpacity={0.75}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SpectrumLine />

            <ScrollView style={m.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Default shift */}
              <SectionLabel>{t('adminStaff.defaultShift')}</SectionLabel>
              <View style={m.shiftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>{t('adminStaff.start')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.shiftScroll}>
                    <View style={m.shiftChips}>
                      {SHIFT_HOURS.map(h => (
                        <TouchableOpacity
                          key={h}
                          style={[m.shiftChip, selectedWorker?.schedule?.shiftStart === h && m.shiftChipActive]}
                          onPress={() => setSelectedWorker({ ...selectedWorker, schedule: { ...selectedWorker.schedule, shiftStart: h } })}
                        >
                          <Text style={[m.shiftChipText, selectedWorker?.schedule?.shiftStart === h && m.shiftChipTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>{t('adminStaff.end')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.shiftScroll}>
                    <View style={m.shiftChips}>
                      {SHIFT_HOURS.map(h => (
                        <TouchableOpacity
                          key={h}
                          style={[m.shiftChip, selectedWorker?.schedule?.shiftEnd === h && m.shiftChipActive]}
                          onPress={() => setSelectedWorker({ ...selectedWorker, schedule: { ...selectedWorker.schedule, shiftEnd: h } })}
                        >
                          <Text style={[m.shiftChipText, selectedWorker?.schedule?.shiftEnd === h && m.shiftChipTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Days */}
              <SectionLabel>{t('adminStaff.workingDays')}</SectionLabel>
              <View style={m.daysGrid}>
                {ALL_DAYS.map(day => {
                  const active = selectedWorker?.schedule?.workingDays.includes(day);
                  const eff = getEffectiveShift(day);
                  return (
                    <View key={day} style={[m.dayCard, active && m.dayCardActive]}>
                      <TouchableOpacity style={m.dayBtn} onPress={() => toggleDay(day)}>
                        <Text style={[m.dayBtnText, active && m.dayBtnTextActive]}>{t(`adminStaff.days.${day.toLowerCase()}`)}</Text>
                      </TouchableOpacity>
                      {active && (
                        <View style={m.dayOverrideRow}>
                          <View style={m.dayOverrideSelect}>
                            {SHIFT_HOURS.map(h => (
                              <TouchableOpacity
                                key={h}
                                style={[m.overrideChip, eff.start === h && m.overrideChipActive]}
                                onPress={() => setDayOverride(day, 'start', h)}
                              >
                                <Text style={[m.overrideChipText, eff.start === h && m.overrideChipTextActive]}>{h}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={m.dayOverrideTo}>{t('adminStaff.to')}</Text>
                          <View style={m.dayOverrideSelect}>
                            {SHIFT_HOURS.map(h => (
                              <TouchableOpacity
                                key={h}
                                style={[m.overrideChip, eff.end === h && m.overrideChipActive]}
                                onPress={() => setDayOverride(day, 'end', h)}
                              >
                                <Text style={[m.overrideChipText, eff.end === h && m.overrideChipTextActive]}>{h}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={m.actions}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setSelectedWorker(null)} disabled={saving} activeOpacity={0.75}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <View style={[m.saveBtnWrap, saving && m.saveBtnDisabled]}>
                <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                <TouchableOpacity style={m.saveBtnTouch} onPress={handleSaveSchedule} disabled={saving} activeOpacity={0.85}>
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.colors.ink} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={15} color={theme.colors.ink} />
                      <Text style={m.saveBtnText}>{t('adminStaff.saveSchedule')}</Text>
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
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  eyebrowLine: { height: 1, width: 24 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 },
  sectionLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  sectionDivider: { flex: 1, height: 1, borderRadius: 1 },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 52 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  pageHeader: { marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  titleIconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G(0.30) },
  heading: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 14 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, backgroundColor: 'rgba(127,29,29,0.24)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', borderRadius: 12, padding: 12 },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 12 },

  addBtnOuter: { marginBottom: 14, borderRadius: 14, overflow: 'hidden' },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  addBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 48, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 20, backgroundColor: 'rgba(19,27,37,0.8)', gap: 12 },
  emptyIconRingOuter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  emptyAction: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, overflow: 'hidden' },
  emptyActionText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },

  /* Worker card */
  workerCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 12, overflow: 'hidden' },
  workerHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatarRing: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: theme.colors.primary, fontWeight: '900', fontSize: 16 },
  workerName: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  statusChip: { backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 6 },
  statusChipText: { fontSize: 10, fontWeight: '700' },
  workerEmail: { color: theme.colors.text, fontSize: 12, marginBottom: 2 },
  workerPhone: { color: theme.colors.textMuted, fontSize: 11, marginBottom: 2 },
  workerAdded: { color: theme.colors.textMuted, fontSize: 10, marginBottom: 4 },
  scheduleInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  scheduleText: { color: theme.colors.textMuted, fontSize: 11 },
  customDayBadge: { backgroundColor: G(0.14), paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  customDayText: { color: theme.colors.primary, fontSize: 9, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: G(0.25), backgroundColor: G(0.08) },
  actionBtnText: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  actionBtnDanger: { borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(127,29,29,0.2)' },
  actionBtnTextDanger: { color: '#FCA5A5', fontSize: 11, fontWeight: '700' },

  /* Salary */
  salaryBox: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, backgroundColor: G(0.03) },
  salaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  salaryLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  salaryInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.inputBg, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  salarySaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: G(0.14), borderWidth: 1, borderColor: G(0.40) },
  salarySaveText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },

  /* Stats */
  statsCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16, marginBottom: 12, overflow: 'hidden' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: G(0.04), borderRadius: 12, paddingVertical: 12 },
  statValue: { color: theme.colors.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: theme.colors.border, marginHorizontal: 4 },

  /* Payroll */
  payrollCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16, marginBottom: 12, overflow: 'hidden' },
  payrollHeader: { marginBottom: 8 },
  payrollSelectRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  payrollSelect: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', flex: 1 },
  payrollMonthBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  payrollMonthBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  payrollMonthText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  payrollMonthTextActive: { color: theme.colors.ink },
  payrollYearInput: { width: 60, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.inputBg, paddingHorizontal: 10, paddingVertical: 8, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  payrollLoading: { alignItems: 'center', paddingVertical: 24 },
  payrollEmpty: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  payrollTableWrap: { marginTop: 8 },
  payrollTable: { minWidth: '100%' },
  payrollTableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 8, marginBottom: 4 },
  payrollTableHeadCell: { flex: 1, color: theme.colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  payrollTableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  payrollTableCell: { flex: 1, color: theme.colors.text, fontSize: 12 },
  payrollTableFoot: { flexDirection: 'row', paddingTop: 10 },
  payrollTableFootCell: { flex: 1, color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  statusPaid: { backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusUnpaid: { backgroundColor: 'rgba(251,191,36,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPaidText: { fontSize: 10, fontWeight: '700', color: '#22c55e' },
});

/* ── Modal styles ─────────────────────────────────────────── */
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', borderWidth: 1, borderBottomWidth: 0, borderColor: theme.colors.border, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingVertical: 14, gap: 12 },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingBottom: 8 },

  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, paddingHorizontal: 13, paddingVertical: 12, color: theme.colors.text, fontSize: 14, marginBottom: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },

  shiftRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  shiftScroll: { maxWidth: '100%' },
  shiftChips: { flexDirection: 'row', gap: 6 },
  shiftChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  shiftChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  shiftChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  shiftChipTextActive: { color: theme.colors.ink },

  daysGrid: { gap: 8 },
  dayCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  dayCardActive: { borderColor: G(0.40), backgroundColor: G(0.04) },
  dayBtn: { marginBottom: 6 },
  dayBtnText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  dayBtnTextActive: { color: theme.colors.primary },
  dayOverrideRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayOverrideSelect: { flexDirection: 'row', gap: 4 },
  dayOverrideTo: { color: theme.colors.textMuted, fontSize: 11 },
  overrideChip: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  overrideChipActive: { borderColor: G(0.55), backgroundColor: G(0.10) },
  overrideChipText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  overrideChipTextActive: { color: theme.colors.primary, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  cancelBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  saveBtnWrap: { flex: 2, borderRadius: 13, overflow: 'hidden' },
  saveBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});