// SubscriptionBookingScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { subscriptionsAPI } from '../api/subscriptions';
import { packagesAPI } from '../api/packages';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';

const PADDING = 20;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: PADDING, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: { marginBottom: 20 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrowLine: { flex: 1, height: 1 },
  eyebrowText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary, letterSpacing: 2, marginHorizontal: 8 },
  heading: { fontSize: 26, fontWeight: '800', color: theme.colors.heading, marginBottom: 4 },
  sub: { fontSize: 14, color: theme.colors.muted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionDivider: { flex: 1, height: 1, marginLeft: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 12, fontWeight: '500' },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.heading, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: theme.colors.muted },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  btnPrimary: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnSecondaryText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  packageCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  packageSelected: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: 'rgba(14,165,160,0.1)' },
  slotBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  slotBtnActive: { backgroundColor: 'rgba(200,169,107,0.2)', borderColor: G(0.6) },
  slotFull: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  calendarDay: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginBottom: 4 },
  calendarDayActive: { backgroundColor: G(0.2) },
  successCard: { backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
});

function StepDot({ n, active, done }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? '#10b981' : active ? theme.colors.primary : 'rgba(255,255,255,0.06)', borderWidth: active ? 0 : 1, borderColor: 'rgba(255,255,255,0.1)' }}>
      {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={{ color: active ? '#fff' : theme.colors.muted, fontSize: 12, fontWeight: '700' }}>{n}</Text>}
    </View>
  );
}

