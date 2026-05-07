import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Picker } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { payrollAPI } from '../api/payroll';

export default function AdminPayrollScreen() {
  const { t } = useTranslation();
  const { handleScroll, headerStyle, headerOpacity } = useScrollHeader();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [payroll, setPayroll] = useState(null);

  useEffect(() => { loadWorkers(); }, []);
  useEffect(() => { if (selectedWorker) loadPayroll(); }, [selectedWorker, month, year]);

  const loadWorkers = async () => {
    try {
      const data = await payrollAPI.getWorkers();
      setWorkers(data || []);
      if (data?.length > 0) setSelectedWorker(data[0].id);
    } catch { setWorkers([]); } finally { setLoading(false); }
  };

  const loadPayroll = async () => {
    if (!selectedWorker) return;
    setLoading(true);
    try {
      const data = await payrollAPI.getPayroll(selectedWorker, month, year);
      setPayroll(data);
    } catch { setPayroll(null); } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!selectedWorker) return;
    setLoading(true);
    try {
      await payrollAPI.generatePayroll(selectedWorker, month, year);
      loadPayroll();
    } finally { setLoading(false); }
  };

  const handleProcess = async (payrollId) => {
    try {
      await payrollAPI.processPayment(payrollId);
      loadPayroll();
    } catch {}
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.title, { opacity: headerOpacity }]}>{t('admin.payroll.title', 'Payroll')}</Text>
      </View>

      <ScrollView style={styles.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={styles.filters}>
          <View style={styles.pickerBox}>
            <Text style={styles.label}>{t('admin.payroll.worker', 'Worker')}</Text>
            <Picker selectedValue={selectedWorker} onValueChange={setSelectedWorker} style={styles.picker}>
              {workers.map(w => <Picker.Item key={w.id} label={`${w.firstName} ${w.lastName}`} value={w.id} />)}
            </Picker>
          </View>
          <View style={styles.pickerBox}>
            <Text style={styles.label}>{t('admin.payroll.month', 'Month')}</Text>
            <Picker selectedValue={month} onValueChange={setMonth} style={styles.picker}>
              {Array.from({ length: 12 }, (_, i) => <Picker.Item key={i} label={i+1} value={i+1} />)}
            </Picker>
          </View>
          <View style={styles.pickerBox}>
            <Text style={styles.label}>{t('admin.payroll.year', 'Year')}</Text>
            <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
              {[2024,2025,2026].map(y => <Picker.Item key={y} label={y} value={y} />)}
            </Picker>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.center} />
        ) : payroll ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.payroll.summary', 'Payroll Summary')}</Text>
            <View style={styles.row}><Text style={styles.label}>{t('admin.payroll.totalJobs', 'Total Jobs')}</Text><Text style={styles.value}>{payroll.totalJobs}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.payroll.grossPay', 'Gross Pay')}</Text><Text style={styles.value}>${payroll.grossPay?.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.payroll.deductions', 'Deductions')}</Text><Text style={styles.value}>${payroll.deductions?.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.payroll.netPay', 'Net Pay')}</Text><Text style={[styles.value, { color: theme.colors.primary }]}>${payroll.netPay?.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>{t('admin.payroll.status', 'Status')}</Text><Text style={styles.value}>{payroll.status}</Text></View>
            {payroll.status !== 'Paid' && (
              <TouchableOpacity style={styles.processBtn} onPress={() => handleProcess(payroll.id)}>
                <Text style={styles.processText}>{t('admin.payroll.process', 'Process Payment')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.center}>
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
              <Text style={styles.generateText}>{t('admin.payroll.generate', 'Generate Payroll')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  scroll: { flex: 1 },
  filters: { paddingTop: 120, paddingHorizontal: 20, gap: 12 },
  pickerBox: { backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  label: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 4, paddingHorizontal: 12, paddingTop: 8 },
  picker: { color: theme.colors.text },
  center: { paddingTop: 200, alignItems: 'center' },
  card: { margin: 20, backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  value: { color: theme.colors.text, fontWeight: '600' },
  processBtn: { marginTop: 20, backgroundColor: theme.colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  processText: { color: '#000', fontWeight: '700' },
  generateBtn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 40 },
  generateText: { color: '#000', fontWeight: '700' },
  footer: { height: 100 },
});
