import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../api/auth';
import { theme } from '../theme/theme';

/* ── Palette ────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Visual primitives ──────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

/* Parent MUST have overflow:'hidden' */
const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={s.prismTopLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={s.prismLeftBar}
    pointerEvents="none"
  />
);

/* ── FormDivider ────────────────────────────────────────── */
const FormDivider = ({ label }) => (
  <View style={s.dividerWrap}>
    <View style={s.dividerLine} />
    <Text style={s.dividerLabel}>{label}</Text>
    <View style={s.dividerLine} />
  </View>
);

/* ── FormField ──────────────────────────────────────────── */
/*
  Manages its own focus state so the border reacts to keyboard focus.
  Pass rightElement to get the password eye toggle inline.
*/
function FormField({
  label, value, onChangeText, placeholder,
  secureTextEntry, extra = {}, rightElement,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[
        s.inputBox,
        focused   && s.inputBoxFocused,
        !!rightElement && s.inputBoxRow,
      ]}>
        <TextInput
          style={[s.textInput, !!rightElement && s.textInputFlex]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...extra}
        />
        {rightElement}
      </View>
    </View>
  );
}

/* ── PasswordField ──────────────────────────────────────── */
function PasswordField({ label, value, onChangeText, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      rightElement={
        <TouchableOpacity
          onPress={() => setVisible((p) => !p)}
          style={s.eyeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      }
    />
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function CreateWorkerScreen() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    phone: '', password: '', confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
    setSuccess('');
  };

  const onSubmit = async () => {
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 8)               { setError('Password must be at least 8 characters'); return; }
    try {
      setLoading(true); setError(''); setSuccess('');
      await authAPI.registerWorker({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim(),
        password:  form.password,
      });
      setSuccess('Worker account created successfully.');
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create worker account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={s.header}>
        {/* Eyebrow */}
        <View style={s.eyebrow}>
          <LinearGradient
            colors={['transparent', G(0.70)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.eyebrowLine}
          />
          <Ionicons name="shield-checkmark-outline" size={10} color={theme.colors.primary} />
          <Text style={s.eyebrowText}>ADMIN PANEL</Text>
          <LinearGradient
            colors={[G(0.70), 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.eyebrowLine}
          />
        </View>

        {/* Title row */}
        <View style={s.titleRow}>
          <LinearGradient
            colors={[G(0.14), T(0.09)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.titleIconBox}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} />
          </LinearGradient>
          <Text style={s.title}>Create Worker</Text>
        </View>
        <Text style={s.subtitle}>Only administrators can create worker accounts.</Text>
        <SpectrumLine style={{ marginTop: 18 }} />
      </View>

      {/* ── Error banner ───────────────────────────────── */}
      {!!error && (
        <View style={s.alertError}>
          <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
          <Text style={s.alertErrorText}>{error}</Text>
        </View>
      )}

      {/* ── Success banner ─────────────────────────────── */}
      {!!success && (
        <View style={s.alertSuccess}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#86EFAC" />
          <Text style={s.alertSuccessText}>{success}</Text>
        </View>
      )}

      {/* ── Form card ──────────────────────────────────── */}
      {/*
        overflow:'hidden' is required here — it clips PrismTopLine and
        PrismLeftBar to the card's borderRadius.
      */}
      <View style={s.card}>
        <PrismTopLine />
        <PrismLeftBar />
        {/* Subtle prismatic body tint */}
        <LinearGradient
          colors={[G(0.05), 'transparent', T(0.03)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Personal info */}
        <FormDivider label="Personal Info" />
        <View style={s.row}>
          <View style={s.col}>
            <FormField
              label="First Name"
              value={form.firstName}
              onChangeText={(v) => onChange('firstName', v)}
              placeholder="John"
              extra={{ autoCapitalize: 'words', returnKeyType: 'next' }}
            />
          </View>
          <View style={s.col}>
            <FormField
              label="Last Name"
              value={form.lastName}
              onChangeText={(v) => onChange('lastName', v)}
              placeholder="Doe"
              extra={{ autoCapitalize: 'words', returnKeyType: 'next' }}
            />
          </View>
        </View>

        {/* Contact */}
        <FormDivider label="Contact" />
        <FormField
          label="Email Address"
          value={form.email}
          onChangeText={(v) => onChange('email', v)}
          placeholder="worker@example.com"
          extra={{ autoCapitalize: 'none', keyboardType: 'email-address', returnKeyType: 'next' }}
        />
        <FormField
          label="Phone Number"
          value={form.phone}
          onChangeText={(v) => onChange('phone', v)}
          placeholder="+974 1234 5678"
          extra={{ keyboardType: 'phone-pad', returnKeyType: 'next' }}
        />

        {/* Security */}
        <FormDivider label="Security" />
        <PasswordField
          label="Password"
          value={form.password}
          onChangeText={(v) => onChange('password', v)}
          placeholder="Minimum 8 characters"
        />
        <PasswordField
          label="Confirm Password"
          value={form.confirmPassword}
          onChangeText={(v) => onChange('confirmPassword', v)}
          placeholder="Repeat password"
        />

        {/* Submit */}
        {/*
          overflow:'hidden' on btnOuter clips the LinearGradient fill
          to the button's borderRadius.
        */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={loading}
          style={s.btnOuter}
          activeOpacity={0.82}
        >
          <LinearGradient
            colors={[theme.colors.primary, G(0.78)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btnGradient}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.ink} size="small" />
            ) : (
              <View style={s.btnInner}>
                <Ionicons name="person-add-outline" size={15} color={theme.colors.ink} />
                <Text style={s.btnText}>Create Worker Account</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 20, paddingBottom: 52 },

  /* Prism accent primitives */
  prismTopLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5, zIndex: 2,
  },
  prismLeftBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 3, zIndex: 2,
  },

  /* Header */
  header:      { marginBottom: 20 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 7, alignSelf: 'flex-start', marginBottom: 14,
  },
  eyebrowLine: { height: 1, width: 24 },
  eyebrowText: {
    fontSize: 10, fontWeight: '800',
    letterSpacing: 1.2, color: theme.colors.primary,
  },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  titleIconBox: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: G(0.30),
  },
  title:    { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: theme.colors.textMuted, fontSize: 13, marginLeft: 50 },

  /* Alert banners */
  alertError: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderRadius: 12, padding: 13, marginBottom: 12,
  },
  alertErrorText:   { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '600' },
  alertSuccess: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)',
    backgroundColor: 'rgba(20,83,45,0.22)',
    borderRadius: 12, padding: 13, marginBottom: 12,
  },
  alertSuccessText: { color: '#86EFAC', flex: 1, fontSize: 13, fontWeight: '600' },

  /* Form card — overflow:'hidden' clips PrismTopLine + PrismLeftBar */
  card: {
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.card.bg,
    borderRadius: 20, padding: 18,
    overflow: 'hidden',
  },

  /* Section divider */
  dividerWrap: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 14, marginTop: 4,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerLabel: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },

  /* Field */
  fieldWrap:  { marginBottom: 12 },
  fieldLabel: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    color: theme.colors.textMuted, marginBottom: 7,
  },
  inputBox: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 13,
  },
  /* Gold border on focus — no shadow API needed */
  inputBoxFocused: { borderColor: G(0.65) },
  inputBoxRow:     { flexDirection: 'row', alignItems: 'center' },
  textInput: {
    color: theme.colors.text, fontSize: 14,
    paddingVertical: 12,
  },
  textInputFlex: { flex: 1 },
  eyeBtn:        { paddingLeft: 8, paddingVertical: 4 },

  /* Two-column layout */
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  /* Submit button */
  btnOuter:    { marginTop: 10, borderRadius: 14, overflow: 'hidden' },
  btnGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:     { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
});