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
import { servicesAPI } from '../api/services';
import { productsAPI } from '../api/products';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const BLANK_FORM = { name: '', description: '', defaultDurationMinutes: '', serviceProducts: [] };

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
    colors={color === 'teal' ? [T(0.90), T(0.45), 'transparent'] : [G(0.90), G(0.45), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 }}
    pointerEvents="none"
  />
);

export default function AdminServicesScreen() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  const [services,   setServices]   = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  // product picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerIdx,     setPickerIdx]     = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [svc, prod] = await Promise.all([servicesAPI.getAll(), productsAPI.getAll()]);
      setServices(svc);
      setProducts(prod);
    } catch {
      Alert.alert(t('common.error'), t('adminServices.failedLoadData'));
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

  const openEdit = (svc) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      description: svc.description || '',
      defaultDurationMinutes: String(svc.defaultDurationMinutes),
      serviceProducts: (svc.products || []).map((p) => ({
        productId: String(p.productId),
        quantityUsed: String(p.quantityUsed),
      })),
    });
    setModalVisible(true);
  };

  const addServiceProduct = () =>
    setForm((f) => ({ ...f, serviceProducts: [...f.serviceProducts, { productId: '', quantityUsed: '' }] }));

  const removeServiceProduct = (idx) =>
    setForm((f) => ({ ...f, serviceProducts: f.serviceProducts.filter((_, i) => i !== idx) }));

  const updateServiceProduct = (idx, field, value) =>
    setForm((f) => {
      const arr = [...f.serviceProducts];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...f, serviceProducts: arr };
    });

  const handleSave = async () => {
    const { name, defaultDurationMinutes, serviceProducts } = form;
    if (!name.trim() || !defaultDurationMinutes.trim()) {
      Alert.alert(t('adminServices.validationTitle'), t('adminServices.nameDurationRequired'));
      return;
    }
    const dur = parseInt(defaultDurationMinutes, 10);
    if (isNaN(dur) || dur <= 0) {
      Alert.alert(t('adminServices.validationTitle'), t('adminServices.durationPositiveInteger'));
      return;
    }
    for (const sp of serviceProducts) {
      if (!sp.productId || !sp.quantityUsed) {
        Alert.alert(t('adminServices.validationTitle'), t('adminServices.fillOrRemoveProductRows'));
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: form.description.trim(),
        defaultDurationMinutes: dur,
        products: serviceProducts.map((sp) => ({
          productId: parseInt(sp.productId, 10),
          quantityUsed: parseFloat(sp.quantityUsed),
        })),
      };
      if (editing) {
        await servicesAPI.update(editing.id, payload);
      } else {
        await servicesAPI.create(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('adminServices.failedSaveService'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(t('adminServices.deleteService'), t('adminServices.deleteServiceConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('adminServices.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await servicesAPI.delete(item.id);
            load();
          } catch {
            Alert.alert(t('common.error'), t('adminServices.failedDeleteService'));
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

  const selectedProductId = pickerIdx !== null ? form.serviceProducts[pickerIdx]?.productId : null;

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.pageHeader}>
          <View style={s.pageIconBox}>
            <Ionicons name="construct" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>{t('adminServices.services')}</Text>
            <Text style={s.pageSubtitle}>{t('adminServices.totalServices', { count: services.length })}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <SpectrumLine style={{ marginBottom: 20 }} />

        {services.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="construct-outline" size={42} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>{t('adminServices.noServicesYet')}</Text>
          </View>
        ) : (
          services.map((svc) => (
            <View key={svc.id} style={s.card}>
              <PrismLeftBar color="teal" />
              <View style={s.cardPad}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{svc.name}</Text>
                    <View style={s.tagRow}>
                      <View style={[s.tag, { backgroundColor: T(0.10), borderColor: T(0.22) }]}>
                        <Ionicons name="time-outline" size={11} color="#0EA5A0" />
                        <Text style={[s.tagText, { color: '#0EA5A0' }]}>{t('bookingFlow.common.minutesShort', { count: svc.defaultDurationMinutes })}</Text>
                      </View>
                      <View style={[s.tag, { backgroundColor: G(0.10), borderColor: G(0.22) }]}>
                        <Text style={[s.tagText, { color: theme.colors.primary }]}>
                          {t('adminServices.totalProducts', { count: (svc.products || []).length })}
                        </Text>
                      </View>
                    </View>
                    {!!svc.description && <Text style={s.desc} numberOfLines={2}>{svc.description}</Text>}
                  </View>
                  <View style={s.cardActions}>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(svc)} activeOpacity={0.7}>
                      <Ionicons name="pencil" size={15} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(svc)} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {(svc.products || []).length > 0 && (
                  <>
                    <SpectrumLine style={{ marginVertical: 10 }} />
                    {(svc.products || []).map((sp, i) => (
                      <View key={i} style={s.spRow}>
                        <Text style={s.spName}>{sp.productName}</Text>
                        <Text style={s.spQty}>{sp.quantityUsed} {sp.unit}</Text>
                      </View>
                    ))}
                  </>
                )}

                {svc.estimatedCost != null && (
                  <View style={s.costRow}>
                    <Text style={s.costLabel}>{t('adminServices.estimatedCost')}</Text>
                    <Text style={s.costValue}>{formatQAR(svc.estimatedCost)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
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
                <Text style={s.sheetTitle}>{editing ? t('adminServices.editService') : t('adminServices.newService')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <SpectrumLine style={{ marginBottom: 18 }} />

              <Text style={s.fieldLabel}>{t('adminServices.serviceNameRequiredLabel')}</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={t('adminServices.serviceNamePlaceholder')} placeholderTextColor={theme.colors.textMuted} />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminServices.durationMinutesRequiredLabel')}</Text>
              <TextInput style={s.input} value={form.defaultDurationMinutes} onChangeText={(v) => setForm((f) => ({ ...f, defaultDurationMinutes: v }))} placeholder="30" placeholderTextColor={theme.colors.textMuted} keyboardType="number-pad" />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>{t('adminServices.description')}</Text>
              <TextInput style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder={t('adminServices.serviceDescriptionPlaceholder')} placeholderTextColor={theme.colors.textMuted} multiline />

              {/* Products */}
              <View style={s.sectionRow}>
                <Text style={s.sectionLabel}>{t('adminServices.productsUsed', { count: form.serviceProducts.length })}</Text>
                <TouchableOpacity style={s.smallAddBtn} onPress={addServiceProduct} activeOpacity={0.75}>
                  <Ionicons name="add" size={14} color={theme.colors.ink} />
                  <Text style={s.smallAddText}>{t('adminServices.add')}</Text>
                </TouchableOpacity>
              </View>

              {form.serviceProducts.map((sp, idx) => (
                <View key={idx} style={s.spFormRow}>
                  <TouchableOpacity
                    style={[s.input, s.productPicker, { flex: 1 }]}
                    onPress={() => { setPickerIdx(idx); setPickerVisible(true); }}
                    activeOpacity={0.75}
                  >
                    <Text style={sp.productId ? s.pickerText : s.pickerPlaceholder} numberOfLines={1}>
                      {sp.productId ? (products.find((p) => String(p.id) === sp.productId)?.name || t('adminServices.unknown')) : t('adminServices.selectProduct')}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TextInput
                    style={[s.input, { width: 72 }]}
                    value={sp.quantityUsed}
                    onChangeText={(v) => updateServiceProduct(idx, 'quantityUsed', v)}
                    placeholder={t('adminServices.qty')}
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity style={s.removeBtn} onPress={() => removeServiceProduct(idx)} activeOpacity={0.7}>
                    <Ionicons name="close" size={14} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={[s.sheetActions, { marginTop: 20 }]}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.75} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.ink} size="small" /> : <Text style={s.saveBtnText}>{editing ? t('adminServices.update') : t('adminServices.create')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Product picker */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t('adminServices.selectProduct')}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SpectrumLine style={{ marginBottom: 12 }} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {products.map((p) => {
                const isSelected = String(p.id) === selectedProductId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.pickerItem, isSelected && s.pickerItemActive]}
                    onPress={() => {
                      if (pickerIdx !== null) updateServiceProduct(pickerIdx, 'productId', String(p.id));
                      setPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pickerItemText, isSelected && { color: theme.colors.primary }]}>{p.name}</Text>
                    <Text style={s.pickerItemSub}>{formatQAR(p.costPerUnit)}/{p.unit}</Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: theme.colors.bg },
  content:  { paddingHorizontal: 20, paddingBottom: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },

  pageHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
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
    marginBottom: 14, overflow: 'hidden',
  },
  cardPad:     { padding: 16, paddingLeft: 20 },
  cardRow:     { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:   { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tagRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  tag: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  tagText:    { fontSize: 11, fontWeight: '700' },
  desc:       { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  cardActions:{ gap: 8 },
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
  spRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  spName:  { color: theme.colors.text, fontSize: 12 },
  spQty:   { color: '#0EA5A0', fontSize: 12, fontWeight: '700' },
  costRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.md,
    backgroundColor: G(0.06), borderWidth: 1, borderColor: G(0.18),
  },
  costLabel: { color: theme.colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  costValue: { color: theme.colors.primary, fontSize: 15, fontWeight: '800' },

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

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  sectionLabel: { color: theme.colors.mist, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  smallAddBtn: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  smallAddText: { color: theme.colors.ink, fontSize: 12, fontWeight: '700' },
  spFormRow:    { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  productPicker:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11,
  },
  pickerText:        { color: theme.colors.text, fontSize: 14, flex: 1 },
  pickerPlaceholder: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  removeBtn: {
    width: 34, height: 44, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dangerBg, borderWidth: 1, borderColor: theme.colors.dangerBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderColor: theme.colors.border,
  },
  pickerItemActive: { backgroundColor: theme.colors.primaryBg },
  pickerItemText:   { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  pickerItemSub:    { color: theme.colors.textMuted, fontSize: 12 },

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