export default function SubscriptionBookingScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [sub, setSub] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [dayColors, setDayColors] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (step === 2) loadAvailability(calMonth, calYear);
  }, [step, calMonth, calYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mySubRes, pkgsRes] = await Promise.all([
        subscriptionsAPI.getMy().catch(() => null),
        packagesAPI.getAll(),
      ]);
      setSub(mySubRes ?? null);
      const active = (pkgsRes || []).filter(p => p.isActive);
      setPackages(active);
      if (active.length === 1) setSelectedPkg(active[0]);
    } catch (e) {
      setError('Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (m, y) => {
    setLoadingAvail(true);
    try {
      const data = await subscriptionsAPI.getAvailability({ month: m + 1, year: y });
      const map = {};
      (data || []).forEach(d => { map[d.date] = d.color; });
      setDayColors(map);
    } catch { setDayColors({}); }
    finally { setLoadingAvail(false); }
  };

  const selectDate = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const data = await subscriptionsAPI.getSlots({ date: dateStr });
      setSlots(data || []);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  };

  const handleConfirm = async () => {
    if (!selectedPkg || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await subscriptionsAPI.createBooking({
        packageId: selectedPkg.id,
        scheduledDate: new Date(selectedDate + 'T00:00:00Z').toISOString(),
        timeSlot: selectedSlot,
        notes,
      });
      setSuccess(result);
      setStep(4);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to create booking.');
    } finally { setSubmitting(false); }
  };

  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const total = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    const days = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= total; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      days.push({ d, dateStr, color: dayColors[dateStr] || 'green', isPast });
    }
    return days;
  })();

  const colorDot = { green: { bg: '#10b981', label: 'Available' }, yellow: { bg: '#f59e0b', label: 'Filling up' }, red: { bg: '#ef4444', label: 'Nearly full' } };
  const discountPct = sub?.discountPercent || 0;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!sub) {
    return (
      <View style={[s.center, { padding: 20 }]}>
        <View style={s.card}>
          <Ionicons name="alert-circle" size={40} color="#f59e0b" style={{ textAlign: 'center', marginBottom: 12 }} />
          <Text style={[s.cardTitle, { textAlign: 'center' }]}>No Active Subscription</Text>
          <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
            You need an active subscription to book with a discount.
          </Text>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('SubscriptionPlans')}>
            <Text style={s.btnPrimaryText}>Browse Plans</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.pageHeader}>
        <View style={s.eyebrow}>
          <LinearGradient colors={['transparent', G(0.5)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          <Text style={s.eyebrowText}>SUBSCRIPTION</Text>
          <LinearGradient colors={[G(0.5), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
        </View>
        <Text style={s.heading}>Book a Session</Text>
        <Text style={s.sub}>{sub.planName} Plan · {discountPct}% off</Text>
      </View>

      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Step indicator */}
      {step < 4 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <StepDot n={1} active={step === 1} done={step > 1} />
          <View style={{ flex: 1, height: 2, backgroundColor: step > 1 ? '#10b981' : 'rgba(255,255,255,0.1)', marginHorizontal: 8 }} />
          <StepDot n={2} active={step === 2} done={step > 2} />
          <View style={{ flex: 1, height: 2, backgroundColor: step > 2 ? '#10b981' : 'rgba(255,255,255,0.1)', marginHorizontal: 8 }} />
          <StepDot n={3} active={step === 3} done={step > 3} />
        </View>
      )}

      {/* STEP 1: Package */}
      {step === 1 && (
        <View>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Step 1 — Select Package</Text>
          </View>
          <Text style={{ color: theme.colors.muted, fontSize: 13, marginBottom: 12 }}>
            Your {discountPct}% discount will be applied.
          </Text>
          {packages.map(pkg => {
            const isSelected = selectedPkg?.id === pkg.id;
            const disc = Math.round(pkg.price * discountPct / 100 * 100) / 100;
            return (
              <TouchableOpacity key={pkg.id} style={[s.packageCard, isSelected && s.packageSelected]}
                onPress={() => setSelectedPkg(pkg)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isSelected ? G(0.2) : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="star" size={16} color={isSelected ? G(1) : theme.colors.muted} />
                    </View>
                    <View>
                      <Text style={{ fontWeight: '700', color: theme.colors.heading, fontSize: 14 }}>{pkg.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{pkg.vehicleType} · {pkg.durationMinutes} min</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.muted, textDecorationLine: 'line-through' }}>{formatQAR(pkg.price)}</Text>
                    <Text style={{ fontWeight: '700', color: '#10b981', fontSize: 14 }}>{formatQAR(pkg.price - disc)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.btnPrimary, !selectedPkg && { opacity: 0.4 }]} disabled={!selectedPkg}
            onPress={() => setStep(2)}>
            <Text style={s.btnPrimaryText}>Next: Choose Date →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: Calendar */}
      {step === 2 && (
        <View>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Step 2 — Choose Date & Time</Text>
          </View>

          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth - 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <Text style={{ fontWeight: '700', color: theme.colors.heading }}>{MONTH_NAMES[calMonth]} {calYear}</Text>
              <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth + 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {DAY_NAMES.map(d => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: theme.colors.muted }}>{d}</Text>)}
            </View>

            {loadingAvail ? (
              <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calDays.map((day, i) => !day ? <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} /> : (
                  <TouchableOpacity key={day.dateStr} style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                    disabled={day.isPast} onPress={() => selectDate(day.dateStr)}>
                    <View style={[
                      s.calendarDay,
                      selectedDate === day.dateStr && s.calendarDayActive,
                      day.isPast && { opacity: 0.3 }
                    ]}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: selectedDate === day.dateStr ? G(1) : theme.colors.text }}>{day.d}</Text>
                    </View>
                    {!day.isPast && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (colorDot[day.color] || colorDot.green).bg }} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
              {Object.entries(colorDot).map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.bg, marginRight: 4 }} />
                  <Text style={{ fontSize: 10, color: theme.colors.muted }}>{v.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {selectedDate && (
            <View style={s.card}>
              <Text style={{ fontWeight: '700', color: theme.colors.heading, marginBottom: 12 }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              {loadingSlots ? <ActivityIndicator size="small" color={theme.colors.primary} /> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {slots.map(slot => (
                    <TouchableOpacity key={slot.slot} style={[s.slotBtn, !slot.available && s.slotFull, selectedSlot === slot.slot && s.slotBtnActive]}
                      disabled={!slot.available} onPress={() => setSelectedSlot(slot.slot)}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: !slot.available ? '#ef4444' : selectedSlot === slot.slot ? G(1) : theme.colors.text }}>
                        {slot.slot.split('-')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={s.btnSecondary} onPress={() => setStep(1)}>
              <Text style={s.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, { flex: 1, marginLeft: 12, marginTop: 0 }]} disabled={!selectedDate || !selectedSlot}
              onPress={() => setStep(3)}>
              <Text style={s.btnPrimaryText}>Next: Confirm →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: Confirm */}
      {step === 3 && (
        <View>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Step 3 — Confirm Booking</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Booking Summary</Text>
            <View style={{ marginTop: 12 }}>
              <View style={s.row}><Text style={s.rowLabel}>Package</Text><Text style={s.rowValue}>{selectedPkg?.name}</Text></View>
              <View style={s.row}><Text style={s.rowLabel}>Plan</Text><Text style={s.rowValue}>{sub.planName} ({discountPct}% off)</Text></View>
              <View style={s.row}><Text style={s.rowLabel}>Date</Text><Text style={s.rowValue}>{selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</Text></View>
              <View style={s.row}><Text style={s.rowLabel}>Time</Text><Text style={s.rowValue}>{selectedSlot?.split('-')[0] || '—'}</Text></View>
              <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginVertical: 8 }} />
              <View style={s.row}><Text style={s.rowLabel}>Original</Text><Text style={s.rowValue}>{formatQAR(selectedPkg?.price || 0)}</Text></View>
              {discountPct > 0 && <View style={s.row}><Text style={{ ...s.rowLabel, color: '#10b981' }}>Discount ({discountPct}%)</Text><Text style={{ ...s.rowValue, color: '#10b981' }}>-{formatQAR(Math.round(selectedPkg?.price * discountPct / 100 * 100) / 100)}</Text></View>}
              <View style={s.row}><Text style={{ ...s.rowLabel, fontWeight: '700', color: theme.colors.heading }}>You Pay</Text><Text style={{ fontWeight: '800', fontSize: 16, color: '#10b981' }}>{formatQAR((selectedPkg?.price || 0) - Math.round(selectedPkg?.price * discountPct / 100 * 100) / 100)}</Text></View>
            </View>
          </View>

          <TouchableOpacity style={s.btnSecondary} onPress={() => setStep(2)}>
            <Text style={s.btnSecondaryText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnPrimary} disabled={submitting} onPress={handleConfirm}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Confirm Booking ✓</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 4: Success */}
      {step === 4 && success && (
        <View style={s.successCard}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={32} color="#10b981" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.heading, marginBottom: 4 }}>Booking Confirmed!</Text>
          <Text style={{ color: theme.colors.muted, fontSize: 13, marginBottom: 4 }}>Booking number</Text>
          <Text style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: 16, color: theme.colors.primary, marginBottom: 20 }}>{success.bookingNumber}</Text>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('MyBookings')}>
            <Text style={s.btnPrimaryText}>View All Bookings →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.navigate('MySubscription')}>
            <Text style={s.btnSecondaryText}>My Subscription</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}