// ─── BookingCheckoutStep.js ───────────────────────────────────────────────────
// Sections 7 (Offers) + 8 (Special Instructions) + 9 (Payment) + 10 (Summary + Submit)
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { formatQAR } from '../../utils/currency';
import { SectionHeader, Card, FieldLabel, PAYMENT_METHODS, s } from './BookingShared';

function BookingCheckoutStep({
  form,
  setForm,
  myCoupons,
  totalAmount,
  totalDuration,
  quoteLoading,
  vehicleMultiplier,
  subscriptionDiscountPercent,
  mySubscription,
  activeSubscription,
  subscriptionMatchesVehicle,
  submitting,
  onSubmit,
}) {
  return (
    <>
      {/* ══════════════ 7. OFFERS ════════════════════════════════ */}
      <Card>
        <SectionHeader icon="pricetag-outline" step={7}>Offers &amp; Coupon</SectionHeader>
        {myCoupons.slice(0, 4).map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[s.couponRow, form.offerCode === c.personalCode && s.couponRowActive]}
            onPress={() => setForm((p) => ({ ...p, offerCode: c.personalCode }))}
          >
            <View style={s.couponIconBox}>
              <Ionicons name="gift" size={14} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.couponName}>{c.offerName}</Text>
              <Text style={s.couponCode}>{c.personalCode}</Text>
            </View>
            {form.offerCode === c.personalCode && (
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
        <FieldLabel>Enter Code Manually</FieldLabel>
        <TextInput
          style={s.input}
          value={form.offerCode}
          onChangeText={(v) => setForm((p) => ({ ...p, offerCode: v }))}
          placeholder="Offer / promo code"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
        />
      </Card>

      {/* ══════════════ 8. SPECIAL INSTRUCTIONS ══════════════════ */}
      <Card>
        <SectionHeader icon="chatbox-ellipses-outline" step={8}>Special Instructions</SectionHeader>
        <TextInput
          style={[s.input, s.textArea]}
          value={form.specialInstructions}
          onChangeText={(v) => setForm((p) => ({ ...p, specialInstructions: v }))}
          placeholder="Any special requests or notes for the detailer…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
        />
      </Card>

      {/* ══════════════ 9. PAYMENT METHOD ════════════════════════ */}
      <Card>
        <SectionHeader icon="card-outline" step={9}>Payment Method</SectionHeader>
        <View style={s.mockBadge}>
          <Ionicons name="construct-outline" size={11} color="#92400E" />
          <Text style={s.mockBadgeText}>Mock — Stripe will be integrated before launch</Text>
        </View>
        {PAYMENT_METHODS.map((method) => {
          const active = form.paymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[s.payRow, active && s.payRowActive]}
              onPress={() => setForm((p) => ({ ...p, paymentMethod: method.id }))}
              activeOpacity={0.7}
            >
              <View style={[s.payIconBox, active && s.payIconBoxActive]}>
                <Ionicons name={method.icon} size={17} color={active ? theme.colors.primary : theme.colors.textMuted} />
              </View>
              <Text style={[s.payLabel, active && s.payLabelActive]}>{method.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* ══════════════ 10. SUMMARY + SUBMIT ═════════════════════ */}
      <View style={s.summaryCard}>
        <View style={s.summaryCardHeader}>
          <Ionicons name="receipt-outline" size={15} color={theme.colors.primary} />
          <Text style={s.summaryCardTitle}>Booking Summary</Text>
        </View>
        <View style={s.summaryRow}>
          <View>
            <Text style={s.summaryLabel}>Estimated Duration</Text>
            <Text style={s.summaryDuration}>{totalDuration} min</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.summaryLabel}>Total</Text>
            {quoteLoading
              ? <ActivityIndicator size="small" color={theme.colors.primary} />
              : <Text style={s.summaryAmount}>{formatQAR(totalAmount)}</Text>
            }
          </View>
        </View>
        {vehicleMultiplier !== 1.0 && (
          <View style={s.multiplierNote}>
            <Ionicons name="information-circle-outline" size={13} color={theme.colors.primary} />
            <Text style={s.multiplierNoteText}>
              {vehicleMultiplier < 1
                ? `${form.vehicleType} discount applied (×${vehicleMultiplier})`
                : `${form.vehicleType} surcharge applied (×${vehicleMultiplier})`}
            </Text>
          </View>
        )}
        {subscriptionDiscountPercent > 0 && (
          <View style={s.discountNote}>
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
            <Text style={s.discountNoteText}>
              {subscriptionDiscountPercent}% {mySubscription?.planName || 'subscription'} discount applied
            </Text>
          </View>
        )}
        {activeSubscription && !subscriptionMatchesVehicle && (
          <View style={s.discountNote}>
            <Ionicons name="information-circle-outline" size={13} color={theme.colors.primary} />
            <Text style={s.discountNoteText}>Switch to {activeSubscription.vehicleType} to use your current plan discount.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.submitBtn, submitting && s.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={theme.colors.ink} size="small" />
        ) : (
          <>
            <Text style={s.submitText}>Confirm Booking</Text>
            <Ionicons name="arrow-forward" size={17} color={theme.colors.ink} />
          </>
        )}
      </TouchableOpacity>

      <View style={s.submitTrustRow}>
        {[
          { icon: 'shield-checkmark-outline', label: 'Secure Checkout'      },
          { icon: 'checkmark-circle-outline', label: 'Instant Confirmation' },
          { icon: 'time-outline',             label: 'Free Reschedule'       },
        ].map(({ icon, label }) => (
          <View key={label} style={s.submitTrustItem}>
            <Ionicons name={icon} size={11} color={theme.colors.primary} />
            <Text style={s.submitTrustText}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

export default React.memo(BookingCheckoutStep);
