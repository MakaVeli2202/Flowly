// SubscriptionCheckoutScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { subscriptionsAPI } from '../api/subscriptions';
import { subscriptionsAPI as subAPI } from '../api/subscriptions';
import { formatQAR } from '../utils/currency';
import { theme } from '../theme/theme';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';

const PADDING = 20;
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const VEHICLE_MULTIPLIERS = { Motorcycle: 0.8, Sedan: 1.0, SUV: 1.25, Pickup: 1.5 };
const VEHICLE_OPTIONS = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toDateKey = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

const smartDates = (count) => {
  const dates = [];
  const base = new Date();
  base.setDate(base.getDate() + 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    dates.push(toDateKey(d));
  }
  return dates;
};

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
  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 16 },
  successText: { color: '#10b981', flex: 1, fontSize: 12, fontWeight: '500' },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.heading, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: theme.colors.muted },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  btnPrimary: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnSecondaryText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  vehicleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 8, marginBottom: 8 },
  vehicleBtnActive: { backgroundColor: G(0.2), borderColor: G(0.6) },
  calDay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  slotBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  slotBtnActive: { backgroundColor: G(0.2), borderColor: G(0.6) },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: G(0.15), paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 12 },
});

function SectionHeading({ children, step }) {
  return (
    <View style={s.sectionRow}>
      {step !== undefined && (
        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.muted, marginRight: 8, opacity: 0.6 }}>
          {String(step).padStart(2, '0')}
        </Text>
      )}
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.heading }}>{children}</Text>
    </View>
  );
}

function PackageCalendar({ pkgId, selectedDate, onSelectDate, calMonth, onChangeMonth }) {
  const [avail, setAvail] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    subscriptionsAPI.getAvailability({ month: calMonth.getMonth() + 1, year: calMonth.getFullYear(), packageId: pkgId })
      .then((data) => {
        const map = {};
        (data || []).forEach((day) => {
          const dateKey = String(day.date ?? day.Date ?? '').split('T')[0];
          if (!dateKey) return;
          const color = day.color ?? day.Color;
          const avSlots = day.availableSlots ?? day.AvailableSlots ?? 1;
          let status;
          if (color === 'red' || avSlots <= 0) status = 'full';
          else if (color === 'yellow') status = 'medium';
          else status = 'available';
          map[dateKey] = status;
        });
        setAvail(map);
      })
      .catch(() => setAvail({}))
      .finally(() => setLoading(false));
  }, [pkgId, calMonth]);

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const cells = [];
  const firstDay = new Date(year, month, 1);
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = toDateKey(new Date());
  const minDate = addDays(today, 1);

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => { const d = new Date(year, month - 1, 1); onChangeMonth(d); }}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.muted} />
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', color: theme.colors.heading }}>
          {MONTH_NAMES[month]} {year}
          {loading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />}
        </Text>
        <TouchableOpacity onPress={() => { const d = new Date(year, month + 1, 1); onChangeMonth(d); }}>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {DAY_NAMES.map(d => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: theme.colors.muted }}>{d}</Text>)}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
          const key = toDateKey(d);
          const isPast = key < minDate;
          const status = avail[key] || 'available';
          const isSelected = selectedDate === key;
          const isDisabled = isPast || status === 'full';

          let bgColor = 'transparent';
          let textColor = theme.colors.text;
          let borderColor = 'transparent';

          if (isSelected) {
            bgColor = 'rgba(34,197,94,0.22)';
            textColor = '#22c55e';
            borderColor = 'rgba(34,197,94,0.55)';
          } else if (status === 'medium') {
            textColor = '#eab308';
          } else if (isPast) {
            textColor = theme.colors.muted;
          }

          return (
            <TouchableOpacity key={i} style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
              disabled={isDisabled} onPress={() => onSelectDate(key)}>
              <View style={[s.calDay, { backgroundColor: bgColor, borderWidth: isSelected ? 1 : 0, borderColor }]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>{d.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 4 }} />
          <Text style={{ fontSize: 10, color: theme.colors.muted }}>Available</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#eab308', marginRight: 4 }} />
          <Text style={{ fontSize: 10, color: theme.colors.muted }}>Busy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', marginRight: 4 }} />
          <Text style={{ fontSize: 10, color: theme.colors.muted }}>Full</Text>
        </View>
      </View>
    </View>
  );
}

