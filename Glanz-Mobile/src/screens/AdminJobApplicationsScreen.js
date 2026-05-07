import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useScrollHeader } from '../hooks/useScrollHeader';

export default function AdminJobApplicationsScreen() {
  const { t } = useTranslation();
  const { handleScroll, headerStyle, headerOpacity } = useScrollHeader();
  return (
    <View style={styles.root}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.title, { opacity: headerOpacity }]}>{t('admin.jobApps.title', 'Job Applications')}</Text>
      </View>
      <ScrollView style={styles.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={styles.content}>
          <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.message}>{t('admin.jobApps.comingSoon', 'Job applications management coming soon')}</Text>
        </View>
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  scroll: { flex: 1 },
  content: { paddingTop: 120, alignItems: 'center', gap: 12 },
  message: { color: theme.colors.textMuted, fontSize: 15 },
  footer: { height: 100 },
});
