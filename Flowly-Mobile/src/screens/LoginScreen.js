import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import PressableScale from '../components/PressableScale';

/* ── Palette ─────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Visual primitives ───────────────────────────────────── */
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

/* ── FocusInput ───────────────────────────────────────────── */
/*
  Accepts all TextInput props via spread.
  Left icon tints gold on focus; right slot for eye toggle.
*/
function FocusInput({ iconName, rightElement, style, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.inputBox, focused && s.inputBoxFocused]}>
      <Ionicons
        name={iconName}
        size={17}
        color={focused ? theme.colors.primary : theme.colors.textMuted}
      />
      <TextInput
        style={s.textInput}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      {rightElement}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════════════════════════ */
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const clearError = () => setError('');

  const onSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password)     { setError('Please enter your password.'); return; }
    try {
      setLoading(true);
      setError('');
      await login(email.trim(), password);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.requiresEmailVerification) {
        navigation.navigate('VerifyEmail', { email: data.email || email.trim() });
        return;
      }
      setError(data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Full-screen background tint ──────────────── */}
      <LinearGradient
        colors={[
          theme.colors.bg,
          G(0.04),
          theme.colors.bg,
          T(0.03),
          theme.colors.bg,
        ]}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/*
          Card: overflow:'hidden' clips PrismTopLine + PrismLeftBar
          to the card's borderRadius.
        */}
        <Animated.View entering={FadeInUp.springify().delay(40)} style={s.card}>
          <PrismTopLine />
          <PrismLeftBar />

          {/* Subtle card body tint */}
          <LinearGradient
            colors={[G(0.06), 'transparent', T(0.03)]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* ── Icon ring ──────────────────────────────── */}
          {/*
            Gradient ring technique:
            outer LinearGradient (68×68) → inner View (64×64)
            creates a 2px gradient border illusion.
          */}
          <Animated.View entering={ZoomIn.duration(420).delay(200)} style={s.iconRingWrap}>
            <LinearGradient
              colors={[G(0.55), T(0.38)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconRingOuter}
            >
              <View style={s.iconRingInner}>
                <Ionicons name="log-in-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Titles ─────────────────────────────────── */}
          <Animated.Text entering={FadeInUp.duration(400).delay(260)} style={s.title}>
            Welcome Back
          </Animated.Text>
          <Animated.Text entering={FadeInUp.duration(400).delay(320)} style={s.caption}>
            Sign in to your account
          </Animated.Text>

          {/* Spectrum rule — visual break before inputs */}
          <Animated.View entering={FadeInUp.duration(400).delay(340)}>
            <SpectrumLine style={s.spectrumRule} />
          </Animated.View>

          {/* ── Error banner ───────────────────────────── */}
          {!!error && (
            <Animated.View entering={FadeInUp.duration(300)} style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={s.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* ── Email ──────────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(400).delay(360)}>
            <Text style={s.fieldLabel}>Email Address</Text>
            <FocusInput
              iconName="mail-outline"
              value={email}
              onChangeText={(v) => { setEmail(v); clearError(); }}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </Animated.View>

          {/* ── Password ───────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(400).delay(420)}>
            <Text style={s.fieldLabel}>Password</Text>
            <FocusInput
              iconName="lock-closed-outline"
              value={password}
              onChangeText={(v) => { setPassword(v); clearError(); }}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  style={s.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />
          </Animated.View>

          {/* ── Submit ─────────────────────────────────── */}
          {/*
            PressableScale receives borderRadius + overflow:'hidden'
            so the LinearGradient child clips to the rounded corners.
          */}
          <Animated.View entering={FadeInUp.duration(400).delay(480)}>
            <PressableScale
              onPress={onSubmit}
              disabled={loading}
              activeScale={0.97}
              style={[s.btnOuter, loading && s.btnDisabled]}
            >
              <LinearGradient
                colors={[theme.colors.primary, G(0.80)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btnGradient}
              >
                <Text style={s.btnText}>
                  {loading ? 'Signing In…' : 'Sign In'}
                </Text>
                {!loading && (
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.ink} />
                )}
              </LinearGradient>
            </PressableScale>
          </Animated.View>

          {/* ── Forgot password ────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(400).delay(500)} style={s.forgotRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Footer ─────────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(400).delay(540)} style={s.footerRow}>
            <Text style={s.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.linkText}> Sign Up</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.colors.bg },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },

  /* Prism accent primitives */
  prismTopLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5, zIndex: 2,
  },
  prismLeftBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 3, zIndex: 2,
  },

  /* Card — overflow:'hidden' is load-bearing here */
  card: {
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.card.bg,
    borderRadius: 22,
    paddingHorizontal: 24, paddingVertical: 30,
    overflow: 'hidden',
  },

  /* Icon ring */
  iconRingWrap: { alignSelf: 'center', marginBottom: 20 },
  iconRingOuter: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  iconRingInner: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: '#2A2418',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Titles */
  title: {
    color: theme.colors.text, fontSize: 30, fontWeight: '900',
    textAlign: 'center', marginBottom: 4,
  },
  caption: {
    color: theme.colors.textMuted, fontSize: 14,
    textAlign: 'center', marginBottom: 0,
  },
  spectrumRule: { marginTop: 20, marginBottom: 20 },

  /* Error banner */
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },

  /* Field label */
  fieldLabel: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    color: theme.colors.textMuted, marginBottom: 7,
  },

  /* Input — always a row (left icon + input + optional right element) */
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 13, marginBottom: 14,
  },
  inputBoxFocused: { borderColor: G(0.65) },
  textInput: {
    flex: 1, color: theme.colors.text,
    paddingVertical: 12, fontSize: 14,
  },
  eyeBtn: { paddingLeft: 4 },

  /* Submit button */
  btnOuter: {
    marginTop: 6, borderRadius: 14,
    overflow: 'hidden',         /* clips LinearGradient to borderRadius */
  },
  btnDisabled:  { opacity: 0.65 },
  btnGradient: {
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 16 },

  /* Forgot password */
  forgotRow: {
    marginTop: 4, alignItems: 'flex-end',
  },

  /* Footer */
  footerRow: {
    marginTop: 20, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
  },
  footerText: { color: theme.colors.textMuted, fontSize: 13 },
  linkText:   { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});