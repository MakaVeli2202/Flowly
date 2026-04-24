import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from './i18n';
import { applyRTLAndReload } from './useRTL';

const LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧', isRTL: false },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪', isRTL: false },
  { code: 'ar', label: 'العربية', flag: '🇦🇪', isRTL: true  },
];

export function LanguageSelector({ style }) {
  const { i18n } = useTranslation();

  const handlePress = async (code, isRTL) => {
    if (code === i18n.language) return;
    await changeLanguage(code);
    // applyRTLAndReload is a no-op if direction hasn't changed.
    // If it HAS changed the app will reload automatically.
    await applyRTLAndReload(code);
  };

  return (
    <View style={[ls.row, style]}>
      {LANGUAGES.map(({ code, label, flag, isRTL }) => {
        const active = i18n.language === code;
        return (
          <TouchableOpacity
            key={code}
            style={[ls.chip, active && ls.chipActive]}
            onPress={() => handlePress(code, isRTL)}
            activeOpacity={0.75}
          >
            <Text style={ls.flag}>{flag}</Text>
            <Text style={[ls.label, active && ls.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ls = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive:  { borderColor: '#C8A96B', backgroundColor: 'rgba(200,169,107,0.15)' },
  flag:        { fontSize: 16 },
  label:       { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  labelActive: { color: '#C8A96B', fontWeight: '700' },
});