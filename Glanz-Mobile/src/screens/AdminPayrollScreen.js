import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { payrollAPI } from '../api/payroll';
import { formatQAR } from '../utils/currency';
import { useHeaderHeight } from '@react-navigation/elements';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AdminPayrollScreen() {
  const { t } = useTranslation();
  const headerHeight = useHeaderHeight();
  const now = new Date();
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [year, setYear]         = useState(now.getFullYear());
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' | 'attendance'
  const [attendanceStaffId, setAttendanceStaffId] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const loadSummaries = useCallback(async () => {
    try {
      const data = await payrollAPI.getSummary(month, year);
      setSummaries(data || []);
    } catch {
      setSummaries([]);
    }
  }, [month, year]);

  useEffect(() => {
    const run = async () => { setLoading(true); await loadSummaries(); setLoading(false); };
    run();
  }, [loadSummaries]);

  const onRefresh = async () => { setRefreshing(true); await loadSummaries(); setRefreshing(false); };

  const handleMarkPaid = async (w) => {
    setMarkingId(w.workerId);
    try {
      await payrollAPI.markPaid(w.workerId, month, year);
      await loadSummaries();
    } catch {}
    finally { setMarkingId(null); }
  };

  const openAttendance = async (staffId) => {
    setAttendanceStaffId(staffId);
    setActiveTab('attendance');
    setAttendanceLoading(true);
    const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const periodEnd   = new Date(year, month, 0).toISOString().split('T')[0];
    try {
      const data = await payrollAPI.getAttendance(staffId, periodStart, periodEnd);
      setAttendance(data || []);
    } catch { setAttendance([]); }
    finally { setAttendanceLoading(false); }
  };

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '--';

  const totalPaidOut = summaries.filter(s => s.isPaid).reduce((sum, s) => sum + (s.estimatedSalary || 0), 0);
  const totalPending = summaries.filter(s => !s.isPaid).reduce((sum, s) => sum + (s.estimatedSalary || 0), 0);

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.fixedHeader, { paddingTop: headerHeight + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>{t('admin.payroll.title', 'Payroll')}</Text>
          <Text style={s.pageSub}>{MONTHS[month - 1]} {year}</Text>
        </View>
        {/* Month / Year selectors */}
        <View style={s.monthRow}>
          <TouchableOpacity style={s.navBtn} onPress={() => {
            if (month === 1) { setMonth(12); setYear(y => y - 1); }
            else setMonth(m => m - 1);
          }}>
            <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => {
            if (month === 12) { setMonth(1); setYear(y => y + 1); }
            else setMonth(m => m + 1);
          }}>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, activeTab === 'payroll' && s.tabActive]} onPress={() => setActiveTab('payroll')}>
          <Text style={[s.tabText, activeTab === 'payroll' && s.tabTextActive]}>{t('admin.payroll.tab', 'Payroll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'attendance' && s.tabActive]} onPress={() => {
          if (summaries.length > 0 && !attendanceStaffId) openAttendance(summaries[0].workerId);
          else setActiveTab('attendance');
        }}>
          <Text style={[s.tabText, activeTab === 'attendance' && s.tabTextActive]}>{t('attendance.shiftToday', 'Attendance')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : activeTab === 'payroll' ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary strip */}
          <View style={s.strip}>
            <View style={s.stripItem}>
              <Text style={s.stripValue}>{formatQAR(totalPending)}</Text>
              <Text style={s.stripLabel}>{t('admin.payroll.pending', 'Pending')}</Text>
            </View>
            <View style={s.stripDivider} />
            <View style={s.stripItem}>
              <Text style={[s.stripValue, { color: '#84CC16' }]}>{formatQAR(totalPaidOut)}</Text>
              <Text style={s.stripLabel}>{t('admin.payroll.paidOut', 'Paid Out')}</Text>
            </View>
            <View style={s.stripDivider} />
            <View style={s.stripItem}>
              <Text style={s.stripValue}>{summaries.length}</Text>
              <Text style={s.stripLabel}>{t('admin.payroll.workers', 'Workers')}</Text>
            </View>
          </View>

          {summaries.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={32} color={theme.colors.textMuted} />
              <Text style={s.emptyText}>{t('admin.payroll.noWorkers', 'No active workers.')}</Text>
            </View>
          ) : summaries.map(w => (
            <View key={w.workerId} style={[s.card, w.isPaid && s.cardPaid]}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.workerName}>{w.workerName}</Text>
                  <Text style={s.workerType}>{w.compensationType === 'Percentage' ? `${w.percentageRate}% commission` : t('admin.payroll.fixedSalary', 'Fixed Salary')}</Text>
                </View>
                {w.isPaid ? (
                  <View style={s.paidBadge}><Ionicons name="checkmark-circle" size={14} color="#84CC16" /><Text style={s.paidBadgeText}>{t('admin.payroll.paid', 'Paid')}</Text></View>
                ) : null}
              </View>

              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{w.jobsCompleted}</Text>
                  <Text style={s.statLbl}>{t('admin.payroll.jobs', 'Jobs')}</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statVal}>{formatQAR(w.totalRevenue)}</Text>
                  <Text style={s.statLbl}>{t('admin.payroll.revenue', 'Revenue')}</Text>
                </View>
                {w.totalMinutesWorked != null && (
                  <View style={s.statBox}>
                    <Text style={s.statVal}>{Math.round(w.totalMinutesWorked / 60 * 10) / 10}h</Text>
                    <Text style={s.statLbl}>{t('admin.payroll.hoursWorked', 'Hours')}</Text>
                  </View>
                )}
                {w.daysPresent != null && (
                  <View style={s.statBox}>
                    <Text style={s.statVal}>{w.daysPresent}</Text>
                    <Text style={s.statLbl}>{t('admin.payroll.daysPresent', 'Days')}</Text>
                  </View>
                )}
              </View>

              <View style={s.salaryRow}>
                {w.monthlySalary != null && (
                  <Text style={s.salaryBase}>{t('admin.payroll.baseSalary', 'Base')}: {formatQAR(w.monthlySalary)}</Text>
                )}
                <Text style={s.salaryEst}>{t('admin.payroll.estimated', 'Est. Pay')}: <Text style={s.salaryEstVal}>{formatQAR(w.estimatedSalary)}</Text></Text>
              </View>

              {w.totalMinutesWorked == null && !w.isPaid && w.compensationType !== 'Percentage' && (
                <Text style={s.noAttendanceNote}>{t('admin.payroll.noAttendanceNote', 'No attendance logged — showing full salary.')}</Text>
              )}

              <View style={s.cardActions}>
                <TouchableOpacity style={s.attendanceBtn} onPress={() => openAttendance(w.workerId)}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                  <Text style={s.attendanceBtnText}>{t('admin.payroll.viewAttendance', 'Attendance')}</Text>
                </TouchableOpacity>
                {!w.isPaid && (
                  <TouchableOpacity style={s.markPaidBtn} onPress={() => handleMarkPaid(w)} disabled={markingId === w.workerId}>
                    {markingId === w.workerId ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={14} color="#000" />
                        <Text style={s.markPaidText}>{t('admin.payroll.markPaid', 'Mark Paid')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        /* Attendance Tab */
        <View style={{ flex: 1 }}>
          {/* Worker selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.workerChips}
            style={{ flexGrow: 0 }}
          >
            {summaries.map(w => (
              <TouchableOpacity
                key={w.workerId}
                style={[s.workerChip, attendanceStaffId === w.workerId && s.workerChipActive]}
                onPress={() => openAttendance(w.workerId)}
              >
                <Text style={[s.workerChipText, attendanceStaffId === w.workerId && s.workerChipTextActive]}>
                  {w.workerName.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {attendanceLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {attendance.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="calendar-outline" size={32} color={theme.colors.textMuted} />
                  <Text style={s.emptyText}>{t('admin.payroll.noAttendance', 'No attendance records for this period.')}</Text>
                </View>
              ) : attendance.map(a => (
                <View key={a.id} style={s.attendanceCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.attendanceDate}>{fmtDate(a.shiftDate)}</Text>
                    {a.durationMinutes != null ? (
                      <Text style={s.attendanceDuration}>{Math.round(a.durationMinutes / 60 * 10) / 10}h</Text>
                    ) : (
                      <View style={s.missingBadge}><Text style={s.missingText}>{t('admin.payroll.incomplete', 'Incomplete')}</Text></View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
                    <View>
                      <Text style={s.attLabel}>{t('attendance.clockedIn', 'In')}</Text>
                      <Text style={s.attTime}>{fmtTime(a.clockIn)}</Text>
                    </View>
                    <View>
                      <Text style={s.attLabel}>{t('attendance.clockedOut', 'Out')}</Text>
                      <Text style={s.attTime}>{fmtTime(a.clockOut)}</Text>
                    </View>
                    {a.note ? (
                      <View style={{ flex: 1 }}>
                        <Text style={s.attLabel}>{t('attendance.noteOptional', 'Note')}</Text>
                        <Text style={[s.attTime, { fontSize: 11 }]} numberOfLines={2}>{a.note}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: theme.colors.bg },
  fixedHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  pageTitle:   { color: theme.colors.text, fontWeight: '900', fontSize: 24 },
  pageSub:     { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  monthRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn:      { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)', backgroundColor: 'rgba(200,169,107,0.08)', alignItems: 'center', justifyContent: 'center' },
  monthLabel:  { color: theme.colors.text, fontWeight: '700', fontSize: 13, minWidth: 70, textAlign: 'center' },
  tabRow:      { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  tab:         { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive:   { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.1)' },
  tabText:     { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: theme.colors.primary },
  strip:       { flexDirection: 'row', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14, marginBottom: 14, backgroundColor: 'rgba(19,27,37,0.8)' },
  stripItem:   { flex: 1, alignItems: 'center' },
  stripValue:  { color: theme.colors.primary, fontWeight: '900', fontSize: 16 },
  stripLabel:  { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  stripDivider:{ width: 1, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  empty:       { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText:   { color: theme.colors.textMuted, fontSize: 14 },
  card:        { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 10 },
  cardPaid:    { borderColor: 'rgba(132,204,22,0.3)' },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  workerName:  { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
  workerType:  { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  paidBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(132,204,22,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(132,204,22,0.3)' },
  paidBadgeText: { color: '#84CC16', fontWeight: '700', fontSize: 11 },
  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statBox:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 8, alignItems: 'center' },
  statVal:     { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  statLbl:     { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  salaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  salaryBase:  { color: theme.colors.textMuted, fontSize: 12 },
  salaryEst:   { color: theme.colors.textMuted, fontSize: 12 },
  salaryEstVal:{ color: theme.colors.primary, fontWeight: '800' },
  noAttendanceNote: { color: '#FBBF24', fontSize: 11, marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  attendanceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)', borderRadius: 10, paddingVertical: 8 },
  attendanceBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  markPaidBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 8 },
  markPaidText:{ color: '#000', fontWeight: '700', fontSize: 12 },
  workerChips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  workerChip:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border },
  workerChipActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.1)' },
  workerChipText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  workerChipTextActive: { color: theme.colors.primary },
  attendanceCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: 'rgba(19,27,37,0.8)', padding: 12, marginBottom: 8 },
  attendanceDate: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  attendanceDuration: { color: '#84CC16', fontWeight: '800', fontSize: 13 },
  missingBadge: { backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  missingText: { color: '#FBBF24', fontWeight: '700', fontSize: 11 },
  attLabel:    { color: theme.colors.textMuted, fontSize: 10 },
  attTime:     { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
});
