import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import { packagesAPI } from '../api/packages';
import { servicesAPI } from '../api/services';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const TIERS = ['Standard', 'Gold', 'Platinum', 'Premium'];
const TIER_COLORS = {
  Standard: '#3b82f6',
  Gold:     theme.colors.primary,
  Platinum: '#94a3b8',
  Premium:  '#8b5cf6',
};

const BLANK_FORM = {
  name: '', description: '', price: '', tier: 'Standard',
  isActive: true, serviceIds: [],
};

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismLeftBar = ({ color }) => (
  <LinearGradient
    colors={[`${color}ee`, `${color}55`, 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 }}
    pointerEvents="none"
  />
);

export default function AdminPackagesScreen() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  const [packages,  setPackages]  = useState([]);
  const [services,  setServices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(BLANK_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [pkgs, svcs] = await Promise.all([packagesAPI.getAllAdmin(), servicesAPI.getAll()]);
      setPackages(pkgs);
      setServices(svcs);
    } catch {
      Alert.alert(t('common.error'), t('adminPackages.failedLoadPackages'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setModalVisible(true);
  };

  const openEdit = (pkg) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      price: String(pkg.price),
      tier: pkg.tier || 'Standard',
      isActive: pkg.isActive ?? true,
      serviceIds: (pkg.services || []).map((s) => String(s.id ?? s.serviceId)),
    });
    setModalVisible(true);
  };

  const toggleService = (id) => {
    const sid = String(id);
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(sid)
        ? f.serviceIds.filter((x) => x !== sid)
        : [...f.serviceIds, sid],
    }));
  };

  const handleSave = async () => {
    const { name, price, tier } = form;
    if (!name.trim() || !price.trim()) {
      Alert.alert(t('adminPackages.validationTitle'), t('adminPackages.namePriceRequired'));
      return;
    }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) {
      Alert.alert(t('adminPackages.validationTitle'), t('adminPackages.priceMustBeValid'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: form.description.trim(),
        price: p,
        tier,
        isActive: form.isActive,
        serviceIds: form.serviceIds.map(Number),
      };
      if (editing) {
        await packagesAPI.update(editing.id, payload);
      } else {
        await packagesAPI.create(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminPackages.failedSavePackage'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      await packagesAPI.toggleActive(pkg.id);
      load();
    } catch {
      Alert.alert(t('common.error'), t('adminPackages.failedTogglePackageStatus'));
    }
  };

  const handleDelete = (pkg) => {
    Alert.alert(t('adminPackages.deletePackage'), t('adminPackages.deletePackageConfirm', { name: pkg.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('adminPackages.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await packagesAPI.delete(pkg.id);
            load();
          } catch {
            Alert.alert(t('common.error'), t('adminPackages.failedDeletePackage'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.centered, { paddingTop: headerHeight }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.pageHeader}>
          <View style={s.pageIconBox}>
            <Ionicons name="layers" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>{t('adminPackages.packages')}</Text>
            <Text style={s.pageSubtitle}>{t('adminPackages.totalPackages', { count: packages.length })}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <SpectrumLine style={{ marginBottom: 20 }} />

        {packages.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="layers-outline" size={42} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>{t('adminPackages.noPackagesYet')}</Text>
          </View>
        ) : (
          packages.map((pkg) => {
            const tc = TIER_COLORS[pkg.tier] || theme.colors.primary;
            return (
              <View key={pkg.id} style={[s.card, !pkg.isActive && s.cardInactive]}>
                <PrismLeftBar color={tc} />
                <View style={s.cardPad}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <View style={s.titleRow}>
                        <Text style={s.cardTitle}>{pkg.name}</Text>
                        {!pkg.isActive && (
                          <View style={s.inactiveBadge}>
                            <Text style={s.inactiveBadgeText}>{t('adminPackages.inactive')}</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.tagRow}>
                        <View style={[s.tag, { backgroundColor: `${tc}18`, borderColor: `${tc}40` }]}>
                          <Text style={[s.tagText, { color: tc }]}>{pkg.tier}</Text>
                        </View>
                        <View style={[s.tag, { backgroundColor: G(0.10), borderColor: G(0.22) }]}>
                          <Text style={[s.tagText, { color: theme.colors.primary }]}>{formatQAR(pkg.price)}</Text>
                        </View>
                      </View>
                      {!!pkg.description && <Text style={s.desc} numberOfLines={2}>{pkg.description}</Text>}
                      {(pkg.services || []).length > 0 && (
                        <Text style={s.svcCount}>{t('adminPackages.totalServices', { count: (pkg.services || []).length })}</Text>
                      )}
                    </View>
                    <View style={s.cardActions}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(pkg)} activeOpacity={0.7}>
                        <Ionicons name="pencil" size={15} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.toggleBtn, { backgroundColor: pkg.isActive ? theme.colors.successBg : theme.colors.warningBg, borderColor: pkg.isActive ? theme.colors.successBorder : theme.colors.warningBorder }]}
                        onPress={() => handleToggleActive(pkg)} activeOpacity={0.7}
                      >
                        <Ionicons name={pkg.isActive ? 'eye' : 'eye-off'} size={15} color={pkg.isActive ? theme.colors.success : theme.colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(pkg)} activeOpacity={0.7}>
                        <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <ScrollView style={s.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>{editing ? t('adminPackages.editPackage') : t('adminPackages.newPackage')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <SpectrumLine style={{ marginBottom: 18 }} />

              <Text style={s.fieldLabel}>{t('adminPackages.packageNameRequiredLabel')}</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={t('adminPackages.packageNamePlaceholder')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminPackages.priceQarRequiredLabel')}</Text>
              <TextInput style={s.input} value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminPackages.description')}</Text>
              <TextInput style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder={t('adminPackages.packageDescriptionPlaceholder')} placeholderTextColor={theme.colors.textMuted} multiline />

              {/* Tier selector */}
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminPackages.tier')}</Text>
              <View style={s.tierRow}>
                {TIERS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tierChip, form.tier === t && { backgroundColor: `${TIER_COLORS[t]}22`, borderColor: TIER_COLORS[t] }]}
                    onPress={() => setForm((f) => ({ ...f, tier: t }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.tierText, form.tier === t && { color: TIER_COLORS[t] }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Active toggle */}
              <View style={s.activeRow}>
                <Text style={s.fieldLabel}>{t('adminPackages.active')}</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  trackColor={{ false: theme.colors.border, true: G(0.45) }}
                  thumbColor={form.isActive ? theme.colors.primary : theme.colors.textMuted}
                />
              </View>

              {/* Services */}
              <Text style={[s.fieldLabel, { marginTop: 12, marginBottom: 10 }]}>{t('adminPackages.servicesSelected', { count: form.serviceIds.length })}</Text>
              {services.map((svc) => {
                const selected = form.serviceIds.includes(String(svc.id));
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={[s.svcRow, selected && s.svcRowActive]}
                    onPress={() => toggleService(svc.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.checkbox, selected && s.checkboxActive]}>
                      {selected && <Ionicons name="checkmark" size={12} color={theme.colors.ink} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.svcName}>{svc.name}</Text>
                      <Text style={s.svcMeta}>{t('bookingFlow.common.minutesShort', { count: svc.defaultDurationMinutes })}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <View style={[s.sheetActions, { marginTop: 20 }]}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.75} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.ink} size="small" /> : <Text style={s.saveBtnText}>{editing ? t('adminPackages.update') : t('adminPackages.create')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: theme.colors.bg },
  content:  { paddingHorizontal: 20, paddingBottom: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  pageHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageIconBox: {
    width: 42, height: 42, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:    { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  pageSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 38, height: 38, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  card: {
    backgroundColor: theme.card.bg, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 12, overflow: 'hidden',
  },
  cardInactive: { opacity: 0.65 },
  cardPad:  { padding: 16, paddingLeft: 20 },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  inactiveBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warningBg, borderWidth: 1, borderColor: theme.colors.warningBorder,
  },
  inactiveBadgeText: { color: theme.colors.warning, fontSize: 10, fontWeight: '700' },
  tagRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, borderWidth: 1,
  },
  tagText:  { fontSize: 11, fontWeight: '700' },
  desc:     { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  svcCount: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  cardActions: { gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtn: {
    width: 34, height: 34, borderRadius: theme.radius.sm, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dangerBg, borderWidth: 1, borderColor: theme.colors.dangerBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyBox:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '92%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border,
    alignSelf: 'center', marginBottom: 18,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle:  { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  fieldLabel:  { color: theme.colors.mist, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 11,
    color: theme.colors.text, fontSize: 14, marginBottom: 2,
  },
  tierRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  tierChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
  },
  tierText:    { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  activeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  svcRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6,
    backgroundColor: theme.colors.inputBg,
  },
  svcRowActive: { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primaryBorder },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  svcName: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  svcMeta: { color: theme.colors.textMuted, fontSize: 11 },

  sheetActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
  },
  cancelBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1, paddingVertical: 13, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary, alignItems: 'center',
  },
  saveBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});
