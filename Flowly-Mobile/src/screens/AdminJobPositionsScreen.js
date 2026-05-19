// AdminJobPositionsScreen.js — Mobile version of AdminJobPositions.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';

const PADDING = 20;
const STORAGE_KEY = 'adminJobPositions';
const DEPARTMENTS = ['Operations', 'Sales', 'Marketing', 'HR', 'Finance', 'IT'];
const JOB_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'];

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const EMPTY_FORM = { title: '', department: '', type: 'Full-Time', location: '', description: '', isOpen: true };

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
    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 }}
    pointerEvents="none"
  />
);

/* ── Atoms ──────────────────────────────────────────────── */
const Eyebrow = ({ children }) => (
  <View style={u.eyebrow}>
    <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
    <Text style={u.eyebrowText}>{children}</Text>
    <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
  </View>
);

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function AdminJobPositionsScreen() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  const loadPositions = () => {
    try {
      const raw = globalThis?.AsyncStorage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const savePositions = (positions) => {
    try {
      globalThis?.AsyncStorage?.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {}
  };

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    const data = loadPositions();
    setPositions(data);
    setLoading(false);
  }, []);

  const handleSubmit = () => {
    if (!form.title.trim()) {
      Alert.alert(t('adminJobPositions.validationTitle'), t('adminJobPositions.positionTitleRequired')); return;
    }
    setError('');
    if (editId !== null) {
      setPositions(positions.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      setPositions([...positions, { ...form, id: Date.now() }]);
    }
    const updated = editId !== null
      ? positions.map(p => p.id === editId ? { ...p, ...form } : p)
      : [...positions, { ...form, id: Date.now() }];
    savePositions(updated);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditId(null);
  };

  const handleEdit = (pos) => {
    setForm({
      title: pos.title,
      department: pos.department || '',
      type: pos.type || 'Full-Time',
      location: pos.location || '',
      description: pos.description || '',
      isOpen: pos.isOpen !== false
    });
    setEditId(pos.id);
    setShowForm(true);
  };

  const handleDelete = (pos) => {
    Alert.alert(t('adminJobPositions.deletePosition'), t('adminJobPositions.deletePositionConfirm', { title: pos.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('adminJobPositions.delete'),
        style: 'destructive',
        onPress: () => {
          const updated = positions.filter(p => p.id !== pos.id);
          setPositions(updated);
          savePositions(updated);
        }
      }
    ]);
  };

  const handleToggleOpen = (pos) => {
    const updated = positions.map(p => p.id === pos.id ? { ...p, isOpen: !p.isOpen } : p);
    setPositions(updated);
    savePositions(updated);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={theme.colors.primary} />}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Eyebrow>{t('adminJobPositions.adminPanel')}</Eyebrow>
          <View style={s.titleRow}>
            <LinearGradient colors={[G(0.14), T(0.09)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titleIconBox}>
              <Ionicons name="briefcase-outline" size={18} color={theme.colors.primary} />
            </LinearGradient>
            <Text style={s.heading}>{t('adminJobPositions.jobPositions')}</Text>
          </View>
          <Text style={s.sub}>{t('adminJobPositions.manageOpenPositions')}</Text>
          <SpectrumLine style={{ marginTop: 14 }} />
        </View>

        {/* ── Add button ──────────────────────────────────── */}
        <TouchableOpacity onPress={openCreate} activeOpacity={0.8} style={s.addBtnOuter}>
          <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtnGradient}>
            <Ionicons name="add" size={16} color={theme.colors.ink} />
            <Text style={s.addBtnText}>{t('adminJobPositions.addPosition')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Empty state ──────────────────────────────── */}
        {positions.length === 0 ? (
          <View style={s.emptyWrap}>
            <LinearGradient colors={[G(0.44), T(0.30)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIconRingOuter}>
              <View style={s.emptyIconRingInner}>
                <Ionicons name="briefcase-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
            <Text style={s.emptyTitle}>{t('adminJobPositions.noPositionsYet')}</Text>
            <Text style={s.emptyBody}>{t('adminJobPositions.createFirstPosition')}</Text>
          </View>
        ) : (
          /* ── Positions list ──────────────────────────────── */
          positions.map((pos) => (
            <View key={pos.id} style={s.positionCard}>
              <PrismTopLine />
              <PrismLeftBar />
              <LinearGradient
                colors={[G(0.05), 'transparent', T(0.03)]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={s.positionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.positionTitle}>{pos.title}</Text>
                  <View style={s.positionMeta}>
                    <Text style={s.positionMetaText}>{pos.department || t('adminJobPositions.noDepartment')}</Text>
                    <Text style={s.positionMetaDot}>·</Text>
                    <Text style={s.positionMetaText}>{pos.type}</Text>
                  </View>
                  {pos.location && <Text style={s.positionLocation}>{pos.location}</Text>}
                </View>
                <TouchableOpacity
                  style={[s.toggleBtn, pos.isOpen ? s.toggleOpen : s.toggleClosed]}
                  onPress={() => handleToggleOpen(pos)}
                >
                  <Text style={[s.toggleText, pos.isOpen ? s.toggleTextOpen : s.toggleTextClosed]}>
                    {pos.isOpen ? t('adminJobPositions.open') : t('adminJobPositions.closed')}
                  </Text>
                </TouchableOpacity>
              </View>
              {pos.description && (
                <Text style={s.positionDesc} numberOfLines={3}>{pos.description}</Text>
              )}
              <View style={s.positionActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => handleEdit(pos)}>
                  <Ionicons name="pencil-outline" size={14} color={theme.colors.primary} />
                  <Text style={s.actionBtnText}>{t('adminJobPositions.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtnDanger} onPress={() => handleDelete(pos)}>
                  <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
                  <Text style={s.actionBtnTextDanger}>{t('adminJobPositions.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ════════════════ FORM MODAL ════════════════════════ */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <PrismTopLine />
            <View style={m.handle} />
            <View style={m.header}>
              <View style={{ flex: 1 }}>
                <Text style={m.eyebrow}>{editId !== null ? t('adminJobPositions.edit') : t('adminJobPositions.new')}</Text>
                <Text style={m.title}>{editId !== null ? t('adminJobPositions.editPosition') : t('adminJobPositions.addPosition')}</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setShowForm(false)} activeOpacity={0.75}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SpectrumLine />

            <ScrollView style={m.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={m.fieldLabel}>{t('adminJobPositions.positionTitleRequiredLabel')}</Text>
              <TextInput
                style={m.input}
                value={form.title}
                onChangeText={(v) => setForm(p => ({ ...p, title: v }))}
                placeholder={t('adminJobPositions.positionTitlePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={m.fieldLabel}>{t('adminJobPositions.department')}</Text>
              <View style={m.chipRow}>
                {DEPARTMENTS.map(dept => (
                  <TouchableOpacity
                    key={dept}
                    style={[m.chip, form.department === dept && m.chipActive]}
                    onPress={() => setForm(p => ({ ...p, department: dept }))}
                  >
                    <Text style={[m.chipText, form.department === dept && m.chipTextActive]}>{dept}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={m.fieldLabel}>{t('adminJobPositions.jobType')}</Text>
              <View style={m.chipRow}>
                {JOB_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[m.chip, form.type === type && m.chipActive]}
                    onPress={() => setForm(p => ({ ...p, type }))}
                  >
                    <Text style={[m.chipText, form.type === type && m.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={m.fieldLabel}>{t('adminJobPositions.location')}</Text>
              <TextInput
                style={m.input}
                value={form.location}
                onChangeText={(v) => setForm(p => ({ ...p, location: v }))}
                placeholder={t('adminJobPositions.locationPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={m.fieldLabel}>{t('adminJobPositions.description')}</Text>
              <TextInput
                style={[m.input, m.textArea]}
                value={form.description}
                onChangeText={(v) => setForm(p => ({ ...p, description: v }))}
                placeholder={t('adminJobPositions.descriptionPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
              />
            </ScrollView>

            <View style={m.actions}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowForm(false)} disabled={!!error} activeOpacity={0.75}>
                <Text style={m.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <View style={[m.saveBtnWrap, !!error && m.saveBtnDisabled]}>
                <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                <TouchableOpacity style={m.saveBtnTouch} onPress={handleSubmit} activeOpacity={0.85}>
                  <Ionicons name="checkmark-done" size={15} color={theme.colors.ink} />
                  <Text style={m.saveBtnText}>{editId !== null ? t('adminJobPositions.saveChanges') : t('adminJobPositions.addPosition')}</Text>
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

  addBtnOuter: { marginBottom: 14, borderRadius: 14, overflow: 'hidden' },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  addBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 20, backgroundColor: 'rgba(19,27,37,0.8)', gap: 12 },
  emptyIconRingOuter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyIconRingInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(19,27,37,0.9)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  emptyBody: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  positionCard: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 14, marginBottom: 12, overflow: 'hidden' },
  positionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  positionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  positionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  positionMetaText: { color: theme.colors.textMuted, fontSize: 12 },
  positionMetaDot: { color: theme.colors.textMuted, fontSize: 12 },
  positionLocation: { color: theme.colors.primary, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  positionDesc: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  positionActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: G(0.25), backgroundColor: G(0.08) },
  actionBtnText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  actionBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(127,29,29,0.2)' },
  actionBtnTextDanger: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  toggleOpen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  toggleClosed: { backgroundColor: 'rgba(148,163,184,0.15)' },
  toggleText: { fontSize: 11, fontWeight: '800' },
  toggleTextOpen: { color: '#22c55e' },
  toggleTextClosed: { color: '#94a3b8' },
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

  fieldLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, paddingHorizontal: 13, paddingVertical: 12, color: theme.colors.text, fontSize: 14, marginBottom: 12 },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.colors.ink },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  cancelBtnText: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
  saveBtnWrap: { flex: 2, borderRadius: 13, overflow: 'hidden' },
  saveBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13 },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});