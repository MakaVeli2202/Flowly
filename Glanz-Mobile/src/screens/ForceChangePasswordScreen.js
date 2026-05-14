import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/auth';
import { theme } from '../theme/theme';

function RuleRow({ met, text }) {
  return (
    <View style={s.ruleRow}>
      <View style={[s.ruleDot, met && s.ruleDotMet]} />
      <Text style={[s.ruleText, met && s.ruleTextMet]}>{text}</Text>
    </View>
  );
}

export default function ForceChangePasswordScreen() {
  const { setUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);

  const rules = [
    { met: newPassword.length >= 8,           text: 'At least 8 characters' },
    { met: /[A-Z]/.test(newPassword),         text: 'One uppercase letter' },
    { met: /[0-9]/.test(newPassword),         text: 'One number' },
    { met: /[^A-Za-z0-9]/.test(newPassword), text: 'One special character' },
  ];
  const allRulesMet    = rules.every(r => r.met);
  const passwordsMatch = newPassword === confirm && confirm.length > 0;

  const handleSubmit = async () => {
    if (!allRulesMet)    { setError('Password does not meet requirements.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setSaving(true);
    setError('');
    try {
      await authAPI.forceChangePassword({ newPassword, confirmNewPassword: confirm });
      setDone(true);
      setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <View style={s.doneContainer}>
        <Ionicons name="checkmark-circle" size={72} color="#34D399" />
        <Text style={s.doneTitle}>Password updated!</Text>
        <Text style={s.doneSub}>Taking you to your dashboard...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.iconBox}>
            <Ionicons name="lock-closed" size={28} color={theme.colors.primary} />
          </View>
          <Text style={s.title}>Set Your Password</Text>
          <Text style={s.subtitle}>
            Your account was created with a temporary password. Choose a new one to continue.
          </Text>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#F87171" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Text style={s.label}>NEW PASSWORD</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={v => { setNewPassword(v); setError(''); }}
              placeholder="Choose a strong password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {newPassword.length > 0 && (
            <View style={s.rules}>
              {rules.map(r => <RuleRow key={r.text} met={r.met} text={r.text} />)}
            </View>
          )}

          <Text style={[s.label, { marginTop: 16 }]}>CONFIRM PASSWORD</Text>
          <View style={[s.inputRow, confirm.length > 0 && (passwordsMatch ? s.inputRowGreen : s.inputRowRed)]}>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={v => { setConfirm(v); setError(''); }}
              placeholder="Repeat your new password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, (!allRulesMet || !passwordsMatch || saving) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!allRulesMet || !passwordsMatch || saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>Set Password</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 40,
    backgroundColor: theme.colors.bg,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(200,169,107,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(200,169,107,0.3)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    color: theme.colors.text, fontSize: 22, fontWeight: '800',
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.textMuted, fontSize: 13, textAlign: 'center',
    lineHeight: 19, marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 12, marginBottom: 16,
  },
  errorText: { color: '#F87171', fontSize: 13, flex: 1 },
  label: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
  },
  inputRowGreen: { borderColor: 'rgba(52,211,153,0.5)' },
  inputRowRed:   { borderColor: 'rgba(248,113,113,0.5)' },
  input: {
    flex: 1, color: theme.colors.text, fontSize: 14,
    paddingVertical: 13,
  },
  eyeBtn: { padding: 4 },
  rules: { marginTop: 10, gap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ruleDotMet: { backgroundColor: '#34D399' },
  ruleText: { color: theme.colors.textMuted, fontSize: 12 },
  ruleTextMet: { color: '#34D399' },
  btn: {
    marginTop: 24, backgroundColor: theme.colors.primary,
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  doneContainer: {
    flex: 1, backgroundColor: theme.colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  doneTitle: { color: '#34D399', fontSize: 22, fontWeight: '800' },
  doneSub:   { color: theme.colors.textMuted, fontSize: 14 },
});
