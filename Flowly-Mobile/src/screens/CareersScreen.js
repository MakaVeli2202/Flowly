import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { jobsAPI } from '../api/jobs';
import { useScrollHeader } from '../hooks/useScrollHeader';

export default function CareersScreen() {
  const { t } = useTranslation();
  const { handleScroll, headerStyle, headerOpacity } = useScrollHeader();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);

  const loadJobs = async () => {
    try {
      const data = await jobsAPI.getOpenPositions();
      setJobs(data || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);

  const onRefresh = () => { setRefreshing(true); loadJobs(); };

  return (
    <View style={styles.root}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.title, { opacity: headerOpacity }]}>{t('careers.title', 'Careers')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('careers.hero.title', 'Join Our Team')}</Text>
          <Text style={styles.heroSubtitle}>{t('careers.hero.subtitle', 'Build your career with Flowly')}</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
        ) : jobs.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="briefcase-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.empty}>{t('careers.noOpenings', 'No open positions at the moment')}</Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {jobs.map((job) => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <View style={styles.jobType}>
                    <Text style={styles.jobTypeText}>{job.type || 'Full-time'}</Text>
                  </View>
                </View>
                <Text style={styles.jobDescription}>{job.description}</Text>
                <View style={styles.jobMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.metaText}>{job.location || 'On-site'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.metaText}>{job.salary || 'Competitive'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8}>
                  <Text style={styles.applyText}>{t('careers.applyNow', 'Apply Now')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: theme.colors.bg },
  header:      { position: 'absolute', top: 0, left: 0, right: 0, height: 100, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
  title:       { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  scroll:       { flex: 1 },
  hero:        { paddingTop: 120, paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  heroTitle:   { fontSize: 32, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
  center:      { paddingTop: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty:       { color: theme.colors.textMuted, fontSize: 15, marginTop: 12 },
  jobsList:    { paddingHorizontal: 20, gap: 16 },
  jobCard:     { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  jobHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  jobTitle:    { fontSize: 18, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 12 },
  jobType:     { backgroundColor: 'rgba(200,169,107,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  jobTypeText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  jobDescription: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 16 },
  jobMeta:     { flexDirection: 'row', gap: 20, marginBottom: 16 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:    { fontSize: 13, color: theme.colors.textMuted },
  applyBtn:    { backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  applyText:   { color: '#000', fontSize: 15, fontWeight: '700' },
  footer:      { height: 100 },
});
