import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { subscriptionsAPI } from '../api/subscriptions';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const BILLING_CYCLES = ['Monthly', 'Quarterly'];
const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];

const BLANK_FORM = {
  name: '',
  vehicleType: 'Sedan',
  billingCycle: 'Monthly',
  price: '',
  discountPercent: '',
  isPopular: false,
  isActive: true,
  featuresText: '',
  benefitsText: '',
};

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismLeftBar = ({ color }) => (
  <LinearGradient
    colors={[`${color}ee`, `${color}55`, 'transparent']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={s.prismLeftBar}
    pointerEvents="none"
  />
);

export default function AdminSubscriptionsScreen() {
  const headerHeight = useHeaderHeight();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      setPlans(await subscriptionsAPI.getAll());
    } catch {
      Alert.alert('Error', 'Failed to load subscription plans');
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

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      vehicleType: plan.vehicleType || 'Sedan',
      billingCycle: plan.billingCycle || 'Monthly',
      price: String(plan.price ?? ''),
      discountPercent: String(plan.discountPercent ?? ''),
      isPopular: !!plan.isPopular,
      isActive: plan.isActive !== false,
      featuresText: (plan.features || []).map((item) => item.featureText).join('\n'),
      benefitsText: (plan.benefits || []).map((item) => item.benefitText).join('\n'),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert('Validation', 'Plan name and price are required');
      return;
    }

    const parsedPrice = parseFloat(form.price);
    const parsedDiscount = form.discountPercent.trim() ? parseFloat(form.discountPercent) : 0;
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Validation', 'Price must be a valid number');
      return;
    }
    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      Alert.alert('Validation', 'Discount must be between 0 and 100');
      return;
    }

    const payload = {
      name: form.name.trim(),
      vehicleType: form.vehicleType,
      billingCycle: form.billingCycle,
      price: parsedPrice,
      discountPercent: parsedDiscount,
      isPopular: form.isPopular,
      isActive: form.isActive,
      features: form.featuresText.split('\n').map((item) => item.trim()).filter(Boolean),
      benefits: form.benefitsText.split('\n').map((item) => item.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (editing) {
        await subscriptionsAPI.update(editing.id, payload);
      } else {
        await subscriptionsAPI.create(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan) => {
    try {
      await subscriptionsAPI.update(plan.id, {
        name: plan.name,
        vehicleType: plan.vehicleType,
        billingCycle: plan.billingCycle,
        price: plan.price,
        discountPercent: plan.discountPercent ?? 0,
        isPopular: !!plan.isPopular,
        isActive: !plan.isActive,
        features: (plan.features || []).map((item) => item.featureText),
        benefits: (plan.benefits || []).map((item) => item.benefitText),
      });
      load();
    } catch {
      Alert.alert('Error', 'Failed to update plan status');
    }
  };

  const handleDelete = (plan) => {
    Alert.alert('Delete Plan', `Delete "${plan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await subscriptionsAPI.delete(plan.id);
            load();
          } catch {
            Alert.alert('Error', 'Failed to delete plan');
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
            <Ionicons name="repeat" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Subscriptions</Text>
            <Text style={s.pageSubtitle}>{plans.filter((plan) => plan.isActive).length} active · {plans.length} total</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <SpectrumLine style={{ marginBottom: 20 }} />

        {plans.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="repeat-outline" size={42} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>No subscription plans yet. Tap + to add one.</Text>
          </View>
        ) : (
          plans.map((plan) => {
            const accent = plan.billingCycle === 'Quarterly' ? theme.colors.primary : '#60A5FA';
            return (
              <View key={plan.id} style={[s.card, !plan.isActive && s.cardInactive]}>
                <PrismLeftBar color={accent} />
                <View style={s.cardPad}>
                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{plan.name}</Text>
                      <View style={s.tagRow}>
                        <View style={[s.tag, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
                          <Ionicons name="repeat" size={11} color={accent} />
                          <Text style={[s.tagText, { color: accent }]}>{plan.billingCycle}</Text>
                        </View>
                        <View style={[s.tag, { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primaryBorder }]}>
                          <Ionicons name={plan.vehicleIcon || 'car-outline'} size={11} color={theme.colors.primary} />
                          <Text style={[s.tagText, { color: theme.colors.primary }]}>{plan.vehicleType}</Text>
                        </View>
                        <View style={[s.tag, { backgroundColor: G(0.1), borderColor: G(0.22) }]}>
                          <Text style={[s.tagText, { color: theme.colors.primary }]}>{formatQAR(plan.price)}</Text>
                        </View>
                        {plan.isPopular && (
                          <View style={[s.tag, { backgroundColor: 'rgba(200,169,107,0.12)', borderColor: 'rgba(200,169,107,0.22)' }]}>
                            <Text style={[s.tagText, { color: theme.colors.primary }]}>Recommended</Text>
                          </View>
                        )}
                        {!plan.isActive && (
                          <View style={[s.tag, { backgroundColor: theme.colors.warningBg, borderColor: theme.colors.warningBorder }]}>
                            <Text style={[s.tagText, { color: theme.colors.warning }]}>Inactive</Text>
                          </View>
                        )}
                      </View>
                      {(plan.features || []).slice(0, 3).map((feature) => (
                        <View key={feature.id} style={s.listRow}>
                          <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} />
                          <Text style={s.desc}>{feature.featureText}</Text>
                        </View>
                      ))}
                      <View style={s.metaRow}>
                        <Text style={s.metaText}>{plan.discountPercent || 0}% off</Text>
                        <Text style={s.metaText}>{plan.subscriberCount || 0} subscribers</Text>
                      </View>
                    </View>
                    <View style={s.cardActions}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(plan)} activeOpacity={0.7}>
                        <Ionicons name="pencil" size={15} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.toggleBtn, {
                          backgroundColor: plan.isActive ? theme.colors.successBg : theme.colors.warningBg,
                          borderColor: plan.isActive ? theme.colors.successBorder : theme.colors.warningBorder,
                        }]}
                        onPress={() => handleToggle(plan)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={plan.isActive ? 'eye' : 'eye-off'} size={15} color={plan.isActive ? theme.colors.success : theme.colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(plan)} activeOpacity={0.7}>
                        <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <ScrollView style={s.sheet} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>{editing ? 'Edit Plan' : 'New Plan'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <SpectrumLine style={{ marginBottom: 18 }} />

              <Text style={s.fieldLabel}>Plan Name *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="e.g. SUV Care Monthly" placeholderTextColor={theme.colors.textMuted} />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Vehicle Type</Text>
              <View style={s.optionRow}>
                {VEHICLE_TYPES.map((item) => {
                  const active = form.vehicleType === item;
                  return (
                    <TouchableOpacity key={item} style={[s.optionChip, active && s.optionChipActive]} onPress={() => setForm((current) => ({ ...current, vehicleType: item }))} activeOpacity={0.75}>
                      <Text style={[s.optionText, active && s.optionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Billing Cycle</Text>
              <View style={s.optionRow}>
                {BILLING_CYCLES.map((item) => {
                  const active = form.billingCycle === item;
                  return (
                    <TouchableOpacity key={item} style={[s.optionChip, active && s.optionChipActive]} onPress={() => setForm((current) => ({ ...current, billingCycle: item }))} activeOpacity={0.75}>
                      <Text style={[s.optionText, active && s.optionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Price (QAR) *</Text>
              <TextInput style={s.input} value={form.price} onChangeText={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="0.00" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Discount %</Text>
              <TextInput style={s.input} value={form.discountPercent} onChangeText={(value) => setForm((current) => ({ ...current, discountPercent: value }))} placeholder="e.g. 10" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Features</Text>
              <TextInput style={[s.input, s.multiInput]} value={form.featuresText} onChangeText={(value) => setForm((current) => ({ ...current, featuresText: value }))} placeholder="One feature per line" placeholderTextColor={theme.colors.textMuted} multiline />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Benefits</Text>
              <TextInput style={[s.input, s.multiInput]} value={form.benefitsText} onChangeText={(value) => setForm((current) => ({ ...current, benefitsText: value }))} placeholder="One benefit per line" placeholderTextColor={theme.colors.textMuted} multiline />

              <TouchableOpacity style={s.toggleRow} onPress={() => setForm((current) => ({ ...current, isPopular: !current.isPopular }))} activeOpacity={0.8}>
                <Text style={s.toggleLabel}>Highlight as recommended</Text>
                <Ionicons name={form.isPopular ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={form.isPopular ? theme.colors.primary : theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={s.toggleRow} onPress={() => setForm((current) => ({ ...current, isActive: !current.isActive }))} activeOpacity={0.8}>
                <Text style={s.toggleLabel}>Plan is active</Text>
                <Ionicons name={form.isActive ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={form.isActive ? theme.colors.primary : theme.colors.textMuted} />
              </TouchableOpacity>

              <View style={[s.sheetActions, { marginTop: 20 }]}>
                <TouchableOpacity style={s.cancelActionBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                  <Text style={s.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.75} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.ink} size="small" /> : <Text style={s.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>}
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
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageIconBox: {
    width: 42, height: 42, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  pageSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 38, height: 38, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.card.bg, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12, overflow: 'hidden',
  },
  cardInactive: { opacity: 0.65 },
  prismLeftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
  cardPad: { padding: 16, paddingLeft: 20 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  tag: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  desc: { color: theme.colors.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4 },
  metaText: { color: theme.colors.textMuted, fontSize: 11 },
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
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
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
  sheetTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: theme.colors.mist, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 11,
    color: theme.colors.text, fontSize: 14,
  },
  multiInput: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border,
  },
  optionChipActive: { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primary },
  optionText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  optionTextActive: { color: theme.colors.primary },
  toggleRow: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.inputBg, paddingHorizontal: 14, paddingVertical: 12,
  },
  toggleLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 12 },
  cancelActionBtn: {
    flex: 1, paddingVertical: 13, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
  },
  cancelActionText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1, paddingVertical: 13, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary, alignItems: 'center',
  },
  saveBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});