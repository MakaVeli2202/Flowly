import React, { useState } from 'react';
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

function FocusInput({ iconName, style, ...inputProps }) {
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
    </View>
  );
}

export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState(route?.params?.email || '');
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) { setError(t('forgotPassword.errors.emailRequired')); return; }
    try {
      setLoading(true);
      setError('');
      await authAPI.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch {
      setError(t('forgotPassword.errors.failed'));
    } finally {
      setLoading(false);
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
                <Ionicons
                  name={sent ? 'paper-plane-outline' : 'lock-open-outline'}
                  size={28}
                  color={theme.colors.primary}
                />
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.Text entering={FadeInUp.duration(400).delay(260)} style={s.title}>
            {t('forgotPassword.title')}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.duration(400).delay(320)} style={s.caption}>
            {sent ? t('forgotPassword.sentCaption') : t('forgotPassword.caption')}
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

          {sent ? (
            <Animated.View entering={FadeInUp.duration(400).delay(360)} style={s.sentBox}>
              <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.primary} />
              <Text style={s.sentText}>{t('forgotPassword.sentMessage', { email })}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(400).delay(360)}>
              <Text style={s.fieldLabel}>{t('forgotPassword.emailLabel')}</Text>
              <FocusInput
                iconName="mail-outline"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); }}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={onSubmit}
                autoFocus
              />
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.duration(400).delay(420)}>
            {sent ? (
              <PressableScale
                onPress={() => navigation.navigate('Login')}
                activeScale={0.97}
                style={s.btnOuter}
              >
                <LinearGradient
                  colors={[theme.colors.primary, G(0.80)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.btnGradient}
                >
                  <Text style={s.btnText}>{t('forgotPassword.backToLogin')}</Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.ink} />
                </LinearGradient>
              </PressableScale>
            ) : (
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
                    {loading ? t('forgotPassword.sending') : t('forgotPassword.sendBtn')}
                  </Text>
                  {!loading && <Ionicons name="send-outline" size={16} color={theme.colors.ink} />}
                </LinearGradient>
              </PressableScale>
            )}
          </Animated.View>

          {!sent && (
            <Animated.View entering={FadeInUp.duration(400).delay(460)} style={s.footerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.linkText}>{t('forgotPassword.backToLogin')}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
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
    color: theme.colors.textMuted, fontSize: 14,
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

  sentBox: {
    alignItems: 'center', gap: 12,
    paddingVertical: 16, marginBottom: 14,
  },
  sentText: {
    color: theme.colors.text, fontSize: 14, textAlign: 'center', lineHeight: 20,
  },

  fieldLabel: {
    fontSize: 9, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase',
    color: theme.colors.textMuted, marginBottom: 7,
  },

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
  linkText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});