function PackageSlots({ pkgId, date, selectedSlot, onSelectSlot }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setLoading(true);
    subscriptionsAPI.getSlots({ date, packageId: pkgId })
      .then((data) => setSlots(data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [pkgId, date]);

  if (!date) return <Text style={{ fontSize: 12, color: theme.colors.muted, fontStyle: 'italic' }}>Select a date first.</Text>;
  if (loading) return <ActivityIndicator size="small" color={theme.colors.primary} />;
  if (slots.length === 0) return <Text style={{ fontSize: 12, color: '#f59e0b' }}>No slots available.</Text>;

  const availableSlots = slots.filter(s => s.available);
  if (availableSlots.length === 0) return <Text style={{ fontSize: 12, color: '#f59e0b' }}>No available slots.</Text>;

  const fmtSlot = (s) => {
    const part = String(s.slot || s).split('-')[0].trim();
    const [h, m] = part.split(':').map(Number);
    if (!Number.isFinite(h)) return s.slot || s;
    const period = h >= 12 ? 'PM' : 'AM';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${String(m ?? 0).padStart(2, '0')} ${period}`;
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
      {availableSlots.map((slotObj) => (
        <TouchableOpacity key={slotObj.slot} style={[s.slotBtn, selectedSlot === slotObj.slot && s.slotBtnActive]}
          onPress={() => onSelectSlot(slotObj.slot)}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: selectedSlot === slotObj.slot ? G(1) : theme.colors.muted }}>
            {fmtSlot(slotObj)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SubscriptionCheckoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const plan = route.params?.plan || route.params;

  useEffect(() => {
    if (!plan) navigation.navigate('SubscriptionPlans');
  }, [plan, navigation]);

  const packages = plan?.planPackages?.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];

  const suggested = smartDates(packages.length);
  const [selections, setSelections] = useState(() =>
    packages.map((pp, i) => ({
      packageId: pp.packageId,
      date: suggested[i] || '',
      timeSlot: '',
      calMonth: new Date(),
    }))
  );

  const [vehicleType, setVehicleType] = useState('Sedan');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const multiplier = VEHICLE_MULTIPLIERS[vehicleType] ?? 1;
  const baseTotal = packages.reduce((sum, pp) => sum + (pp.packagePrice || 0) * multiplier, 0);
  const discountPct = plan?.discountPercent ?? 0;
  const discount = Math.round(baseTotal * discountPct / 100 * 100) / 100;
  const finalTotal = Math.round((baseTotal - discount) * 100) / 100;
  const billingLabel = plan?.billingCycle === 'Quarterly' ? '/qtr' : '/mo';

  const updateSel = (idx, patch) =>
    setSelections(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const handleSubmit = async () => {
    setError('');

    for (let i = 0; i < selections.length; i++) {
      if (!selections[i].date) { Alert.alert('Error', `Please select a date for service ${i + 1}.`); return; }
      if (!selections[i].timeSlot) { Alert.alert('Error', `Please select a time slot for service ${i + 1}.`); return; }
    }
    if (!vehicleType) { Alert.alert('Error', 'Please select a vehicle type.'); return; }
    if (!serviceAddress.trim()) { Alert.alert('Error', 'Please enter a service address.'); return; }

    setSubmitting(true);
    try {
      await subscriptionsAPI.subscribe({ planId: plan.id });
      await subscriptionsAPI.createBookings({
        items: selections.map(s => ({
          packageId: s.packageId,
          scheduledDate: `${s.date}T12:00:00.000Z`,
          timeSlot: s.timeSlot,
          notes: notes || null,
        })),
        vehicleType,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleYear: vehicleYear || null,
        serviceAddress: serviceAddress || null,
      });

      setSuccess(true);
      setTimeout(() => navigation.navigate('MySubscription'), 2200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!plan) return null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.pageHeader}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }} onPress={() => navigation.navigate('SubscriptionPlans')}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.muted} />
          <Text style={{ color: theme.colors.muted, marginLeft: 4, fontSize: 13 }}>Back to Plans</Text>
        </TouchableOpacity>
        <View style={s.eyebrow}>
          <LinearGradient colors={['transparent', G(0.5)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
          <Text style={s.eyebrowText}>SUBSCRIPTION CHECKOUT</Text>
          <LinearGradient colors={[G(0.5), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.eyebrowLine} />
        </View>
        <Text style={s.heading}>{plan.name}</Text>
        <Text style={s.sub}>Schedule your {packages.length} service{packages.length !== 1 ? 's' : ''}</Text>
      </View>

      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={s.successBanner}>
          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
          <Text style={s.successText}>Subscription activated! Your service bookings are confirmed.</Text>
        </View>
      )}

      {/* Vehicle Details */}
      <View style={s.card}>
        <SectionHeading>Vehicle Details</SectionHeading>

        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Vehicle Type *</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
          {VEHICLE_OPTIONS.map(v => (
            <TouchableOpacity key={v} style={[s.vehicleBtn, vehicleType === v && s.vehicleBtnActive]}
              onPress={() => setVehicleType(v)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: vehicleType === v ? G(1) : theme.colors.muted }}>
                {v} {vehicleType === v && multiplier !== 1 ? `(×${VEHICLE_MULTIPLIERS[v]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Make</Text>
            <TextInput style={s.input} placeholder="Toyota" placeholderTextColor={theme.colors.muted} value={vehicleMake} onChangeText={setVehicleMake} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Model</Text>
            <TextInput style={s.input} placeholder="Camry" placeholderTextColor={theme.colors.muted} value={vehicleModel} onChangeText={setVehicleModel} />
          </View>
        </View>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Year</Text>
          <TextInput style={s.input} placeholder="2022" placeholderTextColor={theme.colors.muted} value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" maxLength={4} />
        </View>

        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Service Address *</Text>
        <AddressAutocompleteInput
          value={serviceAddress}
          onChangeText={setServiceAddress}
          placeholder="Enter your address"
        />

        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, marginTop: 8 }}>Notes (optional)</Text>
        <TextInput style={[s.input, { height: 60 }]} placeholder="Gate code, parking instructions..." placeholderTextColor={theme.colors.muted} value={notes} onChangeText={setNotes} multiline />
      </View>

      {/* Package Schedules */}
      {packages.map((pp, idx) => {
        const sel = selections[idx];
        return (
          <View key={`${pp.packageId}-${idx}`} style={s.card}>
            <SectionHeading>Service {idx + 1}: {pp.packageName}</SectionHeading>
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginBottom: 12 }}>
              {formatQAR(pp.packagePrice * multiplier)}
              {multiplier !== 1 && <Text style={{ opacity: 0.7 }}> ({pp.packagePrice} × {multiplier})</Text>}
            </Text>

            <PackageCalendar
              pkgId={pp.packageId}
              selectedDate={sel?.date}
              onSelectDate={(d) => updateSel(idx, { date: d, timeSlot: '' })}
              calMonth={sel?.calMonth ?? new Date()}
              onChangeMonth={(m) => updateSel(idx, { calMonth: m })}
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12, marginBottom: 4 }}>Time Slot</Text>
            <PackageSlots
              pkgId={pp.packageId}
              date={sel?.date}
              selectedSlot={sel?.timeSlot}
              onSelectSlot={(s) => updateSel(idx, { timeSlot: s })}
            />

            {sel?.date && sel?.timeSlot && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(16,185,129,0.1)', padding: 10, borderRadius: 10 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={{ color: '#10b981', marginLeft: 8, fontWeight: '600', fontSize: 13 }}>
                  {new Date(sel.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {sel.timeSlot}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Pricing Summary */}
      <View style={s.card}>
        <View style={s.badge}>
          <Ionicons name="ribbon" size={16} color={G(1)} />
          <Text style={{ fontWeight: '700', color: theme.colors.heading, marginLeft: 8 }}>{plan.name}</Text>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />

        {packages.map((pp, idx) => (
          <View key={idx} style={s.orderItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: theme.colors.muted, marginRight: 8, width: 20 }}>{idx + 1}.</Text>
              <Text style={{ fontSize: 13, color: theme.colors.text }}>{pp.packageName}</Text>
            </View>
            <Text style={{ fontWeight: '600', fontSize: 13 }}>{formatQAR(pp.packagePrice * multiplier)}</Text>
          </View>
        ))}

        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Subtotal</Text>
            <Text style={s.rowValue}>{formatQAR(baseTotal)}</Text>
          </View>
          {discountPct > 0 && (
            <View style={s.row}>
              <Text style={{ ...s.rowLabel, color: '#10b981' }}>{discountPct}% discount</Text>
              <Text style={{ ...s.rowValue, color: '#10b981' }}>−{formatQAR(discount)}</Text>
            </View>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
            <View style={s.row}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: theme.colors.heading }}>Total</Text>
              <Text style={{ fontWeight: '800', fontSize: 18, color: theme.colors.primary }}>{formatQAR(finalTotal)}<Text style={{ fontWeight: '600', fontSize: 12, color: theme.colors.muted }}>{billingLabel}</Text></Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: theme.colors.muted, marginTop: 8 }}>
            Plan fee {formatQAR(plan.price)}{billingLabel} + {packages.length} scheduled service{packages.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Schedule Status */}
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
          {packages.map((pp, idx) => {
            const sel = selections[idx];
            const done = sel?.date && sel?.timeSlot;
            return (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  {done ? <Ionicons name="checkmark" size={12} color="#10b981" /> : <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.muted }}>{idx + 1}</Text>}
                </View>
                <Text style={{ fontSize: 12, color: done ? '#10b981' : theme.colors.muted }}>
                  {pp.packageName}: {done ? `${new Date(sel.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${sel.timeSlot}` : 'Not scheduled'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity style={[s.btnPrimary, (submitting || success) && { opacity: 0.6 }]} disabled={submitting || success} onPress={handleSubmit}>
        {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPrimaryText}>Confirm Subscription</Text>}
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', fontSize: 11, color: theme.colors.muted, marginTop: 12, marginBottom: 40 }}>
        You will be charged {formatQAR(plan.price)}{billingLabel}. Cancel anytime from your subscription page.
      </Text>
    </ScrollView>
  );
}