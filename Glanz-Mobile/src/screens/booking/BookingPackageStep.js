// ─── BookingPackageStep.js ────────────────────────────────────────────────────
// Sections 1 (Package) + 2 (Vehicle Type & Subscription)
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  return (
    <>
      {/* ══════════════ 1. PACKAGE ══════════════════════════════ */}
      <Card>
        <SectionHeader icon="cube-outline" step={1}>Select Package</SectionHeader>
        {packagesLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : packages.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="cube-outline" size={20} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>No packages available right now.</Text>
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
                  <Text style={s.pkgDuration}>{pkg.estimatedDurationMinutes} min</Text>
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
        <SectionHeader icon="car-outline" step={2}>Vehicle &amp; Service Type</SectionHeader>

        <FieldLabel>Vehicle Type</FieldLabel>
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

        <FieldLabel>Subscription</FieldLabel>
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
                  <Text style={s.subscriptionPanelBtnText}>Manage</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.subscriptionPanelBody}>
                {subscriptionMatchesVehicle
                  ? `${activeSubscription.discountPercent}% discount will apply to this ${form.vehicleType} booking.`
                  : `This plan only applies to ${activeSubscription.vehicleType} bookings.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.subscriptionPanelTitle}>No active subscription</Text>
              <Text style={s.subscriptionPanelBody}>Browse plans for your vehicle type to unlock recurring discounts without touching slot or worker selection.</Text>
              <TouchableOpacity style={s.subscriptionPanelBtn} onPress={() => navigation.navigate('Subscriptions')} activeOpacity={0.8}>
                <Text style={s.subscriptionPanelBtnText}>Browse Plans</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Card>
    </>
  );
}

export default React.memo(BookingPackageStep);
