import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTranslation } from 'react-i18next';
import { offersAPI } from '../api/offers';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const DISCOUNT_TYPES = ['Percentage', 'FixedAmount', 'FreeBooking'];
const DISCOUNT_META = {
  Percentage:  { color: theme.colors.primary, labelKey: 'adminOffers.discountTypeLabels.percent', icon: 'trending-down' },
  FixedAmount: { color: '#0EA5A0',            labelKey: 'adminOffers.discountTypeLabels.fixed',   icon: 'cash-outline'  },
  FreeBooking: { color: '#22c55e',            labelKey: 'adminOffers.discountTypeLabels.free',    icon: 'gift-outline'  },
};

const BLANK_FORM = {
  name: '', code: '', discountType: 'Percentage',
  discountValue: '', maxUsages: '', isActive: true,
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

export default function AdminOffersScreen() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  const fmtValue = (type, value) => {
    if (type === 'FreeBooking') return t('adminOffers.freeBooking');
    if (type === 'Percentage') return t('adminOffers.percentageValue', { value });
    return t('adminOffers.qarValue', { value });
  };

  const [offers,    setOffers]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(BLANK_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      setOffers(await offersAPI.getAll());
    } catch {
      Alert.alert(t('common.error'), t('adminOffers.failedLoadOffers'));
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

  const openEdit = (offer) => {
    setEditing(offer);
    setForm({
      name: offer.name,
      code: offer.code || '',
      discountType: offer.discountType,
      discountValue: offer.discountType === 'FreeBooking' ? '' : String(offer.discountValue ?? ''),
      maxUsages: offer.maxUsages != null ? String(offer.maxUsages) : '',
      isActive: offer.isActive ?? true,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const { name, discountType, discountValue, maxUsages } = form;
    if (!name.trim()) { Alert.alert(t('adminOffers.validationTitle'), t('adminOffers.nameRequired')); return; }
    if (discountType !== 'FreeBooking') {
      const v = parseFloat(discountValue);
      if (isNaN(v) || v <= 0) { Alert.alert(t('adminOffers.validationTitle'), t('adminOffers.discountValuePositive')); return; }
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: form.code.trim() || null,
        discountType,
        discountValue: discountType === 'FreeBooking' ? 0 : parseFloat(discountValue),
        maxUsages: maxUsages.trim() ? parseInt(maxUsages, 10) : null,
        isActive: form.isActive,
      };
      if (editing) {
        await offersAPI.update(editing.id, payload);
      } else {
        await offersAPI.create(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminOffers.failedSaveOffer'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (offer) => {
    Alert.alert(t('adminOffers.deleteOffer'), t('adminOffers.deleteOfferConfirm', { name: offer.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('adminOffers.delete'), style: 'destructive',
        onPress: async () => {
          try { await offersAPI.delete(offer.id); load(); }
          catch { Alert.alert(t('common.error'), t('adminOffers.failedDeleteOffer')); }
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
            <Ionicons name="ticket" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>{t('adminOffers.offersDiscounts')}</Text>
            <Text style={s.pageSubtitle}>{t('adminOffers.totalOffers', { count: offers.length })}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <SpectrumLine style={{ marginBottom: 20 }} />

        {offers.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="ticket-outline" size={42} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>{t('adminOffers.noOffersYet')}</Text>
          </View>
        ) : (
          offers.map((offer) => {
            const meta = DISCOUNT_META[offer.discountType] || DISCOUNT_META.Percentage;
            return (
              <View key={offer.id} style={s.card}>
                <PrismLeftBar color={meta.color} />
                <View style={s.cardPad}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{offer.name}</Text>
                      <View style={s.tagRow}>
                        <View style={[s.tag, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40` }]}>
                          <Ionicons name={meta.icon} size={11} color={meta.color} />
                          <Text style={[s.tagText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
                        </View>
                        <View style={[s.tag, { backgroundColor: G(0.10), borderColor: G(0.22) }]}>
                          <Text style={[s.tagText, { color: theme.colors.primary }]}>
                            {fmtValue(offer.discountType, offer.discountValue)}
                          </Text>
                        </View>
                        {!offer.isActive && (
                          <View style={[s.tag, { backgroundColor: theme.colors.warningBg, borderColor: theme.colors.warningBorder }]}>
                            <Text style={[s.tagText, { color: theme.colors.warning }]}>{t('adminOffers.inactive')}</Text>
                          </View>
                        )}
                      </View>
                      {!!offer.code && (
                        <View style={s.codeRow}>
                          <Ionicons name="barcode-outline" size={12} color={theme.colors.textMuted} />
                          <Text style={s.codeText}>{offer.code}</Text>
                        </View>
                      )}
                      {offer.maxUsages != null && (
                        <Text style={s.usageText}>
                          {t('adminOffers.usesSummary', { used: offer.usageCount ?? 0, max: offer.maxUsages })}
                        </Text>
                      )}
                    </View>
                    <View style={s.cardActions}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(offer)} activeOpacity={0.7}>
                        <Ionicons name="pencil" size={15} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(offer)} activeOpacity={0.7}>
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
                <Text style={s.sheetTitle}>{editing ? t('adminOffers.editOffer') : t('adminOffers.newOffer')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <SpectrumLine style={{ marginBottom: 18 }} />

              <Text style={s.fieldLabel}>{t('adminOffers.offerNameRequiredLabel')}</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={t('adminOffers.offerNamePlaceholder')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminOffers.couponCodeOptional')}</Text>
              <TextInput style={s.input} value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} placeholder={t('adminOffers.couponCodePlaceholder')} placeholderTextColor={theme.colors.textMuted} autoCapitalize="characters" />

              {/* Discount type */}
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminOffers.discountType')}</Text>
              <View style={s.typeRow}>
                {DISCOUNT_TYPES.map((discountType) => {
                  const meta = DISCOUNT_META[discountType];
                  const active = form.discountType === discountType;
                  return (
                    <TouchableOpacity
                      key={discountType}
                      style={[s.typeChip, active && { backgroundColor: `${meta.color}22`, borderColor: meta.color }]}
                      onPress={() => setForm((f) => ({ ...f, discountType }))}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={meta.icon} size={13} color={active ? meta.color : theme.colors.textMuted} />
                      <Text style={[s.typeText, active && { color: meta.color }]}>{t(meta.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.discountType !== 'FreeBooking' && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 12 }]}>
                    {form.discountType === 'Percentage' ? t('adminOffers.percentageRequiredLabel') : t('adminOffers.amountQarRequiredLabel')}
                  </Text>
                  <TextInput
                    style={s.input}
                    value={form.discountValue}
                    onChangeText={(v) => setForm((f) => ({ ...f, discountValue: v }))}
                    placeholder={form.discountType === 'Percentage' ? t('adminOffers.percentagePlaceholder') : t('adminOffers.amountPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminOffers.maxUsagesOptional')}</Text>
              <TextInput style={s.input} value={form.maxUsages} onChangeText={(v) => setForm((f) => ({ ...f, maxUsages: v }))} placeholder={t('adminOffers.maxUsagesPlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardType="number-pad" />

              <View style={[s.sheetActions, { marginTop: 20 }]}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.75} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.ink} size="small" /> : <Text style={s.saveBtnText}>{editing ? t('adminOffers.update') : t('adminOffers.create')}</Text>}
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
  cardPad:  { padding: 16, paddingLeft: 20 },
  cardRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tagRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  tag: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, borderWidth: 1,
  },
  tagText:  { fontSize: 11, fontWeight: '700' },
  codeRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  codeText: { color: theme.colors.textMuted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  usageText:{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  cardActions: { gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
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
    padding: 24, maxHeight: '90%',
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
  typeRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  typeChip: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
  },
  typeText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },

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
