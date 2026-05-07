import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useScrollHeader } from '../hooks/useScrollHeader';

export default function AdminDevSettingsScreen() {
  const { t } = useTranslation();
  const { handleScroll, headerStyle, headerOpacity } = useScrollHeader();
  const [bypassPayment, setBypassPayment] = React.useState(false);
  const [mockNotifications, setMockNotifications] = React.useState(false);
  const [showDebug, setShowDebug] = React.useState(false);

  return (
    <View style={styles.root}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.title, { opacity: headerOpacity }]}>{t('admin.devSettings.title', 'Developer Settings')}</Text>
      </View>

      <ScrollView style={styles.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.devSettings.toggles', 'Feature Flags')}</Text>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t('admin.devSettings.bypassPayment', 'Bypass Payment')}</Text>
                <Text style={styles.sublabel}>{t('admin.devSettings.bypassPaymentDesc', 'Skip Stripe for testing')}</Text>
              </View>
              <Switch value={bypassPayment} onValueChange={setBypassPayment} trackColor={{ false: '#3e4045', true: theme.colors.primary }} />
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t('admin.devSettings.mockNotif', 'Mock Notifications')}</Text>
                <Text style={styles.sublabel}>{t('admin.devSettings.mockNotifDesc', 'Generate fake notifications')}</Text>
              </View>
              <Switch value={mockNotifications} onValueChange={setMockNotifications} trackColor={{ false: '#3e4045', true: theme.colors.primary }} />
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t('admin.devSettings.debug', 'Debug Mode')}</Text>
                <Text style={styles.sublabel}>{t('admin.devSettings.debugDesc', 'Show extra logs')}</Text>
              </View>
              <Switch value={showDebug} onValueChange={setShowDebug} trackColor={{ false: '#3e4045', true: theme.colors.primary }} />
            </View>
          </View>

          <View style={styles.warning}>
            <Ionicons name="warning-outline" size={20} color="#FCA5A5" />
            <Text style={styles.warningText}>{t('admin.devSettings.warning', 'These settings are for development only. Do not enable in production.')}</Text>
          </View>
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
  content: { paddingTop: 120, paddingHorizontal: 20 },
  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowText: { flex: 1, marginRight: 12 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  sublabel: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  separator: { height: 1, backgroundColor: theme.colors.border },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20, padding: 16, backgroundColor: 'rgba(252,165,165,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(252,165,165,0.2)' },
  warningText: { flex: 1, fontSize: 12, color: '#FCA5A5', lineHeight: 18 },
  footer: { height: 100 },
});
