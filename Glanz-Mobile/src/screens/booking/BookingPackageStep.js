// ─── BookingPackageStep.js ────────────────────────────────────────────────────
// Sections 1 (Package) + 2 (Vehicle Type & Subscription)
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme/theme';
import { formatQAR } from '../../utils/currency';
import { SectionHeader, Card, FieldLabel, adjustedPrice, s } from './BookingShared';

function BookingPackageStep({
  packages,
  packagesLoading,
  selectedPackages,
  onSelectPackage,
  vehicleTypeOptions,
  form,
  setForm,
  vehicleMultiplier,
  mySubscription,
  subLoading,
  activeSubscription,
  subscriptionMatchesVehicle,
  navigation,
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* ══════════════ 1. PACKAGE ══════════════════════════════ */}
      <Card>
        <SectionHeader icon="cube-outline" step={1}>{t('bookingFlow.packageStep.selectPackage')}</SectionHeader>
        {packagesLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : packages.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={20} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>{t('bookingFlow.packageStep.noPackages')}</Text>
          </View>
        ) : null}
        {packages.map((pkg) => {
          const selected  = selectedPackages.some((x) => x.packageId === pkg.id);
          const basePrice = pkg.price || 0;
          const adjPrice  = adjustedPrice(basePrice, vehicleMultiplier);
          const hasAdjust = vehicleMultiplier !== 1.0;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.pkgRow, selected && s.pkgRowSelected]}
              onPress={() => onSelectPackage(pkg.id)}
              activeOpacity={0.7}
            >
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <View style={s.radioDot} />}
              </View>
              <View style={s.pkgInfo}>
                <Text style={s.pkgName}>{pkg.name}</Text>
                <View style={s.pkgMeta}>
                  <View style={s.tierPill}>
                    <Text style={s.tierPillText}>{pkg.tier}</Text>
                  </View>
                  <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                  <Text style={s.pkgDuration}>{t('bookingFlow.common.minutesShort', { count: pkg.estimatedDurationMinutes })}</Text>
                </View>
              </View>
              <View style={s.priceCol}>
                {hasAdjust && (
                  <Text style={s.pkgPriceStrike}>{formatQAR(basePrice)}</Text>
                )}
                <Text style={s.pkgPrice}>{formatQAR(adjPrice)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* ══════════════ 2. VEHICLE + SUBSCRIPTION ═══════════════ */}
      <Card>
        <SectionHeader icon="car-outline" step={2}>{t('bookingFlow.packageStep.vehicleServiceType')}</SectionHeader>

        <FieldLabel>{t('bookingFlow.packageStep.vehicleType')}</FieldLabel>
        <View style={s.vehicleGrid}>
          {vehicleTypeOptions.map((opt) => {
            const active = form.vehicleType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.vehicleBtn, active && s.vehicleBtnActive]}
                onPress={() => setForm((p) => ({ ...p, vehicleType: opt.value }))}
                activeOpacity={0.7}
              >
                <Text style={[s.vehicleBtnLabel, active && s.vehicleBtnLabelActive]}>
                  {opt.label}
                </Text>
                <View style={[s.vehicleBadge, {
                  backgroundColor: opt.badgeColor.bg,
                  borderColor: opt.badgeColor.border,
                }]}>
                  <Text style={[s.vehicleBadgeText, { color: opt.badgeColor.text }]}>
                    {opt.badge}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <FieldLabel>{t('bookingFlow.packageStep.subscription')}</FieldLabel>
        <View style={s.subscriptionPanel}>
          {subLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : activeSubscription ? (
            <>
              <View style={s.subscriptionPanelHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subscriptionPanelTitle}>{activeSubscription.planName}</Text>
                  <Text style={s.subscriptionPanelMeta}>
                    {activeSubscription.vehicleType} · {activeSubscription.billingCycle} · {formatQAR(activeSubscription.price)}
                  </Text>
                </View>
                <TouchableOpacity style={s.subscriptionPanelBtn} onPress={() => navigation.navigate('Subscriptions')} activeOpacity={0.8}>
                  <Text style={s.subscriptionPanelBtnText}>{t('bookingFlow.packageStep.manage')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.subscriptionPanelBody}>
                {subscriptionMatchesVehicle
                  ? t('bookingFlow.packageStep.subscriptionDiscountApplied', { percent: activeSubscription.discountPercent, vehicleType: form.vehicleType })
                  : t('bookingFlow.packageStep.subscriptionOnlyFor', { vehicleType: activeSubscription.vehicleType })}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.subscriptionPanelTitle}>{t('bookingFlow.packageStep.noActiveSubscription')}</Text>
              <Text style={s.subscriptionPanelBody}>{t('bookingFlow.packageStep.noActiveSubscriptionBody')}</Text>
              <TouchableOpacity style={s.subscriptionPanelBtn} onPress={() => navigation.navigate('Subscriptions')} activeOpacity={0.8}>
                <Text style={s.subscriptionPanelBtnText}>{t('bookingFlow.packageStep.browsePlans')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Card>
    </>
  );
}

export default React.memo(BookingPackageStep);
