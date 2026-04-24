import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { productsAPI } from '../api/products';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const BLANK_FORM = { name: '', unit: '', costPerUnit: '' };

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
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

function FieldLabel({ children }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

function FormInput({ label, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput style={s.input} placeholderTextColor={theme.colors.textMuted} {...props} />
    </View>
  );
}

export default function AdminProductsScreen() {
  const headerHeight = useHeaderHeight();

  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(BLANK_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      setProducts(await productsAPI.getAll());
    } catch {
      Alert.alert('Error', 'Failed to load products');
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

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, unit: p.unit, costPerUnit: String(p.costPerUnit) });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const { name, unit, costPerUnit } = form;
    if (!name.trim() || !unit.trim() || !costPerUnit.trim()) {
      Alert.alert('Validation', 'All fields are required');
      return;
    }
    const cost = parseFloat(costPerUnit);
    if (isNaN(cost) || cost < 0) {
      Alert.alert('Validation', 'Cost must be a valid number');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), unit: unit.trim(), costPerUnit: cost };
      if (editing) {
        await productsAPI.update(editing.id, payload);
      } else {
        await productsAPI.create(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Product', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await productsAPI.delete(item.id);
            load();
          } catch {
            Alert.alert('Error', 'Failed to delete product');
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
        {/* Header */}
        <View style={s.pageHeader}>
          <View style={s.pageIconBox}>
            <Ionicons name="cube" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Products</Text>
            <Text style={s.pageSubtitle}>{products.length} product{products.length !== 1 ? 's' : ''} total</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <SpectrumLine style={{ marginBottom: 20 }} />

        {products.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={42} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>No products yet. Tap + to add one.</Text>
          </View>
        ) : (
          products.map((p) => (
            <View key={p.id} style={s.card}>
              <PrismLeftBar />
              <View style={s.cardBody}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{p.name}</Text>
                  <View style={s.tagRow}>
                    <View style={s.tag}>
                      <Text style={s.tagText}>{p.unit}</Text>
                    </View>
                    <View style={[s.tag, { backgroundColor: G(0.10), borderColor: G(0.22) }]}>
                      <Text style={[s.tagText, { color: theme.colors.primary }]}>{formatQAR(p.costPerUnit)}/unit</Text>
                    </View>
                  </View>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)} activeOpacity={0.7}>
                    <Ionicons name="pencil" size={15} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(p)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
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
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>{editing ? 'Edit Product' : 'New Product'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <SpectrumLine style={{ marginBottom: 20 }} />

              <FormInput
                label="Product Name *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Car Shampoo"
              />
              <FormInput
                label="Unit *"
                value={form.unit}
                onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))}
                placeholder="e.g. L, kg, pcs"
              />
              <FormInput
                label="Cost Per Unit (QAR) *"
                value={form.costPerUnit}
                onChangeText={(v) => setForm((f) => ({ ...f, costPerUnit: v }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <View style={s.sheetActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.75} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.ink} size="small" /> : <Text style={s.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
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

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
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
  cardBody:    { flexDirection: 'row', alignItems: 'center', padding: 16, paddingLeft: 20 },
  cardTitle:   { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tagRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full,
    backgroundColor: T(0.10), borderWidth: 1, borderColor: T(0.22),
  },
  tagText:     { color: '#0EA5A0', fontSize: 11, fontWeight: '700' },
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
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border,
    alignSelf: 'center', marginBottom: 18,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle:  { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  fieldWrap:   { marginBottom: 14 },
  fieldLabel:  { color: theme.colors.mist, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 11,
    color: theme.colors.text, fontSize: 14,
  },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
