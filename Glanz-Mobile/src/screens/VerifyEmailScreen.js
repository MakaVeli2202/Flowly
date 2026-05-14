import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity,
} from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api/auth';
import { theme } from '../theme/theme';
import PressableScale from '../components/PressableScale';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

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

export default function VerifyEmailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const email = route?.params?.email ?? '';

  const [code,        setCode]        = useState('');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const inputRef = useRef(null);

  const onVerify = async () => {
    if (!code.trim()) { setError(t('verifyEmail.errors.codeRequired')); return; }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await authAPI.verifyEmail({ email, token: code.trim() });
      setSuccess(t('verifyEmail.success'));
      setTimeout(() => navigation.navigate('Login'), 1800);
    } catch (err) {
      setError(err?.response?.data?.message || t('verifyEmail.errors.invalid'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      setResending(true);
      setError('');
      setSuccess('');
      await authAPI.sendVerification({ email });
      setSuccess(t('verifyEmail.resendSuccess'));
    } catch {
      setError(t('verifyEmail.errors.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient
        colors={[theme.colors.bg, G(0.04), theme.colors.bg, T(0.03), theme.colors.bg]}
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
        <Animated.View entering={FadeInUp.springify().delay(40)} style={s.card}>
          <PrismTopLine />
          <PrismLeftBar />

          <LinearGradient
            colors={[G(0.06), 'transparent', T(0.03)]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          <Animated.View entering={ZoomIn.duration(420).delay(200)} style={s.iconRingWrap}>
            <LinearGradient
              colors={[G(0.55), T(0.38)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconRingOuter}
            >
              <View style={s.iconRingInner}>
                <Ionicons name="mail-open-outline" size={28} color={theme.colors.primary} />
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.Text entering={FadeInUp.duration(400).delay(260)} style={s.title}>
            {t('verifyEmail.title')}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.duration(400).delay(320)} style={s.caption}>
            {t('verifyEmail.caption', { email })}
          </Animated.Text>

          <Animated.View entering={FadeInUp.duration(400).delay(340)}>
            <SpectrumLine style={s.spectrumRule} />
          </Animated.View>

          {!!error && (
            <Animated.View entering={FadeInUp.duration(300)} style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={s.errorText}>{error}</Text>
            </Animated.View>
          )}

          {!!success && (
            <Animated.View entering={FadeInUp.duration(300)} style={s.successBox}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#86EFAC" />
              <Text style={s.successText}>{success}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.duration(400).delay(360)}>
            <Text style={s.fieldLabel}>{t('verifyEmail.codeLabel')}</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={[s.codeBox, code.length > 0 && s.codeBoxFilled]}
            >
              <Ionicons name="key-outline" size={17} color={code.length > 0 ? theme.colors.primary : theme.colors.textMuted} />
              <TextInput
                ref={inputRef}
                style={s.codeInput}
                value={code}
                onChangeText={(v) => { setCode(v); setError(''); setSuccess(''); }}
                placeholder={t('verifyEmail.codePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={onVerify}
                autoFocus
              />
              {code.length > 0 && (
                <TouchableOpacity onPress={() => setCode('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(420)}>
            <PressableScale
              onPress={onVerify}
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
                  {loading ? t('verifyEmail.verifying') : t('verifyEmail.verifyBtn')}
                </Text>
                {!loading && <Ionicons name="checkmark" size={16} color={theme.colors.ink} />}
              </LinearGradient>
            </PressableScale>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(460)} style={s.footerRow}>
            <Text style={s.footerText}>{t('verifyEmail.noCode')}</Text>
            <TouchableOpacity
              onPress={onResend}
              disabled={resending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[s.linkText, resending && s.linkDisabled]}>
                {resending ? t('verifyEmail.resending') : t('verifyEmail.resendBtn')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.colors.bg },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },

  prismTopLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5, zIndex: 2,
  },
  prismLeftBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 3, zIndex: 2,
  },

  card: {
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.card.bg,
    borderRadius: 22,
    paddingHorizontal: 24, paddingVertical: 30,
    overflow: 'hidden',
  },

  iconRingWrap:  { alignSelf: 'center', marginBottom: 20 },
  iconRingOuter: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  iconRingInner: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: '#2A2418',
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    color: theme.colors.text, fontSize: 30, fontWeight: '900',
    textAlign: 'center', marginBottom: 4,
  },
  caption: {
    color: theme.colors.textMuted, fontSize: 13,
    textAlign: 'center', marginBottom: 0,
  },
  spectrumRule: { marginTop: 20, marginBottom: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500' },

  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(22,101,52,0.24)',
    borderWidth: 1, borderColor: 'rgba(134,239,172,0.28)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14,
  },
  successText: { color: '#86EFAC', flex: 1, fontSize: 13, fontWeight: '500' },

  fieldLabel: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    color: theme.colors.textMuted, marginBottom: 7,
  },

  codeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 13, marginBottom: 14,
  },
  codeBoxFilled: { borderColor: G(0.65) },
  codeInput: {
    flex: 1, color: theme.colors.text,
    paddingVertical: 12, fontSize: 22, fontWeight: '700',
    letterSpacing: 8,
  },

  btnOuter:    { marginTop: 6, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.65 },
  btnGradient: {
    paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 16 },

  footerRow: {
    marginTop: 20, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
  },
  footerText:   { color: theme.colors.textMuted, fontSize: 13 },
  linkText:     { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  linkDisabled: { opacity: 0.5 },
});
