// ─── BookingShared.js ─────────────────────────────────────────────────────────
// Shared constants, helpers, mini-components and StyleSheets for BookingScreen.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

// ─── Constants ────────────────────────────────────────────────────────────────
export const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const availabilityColors = {
  available: { bg: '#0D2318', border: '#166534', text: '#DCFCE7', dot: '#4ADE80', label: 'Free'   },
  medium:    { bg: '#1C1506', border: '#92400E', text: '#FEF3C7', dot: '#FBBF24', label: 'Medium' },
  full:      { bg: '#1C0A0A', border: '#7F1D1D', text: '#FECACA', dot: '#F87171', label: 'Busy'   },
  disabled:  { bg: '#0D1117', border: '#1F2937', text: '#374151', dot: '#1F2937', label: 'Past'   },
};

export const PAYMENT_METHODS = [
  { id: 'card',   label: 'Credit / Debit Card', icon: 'card-outline'  },
  { id: 'apple',  label: 'Apple Pay',           icon: 'logo-apple'    },
  { id: 'google', label: 'Google Pay',          icon: 'logo-google'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const calculateEndTime = (startTime, durationMinutes) => {
  if (!startTime || !durationMinutes) return '';
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  let hours   = Number(match[1]);
  let minutes = Number(match[2]);
  minutes += durationMinutes;
  hours   += Math.floor(minutes / 60);
  minutes  = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
export const getSlotStartTime = (slot) => String(slot || '').split('-')[0]?.trim() || '';
export const adjustedPrice = (basePrice, multiplier) =>
  Math.round(basePrice * multiplier * 100) / 100;

// ─── Shared mini-components ───────────────────────────────────────────────────
export const SectionHeader = ({ children, icon, step, style }) => (
  <View style={[h.sectionHeaderRow, style]}>
    {step !== undefined && (
      <Text style={h.sectionStep}>{String(step).padStart(2, '0')}</Text>
    )}
    {!!icon && <Ionicons name={icon} size={16} color={theme.colors.primary} />}
    <Text style={h.sectionTitle}>{children}</Text>
    <View style={h.sectionDivider} />
  </View>
);

export const Card = ({ children, style }) => (
  <View style={[h.card, style]}>{children}</View>
);

export const FieldLabel = ({ children }) => (
  <Text style={h.fieldLabel}>{children}</Text>
);

export const ErrorBanner = ({ message }) => (
  <View style={h.errorBanner}>
    <View style={h.errorIconBox}>
      <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
    </View>
    <Text style={h.errorText}>{message}</Text>
  </View>
);

// ─── Shared helper styles (used by mini-components) ───────────────────────────
export const h = StyleSheet.create({
  card: {
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 16, marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionStep: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 0.7, opacity: 0.5,
  },
  sectionTitle: {
    color: theme.colors.text, fontSize: 15, fontWeight: '800',
  },
  sectionDivider: {
    flex: 1, height: 1, marginLeft: 4,
    backgroundColor: 'rgba(200,169,107,0.15)',
  },
  fieldLabel: {
    color: theme.colors.mist, fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: 8, marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(28,10,10,0.9)', borderWidth: 1,
    borderColor: 'rgba(127,29,29,0.4)', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  errorIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});

// ─── Screen-level styles (shared across all booking step components) ──────────
export const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 52, backgroundColor: theme.colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  pageHeader: { marginBottom: 18, alignItems: 'center' },
  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  badgeLine:  { height: 1, width: 20, backgroundColor: 'rgba(200,169,107,0.55)' },
  badgeText: {
    color: theme.colors.primary, fontSize: 10, fontWeight: '700',
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  sub:     { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 300 },
  trustRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10, marginTop: 14,
  },
  trustItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText:    { color: theme.colors.textMuted, fontSize: 10, fontWeight: '500' },
  trustDivider: { width: 1, height: 12, backgroundColor: theme.colors.border },

  pkgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 8,
  },
  pkgRowSelected: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.07)' },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:  { borderColor: theme.colors.primary },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  pkgInfo:        { flex: 1 },
  pkgName:        { color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  pkgMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierPill:       { backgroundColor: 'rgba(200,169,107,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tierPillText:   { color: theme.colors.primary, fontSize: 10, fontWeight: '700' },
  pkgDuration:    { color: theme.colors.textMuted, fontSize: 12 },
  priceCol:       { alignItems: 'flex-end' },
  pkgPriceStrike: { color: theme.colors.textMuted, fontSize: 11, textDecorationLine: 'line-through', marginBottom: 1 },
  pkgPrice:       { color: theme.colors.primary, fontWeight: '900', fontSize: 15 },

  timeConfirmStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.3)',
    borderRadius: 14, backgroundColor: 'rgba(200,169,107,0.06)',
    padding: 14, marginTop: 14, marginBottom: 0,
  },
  timeConfirmBlock: { alignItems: 'center' },
  timeConfirmValue: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  timeConfirmMeta:  { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },

  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  vehicleBtn: {
    width: '48%', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 12, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  vehicleBtnActive:      { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.09)' },
  vehicleBtnLabel:       { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  vehicleBtnLabelActive: { color: theme.colors.text },
  vehicleBadge:          { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  vehicleBadgeText:      { fontSize: 10, fontWeight: '700' },
  subscriptionPanel: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    padding: 14, gap: 10, marginBottom: 4,
  },
  subscriptionPanelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10,
  },
  subscriptionPanelTitle:   { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  subscriptionPanelMeta:    { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  subscriptionPanelBody:    { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  subscriptionPanelBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.primaryBg,
    borderWidth: 1, borderColor: theme.colors.primaryBorder,
  },
  subscriptionPanelBtnText: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },

  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive:     { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  chipText:       { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: theme.colors.ink },
  helperText:     { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 8 },

  calHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  monthTitle:  { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  legendRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  weekRow:     { flexDirection: 'row', marginBottom: 6 },
  weekDay:     { width: '14.28%', textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', aspectRatio: 1, borderWidth: 1,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  calCellSelected: { borderWidth: 2, borderColor: theme.colors.primary },
  calEmpty:    { width: '14.28%', aspectRatio: 1, marginBottom: 5 },
  calDayText:  { fontWeight: '800', fontSize: 13 },
  calDot:      { width: 5, height: 5, borderRadius: 2.5, marginTop: 3 },
  selectedDate: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(200,169,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.2)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 10, marginBottom: 14,
  },
  selectedDateText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  noSlots: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#7F1D1D', backgroundColor: '#1C0A0A',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  noSlotsText: { color: '#FCA5A5', flex: 1, fontSize: 13 },
  slotGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    minWidth: 64, alignItems: 'center',
  },
  slotActive:   { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  slotText:     { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  slotTextActive: { color: theme.colors.ink },

  readRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  readLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  readValue: { color: theme.colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(200,169,107,0.06)',
  },
  editProfileText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  addressDisplay: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12, marginBottom: 10,
  },
  addressDisplayText: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    color: theme.colors.text, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, marginBottom: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },

  savedVehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.inputBg, maxWidth: 160,
  },
  savedVehicleChipActive:     { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  savedVehicleChipText:       { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', flex: 1 },
  savedVehicleChipTextActive: { color: theme.colors.ink },

  couponRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.18)',
    borderRadius: 12, backgroundColor: 'rgba(200,169,107,0.04)',
    padding: 12, marginBottom: 8,
  },
  couponRowActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.10)' },
  couponIconBox:   { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  couponName:      { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  couponCode:      { color: theme.colors.primary, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, marginTop: 2 },

  mockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(254,243,199,0.08)', borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.25)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12, alignSelf: 'flex-start',
  },
  mockBadgeText: { color: '#D97706', fontSize: 11, fontWeight: '600' },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 13, marginBottom: 8,
  },
  payRowActive:     { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.07)' },
  payIconBox:       { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  payIconBoxActive: { backgroundColor: 'rgba(200,169,107,0.14)' },
  payLabel:         { flex: 1, color: theme.colors.textMuted, fontWeight: '600', fontSize: 14 },
  payLabelActive:   { color: theme.colors.text },

  summaryCard: {
    borderWidth: 1.5, borderColor: 'rgba(200,169,107,0.3)',
    borderRadius: 18, backgroundColor: 'rgba(200,169,107,0.06)',
    padding: 18, marginBottom: 14,
  },
  summaryCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  summaryCardTitle:   { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  summaryRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryLabel:       { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryDuration:    { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  summaryAmount:      { color: theme.colors.primary, fontSize: 26, fontWeight: '900' },
  multiplierNote:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  multiplierNoteText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  discountNote:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  discountNoteText:   { color: '#10B981', fontSize: 12, fontWeight: '700' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14, paddingVertical: 15, marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: theme.colors.ink, fontWeight: '900', fontSize: 16 },
  submitTrustRow:    { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  submitTrustItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  submitTrustText:   { color: theme.colors.textMuted, fontSize: 10, fontWeight: '500' },

  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emptyText: { color: theme.colors.textMuted, flex: 1 },
});
