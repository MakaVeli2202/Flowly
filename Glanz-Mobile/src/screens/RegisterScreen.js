// ─── RegisterScreen.js ────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ScrollView, TouchableOpacity,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import PressableScale from '../components/PressableScale';

/* ── Palette ──────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Prism plain styles ──────────────────────────────────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Visual primitives ──────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={prismStyles.topLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={prismStyles.leftBar}
    pointerEvents="none"
  />
);

/* ── FieldInput — focus-aware gold border ─────────────────── */
/*
  Replaces the renderInput inline function.
  containerStyle wraps both label and input (used for flex: 1 in the name row).
*/
function FieldInput({
  label, containerStyle, style,
  onFocus: onFocusProp, onBlur: onBlurProp,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        style={[s.input, focused && s.inputFocused, style]}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={(e) => { setFocused(true); onFocusProp?.(e); }}
        onBlur={(e)  => { setFocused(false); onBlurProp?.(e); }}
        {...props}
      />
    </View>
  );
}

/* ── PasswordField — focus-aware, visibility toggle ──────── */
/*
  Replaces renderPasswordInput.
  The inputWrap border turns gold on focus, matching FieldInput behaviour.
*/
function PasswordField({ label, value, onChange, placeholder, visible, setVisible }) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputWrapFocused]}>
        <TextInput
          style={s.inputInner}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity
          onPress={() => setVisible((p) => !p)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function RegisterScreen() {
  const { register } = useAuth();
  const [form,         setForm]        = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState('');

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const onSubmit = async () => {
    if (!form.firstName.trim()) { setError('Please enter your first name.'); return; }
    if (!form.lastName.trim())  { setError('Please enter your last name.'); return; }
    if (!form.email.trim())     { setError('Please enter your email address.'); return; }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await register({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim(),
        password:  form.password,
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/*
        overflow:'hidden' on card clips PrismTopLine, PrismLeftBar,
        and the absoluteFillObject gradient to theme.radius.lg corners.
      */}
      <Animated.View entering={FadeInUp.springify().delay(40)} style={s.card}>
        <PrismTopLine />
        <PrismLeftBar />
        <LinearGradient
          colors={[G(0.06), 'transparent', T(0.04)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* ── Icon gradient ring ─────────────────────────── */}
        <Animated.View entering={ZoomIn.duration(400).delay(200)} style={s.iconRingWrap}>
          <LinearGradient
            colors={[G(0.90), T(0.60)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.iconRingOuter}
          >
            <View style={s.iconRingInner}>
              <Ionicons name="person-add-outline" size={28} color={theme.colors.primary} />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Headline ───────────────────────────────────── */}
        <Animated.Text entering={FadeInUp.duration(400).delay(260)} style={s.title}>
          Create Account
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(400).delay(310)} style={s.caption}>
          Join Glanz today
        </Animated.Text>

        {/* ── Spectrum divider ───────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400).delay(340)}>
          <SpectrumLine style={{ marginTop: 14, marginBottom: 18 }} />
        </Animated.View>

        {/* ── Error banner ───────────────────────────────── */}
        {!!error && (
          <Animated.View entering={FadeInUp.duration(300)} style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
            <Text style={s.errorText}>{error}</Text>
          </Animated.View>
        )}

        {/* ── Name row ───────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400).delay(360)} style={s.row}>
          <FieldInput
            label="First Name"
            value={form.firstName}
            onChangeText={(v) => onChange('firstName', v)}
            placeholder="John"
            containerStyle={s.col}
          />
          <FieldInput
            label="Last Name"
            value={form.lastName}
            onChangeText={(v) => onChange('lastName', v)}
            placeholder="Doe"
            containerStyle={s.col}
          />
        </Animated.View>

        {/* ── Email ──────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400).delay(420)}>
          <FieldInput
            label="Email"
            value={form.email}
            onChangeText={(v) => onChange('email', v)}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </Animated.View>

        {/* ── Password ───────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400).delay(480)}>
          <PasswordField
            label="Password"
            value={form.password}
            onChange={(v) => onChange('password', v)}
            placeholder="••••••••"
            visible={showPassword}
            setVisible={setShowPassword}
          />
        </Animated.View>

        {/* ── Submit ─────────────────────────────────────── */}
        {/*
          PressableScale is the outermost interactive element.
          overflow:'hidden' on s.btn clips the absoluteFillObject
          gradient to borderRadius: 10 — the scale animation carries
          the gradient with it, which is the correct behaviour.
        */}
        <Animated.View entering={FadeInUp.duration(400).delay(530)}>
          <PressableScale
            style={[s.btn, loading && s.btnDisabled]}
            onPress={onSubmit}
            disabled={loading}
            activeScale={0.97}
          >
            <LinearGradient
              colors={[theme.colors.primary, G(0.82)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <Text style={s.btnText}>
              {loading ? 'Creating Account…' : 'Create Account'}
            </Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </ScrollView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },

  /* Card — overflow:'hidden' required */
  card: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, backgroundColor: theme.card.bg,
    padding: theme.spacing.lg, overflow: 'hidden',
  },

  /* Icon ring */
  iconRingWrap:  { alignSelf: 'center', marginBottom: theme.spacing.md },
  iconRingOuter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  iconRingInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#2A2418', alignItems: 'center', justifyContent: 'center' },

  /* Typography */
  title:   { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  caption: { color: theme.colors.textMuted, textAlign: 'center' },

  /* Error banner */
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 10, padding: 10, marginBottom: 14,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },

  /* Layout */
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  /* Inputs */
  label:        { color: theme.colors.mist, marginBottom: 6, fontWeight: '600', fontSize: 13 },
  input:        { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.inputBg, color: theme.colors.text, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12 },
  inputFocused: { borderColor: G(0.65) },
  inputWrap:    { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.inputBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12 },
  inputWrapFocused: { borderColor: G(0.65) },
  inputInner:   { flex: 1, color: theme.colors.text, paddingVertical: 11 },

  /* Button — overflow:'hidden' clips the gradient */
  btn:         { marginTop: 8, borderRadius: 10, paddingVertical: 14, alignItems: 'center', overflow: 'hidden' },
  btnDisabled: { opacity: 0.65 },
  btnText:     { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
});