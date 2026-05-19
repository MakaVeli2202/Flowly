import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { subscriptionsAPI } from '../api/subscriptions';
import { vehiclesAPI } from '../api/vehicles';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const VEHICLE_OPTIONS = [
  { value: 'Motorcycle', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'Sedan', label: 'Sedan', icon: 'car-outline' },
  { value: 'SUV', label: 'SUV', icon: 'car-sport-outline' },
  { value: 'Pickup', label: 'Pickup', icon: 'car-outline' },
];

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.9), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={s.prismLeftBar}
    pointerEvents="none"
  />
);

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadCurrentSubscription = useCallback(async () => {
    return await subscriptionsAPI.getMySubscription().catch(() => null);
  }, []);

  const loadPlans = useCallback(async (nextVehicleType) => {
    return await subscriptionsAPI.getPlans(nextVehicleType).catch(() => []);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [vehicles, currentSubscription] = await Promise.all([
        vehiclesAPI.getAll().catch(() => []),
        loadCurrentSubscription(),
      ]);

      const defaultVehicle = (vehicles || []).find((item) => item.isDefault) || vehicles?.[0];
      const nextVehicleType = currentSubscription?.vehicleType || defaultVehicle?.vehicleType || vehicleType;
      const planData = await loadPlans(nextVehicleType);

      setVehicleType(nextVehicleType);
      setMySubscription(currentSubscription || null);
      setPlans(planData || []);
    } catch {
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCurrentSubscription, loadPlans, vehicleType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    loadPlans(vehicleType)
      .then((data) => { if (!cancelled) setPlans(data || []); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [loadPlans, vehicleType]);

  const handleSubscribe = async (planId) => {
    const plan = plans.find(p => p.id === planId) || null;
    if (!plan) return;
    navigation.navigate('SubscriptionCheckout', { plan });
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      await subscriptionsAPI.unsubscribe();
      await load(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { paddingTop: headerHeight }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.pageHeader}>
        <View style={s.pageIconBox}>
          <Ionicons name="repeat" size={20} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>Subscriptions</Text>
          <Text style={s.pageSubtitle}>Plans filtered for {vehicleType}</Text>
        </View>
      </View>

      <SpectrumLine style={{ marginBottom: 18 }} />

      <View style={s.vehicleRow}>
        {VEHICLE_OPTIONS.map((option) => {
          const active = vehicleType === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[s.vehicleChip, active && s.vehicleChipActive]}
              onPress={() => setVehicleType(option.value)}
              activeOpacity={0.75}
            >
              <Ionicons name={option.icon} size={14} color={active ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={[s.vehicleChipText, active && s.vehicleChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.currentCard}>
        <PrismLeftBar />
        <Text style={s.currentEyebrow}>Current subscription</Text>
        {mySubscription ? (
          <>
            <Text style={s.currentTitle}>{mySubscription.planName}</Text>
            <Text style={s.currentMeta}>
              {mySubscription.vehicleType} · {mySubscription.billingCycle} · {formatQAR(mySubscription.price)}
            </Text>
            <Text style={s.currentBody}>{mySubscription.discountPercent}% discount applies to eligible bookings for this vehicle type.</Text>
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} disabled={cancelling} activeOpacity={0.8}>
              {cancelling ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Text style={s.cancelBtnText}>Cancel Subscription</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.currentTitle}>No active plan</Text>
            <Text style={s.currentBody}>Choose a plan below. It only affects booking visibility by vehicle type and pricing discounts.</Text>
          </>
        )}
      </View>

      {plans.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="repeat-outline" size={40} color={theme.colors.textMuted} />
          <Text style={s.emptyText}>No plans available for {vehicleType} yet.</Text>
        </View>
      ) : (
        plans.map((plan) => {
          const isCurrent = mySubscription?.planId === plan.id && mySubscription?.isActive;
          return (
            <View key={plan.id} style={[s.card, !plan.isActive && s.cardInactive]}>
              <PrismLeftBar />
              <View style={s.cardBody}>
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{plan.name}</Text>
                    <View style={s.tagRow}>
                      <View style={s.tag}>
                        <Ionicons name={plan.vehicleIcon || 'car-outline'} size={11} color={theme.colors.primary} />
                        <Text style={s.tagText}>{plan.vehicleType}</Text>
                      </View>
                      <View style={s.tag}>
                        <Ionicons name="repeat" size={11} color={theme.colors.primary} />
                        <Text style={s.tagText}>{plan.billingCycle}</Text>
                      </View>
                      {plan.isPopular && (
                        <View style={[s.tag, s.tagPopular]}>
                          <Text style={[s.tagText, { color: theme.colors.primary }]}>Recommended</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.cardPrice}>{formatQAR(plan.price)}</Text>
                    <Text style={s.cardDiscount}>{plan.discountPercent}% off bookings</Text>
                  </View>
                </View>

                {(plan.features || []).map((feature) => (
                  <View key={feature.id} style={s.listRow}>
                    <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} />
                    <Text style={s.listText}>{feature.featureText}</Text>
                  </View>
                ))}

                {(plan.benefits || []).slice(0, 2).map((benefit) => (
                  <View key={benefit.id} style={s.benefitRow}>
                    <Ionicons name="sparkles-outline" size={13} color={theme.colors.textMuted} />
                    <Text style={s.benefitText}>{benefit.benefitText}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  style={[s.subscribeBtn, isCurrent && s.subscribeBtnDisabled]}
                  onPress={() => handleSubscribe(plan.id)}
                  disabled={isCurrent || actionLoadingId === plan.id}
                  activeOpacity={0.85}
                >
                  {actionLoadingId === plan.id ? (
                    <ActivityIndicator size="small" color={theme.colors.ink} />
                  ) : (
                    <Text style={s.subscribeBtnText}>{isCurrent ? 'Current Plan' : 'Choose Plan'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  pageIconBox: {
    width: 42, height: 42, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryBg, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  pageSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBg, paddingHorizontal: 12, paddingVertical: 8,
  },
  vehicleChipActive: { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primaryBg },
  vehicleChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  vehicleChipTextActive: { color: theme.colors.primary },
  currentCard: {
    position: 'relative', overflow: 'hidden', marginBottom: 14,
    backgroundColor: theme.card.bg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, padding: 18, paddingLeft: 22, gap: 8,
  },
  prismLeftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3 },
  currentEyebrow: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  currentTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  currentMeta: { color: theme.colors.textMuted, fontSize: 12 },
  currentBody: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  cancelBtn: {
    alignSelf: 'flex-start', borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.dangerBorder, backgroundColor: theme.colors.dangerBg,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  cancelBtnText: { color: theme.colors.danger, fontSize: 12, fontWeight: '800' },
  emptyBox: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  card: {
    position: 'relative', overflow: 'hidden', marginBottom: 12,
    backgroundColor: theme.card.bg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
  },
  cardInactive: { opacity: 0.6 },
  cardBody: { padding: 16, paddingLeft: 20 },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primaryBg,
  },
  tagPopular: { backgroundColor: 'rgba(200,169,107,0.12)' },
  tagText: { color: theme.colors.text, fontSize: 11, fontWeight: '700' },
  cardPrice: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  cardDiscount: { color: theme.colors.primary, fontSize: 11, fontWeight: '700', marginTop: 3 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  listText: { color: theme.colors.text, flex: 1, fontSize: 13, lineHeight: 18 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  benefitText: { color: theme.colors.textMuted, flex: 1, fontSize: 12, lineHeight: 17 },
  subscribeBtn: {
    marginTop: 10, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  subscribeBtnDisabled: { opacity: 0.55 },
  subscribeBtnText: { color: theme.colors.ink, fontSize: 13, fontWeight: '900' },
});