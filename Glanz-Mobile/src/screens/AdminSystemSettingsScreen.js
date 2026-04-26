import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { settingsAPI } from '../api/settings';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { theme } from '../theme/theme';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminSystemSettingsScreen() {
  const headerHeight = useHeaderHeight();
  const scrollHeader = useScrollHeader();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [bufferMin, setBufferMin] = useState('30');
  const [travelBuffer, setTravelBuffer] = useState('30');
  const [reminderBefore, setReminderBefore] = useState('5');

  // ── Load current settings ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setError('');
        const data = await settingsAPI.getSystemSettings();
        if (data?.defaultBufferMinutes != null) {
          setBufferMin(String(data.defaultBufferMinutes));
        }
        if (data?.workerTravelBufferMinutes != null) {
          setTravelBuffer(String(data.workerTravelBufferMinutes));
        }
        if (data?.workerReminderBeforeTravelMinutes != null) {
          setReminderBefore(String(data.workerReminderBeforeTravelMinutes));
        }
      } catch {
        setError('Failed to load system settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const buffer = Number(bufferMin);
    const travel = Number(travelBuffer);
    const reminder = Number(reminderBefore);

    if (!Number.isFinite(buffer) || buffer < 0 || buffer > 240) {
      setError('Booking buffer must be between 0 and 240 minutes.'); return;
    }
    if (!Number.isFinite(travel) || travel < 0 || travel > 120) {
      setError('Travel buffer must be between 0 and 120 minutes.'); return;
    }
    if (!Number.isFinite(reminder) || reminder < 1 || reminder > 30) {
      setError('Reminder must be between 1 and 30 minutes.'); return;
    }
    try {
      setSaving(true); setError(''); setSuccess('');
      await settingsAPI.updateSystemSettings({
        defaultBufferMinutes: buffer,
        workerTravelBufferMinutes: travel,
        workerReminderBeforeTravelMinutes: reminder,
      });
      setSuccess(`Saved: Buffer ${buffer}m, Travel ${travel}m, Reminder ${reminder}m before leaving.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 16 }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      onScroll={scrollHeader.onScroll}
      scrollEventThrottle={scrollHeader.scrollEventThrottle}
    >
      {/* Page header */}
      <View style={s.pageHeader}>
        <Text style={s.heading}>System Settings</Text>
        <Text style={s.sub}>Configure global scheduling parameters.</Text>
      </View>

      {/* Error / Success banners */}
      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
      {!!success && (
        <View style={s.successBanner}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#86EFAC" />
          <Text style={s.successText}>{success}</Text>
        </View>
      )}

      {/* ── Buffer setting ───────────────────────────────────────────── */}
      <View style={s.card}>
        {/* Section header */}
        <View style={s.sectionRow}>
          <Ionicons name="timer-outline" size={16} color={theme.colors.primary} />
          <Text style={s.sectionTitle}>Post-Booking Buffer</Text>
        </View>

        <Text style={s.description}>
          Minimum gap (in minutes) enforced after every booking before a worker is
          considered available again. Applied to ALL workers and ALL bookings
          consistently — no per-package overrides.
        </Text>

        <Text style={s.fieldLabel}>Default Buffer Minutes</Text>
        <TextInput
          style={s.input}
          value={bufferMin}
          keyboardType="number-pad"
          placeholder="e.g. 30"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, '');
            setBufferMin(clean);
            setError(''); setSuccess('');
          }}
        />

        {/* Preset quick-picks */}
        <Text style={s.fieldLabel}>Quick Presets</Text>
        <View style={s.presetRow}>
          {[0, 15, 30, 45, 60].map((min) => (
            <TouchableOpacity
              key={min}
              style={[s.preset, bufferMin === String(min) && s.presetActive]}
              onPress={() => { setBufferMin(String(min)); setError(''); setSuccess(''); }}
            >
              <Text style={[s.presetText, bufferMin === String(min) && s.presetTextActive]}>
                {min === 0 ? 'None' : `${min}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* How the engine uses this value */}
        <View style={s.ruleBox}>
          <Text style={s.ruleTitle}>How availability is computed</Text>
          <Text style={s.ruleText}>
            A worker is available at time T only when:
          </Text>
          <Text style={s.ruleBullet}>
            {'  '}• T ≥ lastBookingEnd + buffer
          </Text>
          <Text style={s.ruleBullet}>
            {'  '}• T does not overlap any existing booking
          </Text>
          <Text style={s.ruleBullet}>
            {'  '}• T is within the worker's shift hours
          </Text>
          <Text style={[s.ruleText, { marginTop: 6 }]}>
            A slot is shown to customers if ANY worker satisfies all three conditions.
          </Text>
        </View>
      </View>

      {/* ── Worker Travel Buffer ────────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.sectionRow}>
          <Ionicons name="car-outline" size={16} color={theme.colors.primary} />
          <Text style={s.sectionTitle}>Worker Travel Buffer</Text>
        </View>
        <Text style={s.description}>
          Time allocated for a worker to travel between job locations. Used to calculate
          when the detailer should leave for their next appointment.
        </Text>
        <Text style={s.fieldLabel}>Travel Buffer Minutes</Text>
        <TextInput
          style={s.input}
          value={travelBuffer}
          keyboardType="number-pad"
          placeholder="e.g. 30"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, '');
            setTravelBuffer(clean);
            setError(''); setSuccess('');
          }}
        />
        <Text style={s.fieldLabel}>Quick Presets</Text>
        <View style={s.presetRow}>
          {[15, 30, 45, 60].map((min) => (
            <TouchableOpacity
              key={min}
              style={[s.preset, travelBuffer === String(min) && s.presetActive]}
              onPress={() => { setTravelBuffer(String(min)); setError(''); setSuccess(''); }}
            >
              <Text style={[s.presetText, travelBuffer === String(min) && s.presetTextActive]}>{min}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Worker Reminder Settings ────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.sectionRow}>
          <Ionicons name="alarm-outline" size={16} color={theme.colors.primary} />
          <Text style={s.sectionTitle}>Worker Departure Reminder</Text>
        </View>
        <Text style={s.description}>
          Alert detailers this many minutes before they need to leave for their next job.
          Example: 5 min means alert at (job time - travel buffer - 5 min).
        </Text>
        <Text style={s.fieldLabel}>Remind Before Leaving (minutes)</Text>
        <TextInput
          style={s.input}
          value={reminderBefore}
          keyboardType="number-pad"
          placeholder="e.g. 5"
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, '');
            setReminderBefore(clean);
            setError(''); setSuccess('');
          }}
        />
        <Text style={s.fieldLabel}>Quick Presets</Text>
        <View style={s.presetRow}>
          {[3, 5, 10, 15].map((min) => (
            <TouchableOpacity
              key={min}
              style={[s.preset, reminderBefore === String(min) && s.presetActive]}
              onPress={() => { setReminderBefore(String(min)); setError(''); setSuccess(''); }}
            >
              <Text style={[s.presetText, reminderBefore === String(min) && s.presetTextActive]}>{min}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Upsell system info ────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.sectionRow}>
          <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
          <Text style={s.sectionTitle}>Upsell / Add-On Rules</Text>
        </View>
        <Text style={s.description}>
          Add-ons selected during booking are <Text style={s.bold}>proposals only</Text> — they
          do not affect scheduling or block future slots.{'\n\n'}
          The worker's booking end time is extended <Text style={s.bold}>only when the
          add-on is confirmed</Text> via the Sales Kit in the job screen. At that point,
          the booking interval is persisted and future availability recalculated automatically.
        </Text>
      </View>

      <TouchableOpacity
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={theme.colors.ink} size="small" />
          : <Text style={s.saveBtnText}>Save Settings</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  pageHeader: { marginBottom: 20 },
  heading:    { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  sub:        { fontSize: 13, color: theme.colors.mist },

  errorBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: theme.radius.sm, padding: 10, marginBottom: 12 },
  errorText:    { flex: 1, fontSize: 13, color: '#FCA5A5' },
  successBanner:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: theme.radius.sm, padding: 10, marginBottom: 12 },
  successText:  { flex: 1, fontSize: 13, color: '#86EFAC' },

  card:         { backgroundColor: theme.card.bg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 14 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  description:  { fontSize: 13, color: theme.colors.mist, lineHeight: 19, marginBottom: 14 },
  bold:         { fontWeight: '700', color: theme.colors.text },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input:      { backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, marginBottom: 14 },

  presetRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  preset:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBg },
  presetActive:   { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryBg },
  presetText:     { fontSize: 13, color: theme.colors.textMuted },
  presetTextActive:{ color: theme.colors.primary, fontWeight: '700' },

  ruleBox:    { backgroundColor: theme.colors.inputBg, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  ruleTitle:  { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  ruleText:   { fontSize: 12, color: theme.colors.mist, lineHeight: 18 },
  ruleBullet: { fontSize: 12, color: theme.colors.primary, lineHeight: 18, fontWeight: '600' },

  saveBtn:         { backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
});
