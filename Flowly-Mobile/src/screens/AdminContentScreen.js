// AdminContentScreen.js — Mobile version of AdminContent.jsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { theme } from '../theme/theme';

const PADDING = 20;

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Default content (same as web) ──────────────────────────── */
const DEFAULT_CONTENT = {
  homePageContent: {
    badge: 'Premium Vehicle Care',
    title: 'Professional Vehicle Cleaning & Detailing',
    description: 'Expert care for your vehicle. We come to you with professional-grade tools and eco-friendly products.',
    primaryCta: 'Book Now',
    secondaryCta: 'View Packages',
    curatedTitle: 'Curated Services',
    curatedDescription: 'Packages designed for maximum shine with minimum effort.',
    curatedCta: 'Explore',
    finalTitle: 'Ready to Transform Your Ride?',
    finalDescription: 'Book your first appointment today and experience the Flowly difference.',
    finalCta: 'Get Started',
  },
  packagesPageContent: {
    title: 'Choose Your Package',
    subtitle: 'Select the perfect package for your vehicle',
    allTierLabel: 'All Tiers',
    emptyTierMessage: 'No packages available in this tier',
    includesLabel: 'What\'s Included',
    fromOnlyLabel: 'From',
    moreServicesText: 'More Services Available',
  },
  bookingPageConfig: {
    earliestBookingOffsetDays: 1,
    timeSlots: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  },
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
    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 }}
    pointerEvents="none"
  />
);

/* ── Atoms ──────────────────────────────────────────────── */
const Eyebrow = ({ children }) => (
  <View style={u.eyebrow}>
    <LinearGradient colors={['transparent', G(0.70)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
    <Text style={u.eyebrowText}>{children}</Text>
    <LinearGradient colors={[G(0.70), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.eyebrowLine} />
  </View>
);

const SectionLabel = ({ children }) => (
  <View style={u.sectionLabelRow}>
    <Text style={u.sectionLabel}>{children}</Text>
    <LinearGradient colors={['transparent', G(0.55)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={u.sectionDivider} />
  </View>
);

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function AdminContentScreen() {
  const headerHeight = useHeaderHeight();

  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [form, setForm] = useState({
    ...DEFAULT_CONTENT.homePageContent,
    ...DEFAULT_CONTENT.packagesPageContent,
    bookingEarliestOffsetDays: String(DEFAULT_CONTENT.bookingPageConfig.earliestBookingOffsetDays),
    bookingTimeSlots: DEFAULT_CONTENT.bookingPageConfig.timeSlots.join(', '),
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const newContent = {
        homePageContent: {
          badge: form.badge,
          title: form.title,
          description: form.description,
          primaryCta: form.primaryCta,
          secondaryCta: form.secondaryCta,
          curatedTitle: form.curatedTitle,
          curatedDescription: form.curatedDescription,
          curatedCta: form.curatedCta,
          finalTitle: form.finalTitle,
          finalDescription: form.finalDescription,
          finalCta: form.finalCta,
        },
        packagesPageContent: {
          title: form.packagesTitle,
          subtitle: form.packagesSubtitle,
          allTierLabel: form.allTierLabel,
          emptyTierMessage: form.emptyTierMessage,
          includesLabel: form.includesLabel,
          fromOnlyLabel: form.fromOnlyLabel,
          moreServicesText: form.moreServicesText,
        },
        bookingPageConfig: {
          earliestBookingOffsetDays: parseInt(form.bookingEarliestOffsetDays, 10) || 1,
          timeSlots: form.bookingTimeSlots.split(',').map(s => s.trim()).filter(Boolean),
        },
      };
      setContent(newContent);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('Error', 'Failed to save content.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Content', 'Reset all content to defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          setForm({
            ...DEFAULT_CONTENT.homePageContent,
            ...DEFAULT_CONTENT.packagesPageContent,
            bookingEarliestOffsetDays: String(DEFAULT_CONTENT.bookingPageConfig.earliestBookingOffsetDays),
            bookingTimeSlots: DEFAULT_CONTENT.bookingPageConfig.timeSlots.join(', '),
          });
        }
      }
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  const tabs = [
    { key: 'home', label: 'Home Page' },
    { key: 'packages', label: 'Packages' },
    { key: 'booking', label: 'Booking' },
  ];

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Eyebrow>ADMIN PANEL</Eyebrow>
          <View style={s.titleRow}>
            <LinearGradient colors={[G(0.14), T(0.09)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titleIconBox}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
            </LinearGradient>
            <Text style={s.heading}>Content</Text>
          </View>
          <Text style={s.sub}>Manage site text and labels</Text>
          <SpectrumLine style={{ marginTop: 14 }} />
        </View>

        {/* ── Tabs ────────���─────────────────────────────── */}
        <View style={s.tabsRow}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Success banner ──────────────────────────────── */}
        {saved && (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={14} color="#86EFAC" />
            <Text style={s.successText}>Content saved successfully!</Text>
          </View>
        )}

        {/* ── Home Page Content ──────────────────────── */}
        {activeTab === 'home' && (
          <View style={s.card}>
            <SectionLabel>Hero Section</SectionLabel>
            <Text style={s.fieldLabel}>Badge</Text>
            <TextInput style={s.input} value={form.badge} onChangeText={v => setForm(p => ({ ...p, badge: v }))} placeholder="e.g. Premium Vehicle Care" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput style={s.input} value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} placeholder="Main headline" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={[s.input, s.textArea]} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Page description" placeholderTextColor={theme.colors.textMuted} multiline numberOfLines={3} />

            <SectionLabel>Buttons</SectionLabel>
            <View style={s.row}>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Primary CTA</Text>
                <TextInput style={s.input} value={form.primaryCta} onChangeText={v => setForm(p => ({ ...p, primaryCta: v }))} placeholder="Book Now" placeholderTextColor={theme.colors.textMuted} />
              </View>
              <View style={s.col}>
                <Text style={s.fieldLabel}>Secondary CTA</Text>
                <TextInput style={s.input} value={form.secondaryCta} onChangeText={v => setForm(p => ({ ...p, secondaryCta: v }))} placeholder="View Packages" placeholderTextColor={theme.colors.textMuted} />
              </View>
            </View>

            <SectionLabel>Curated Section</SectionLabel>
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput style={s.input} value={form.curatedTitle} onChangeText={v => setForm(p => ({ ...p, curatedTitle: v }))} placeholder="Curated Services" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={s.input} value={form.curatedDescription} onChangeText={v => setForm(p => ({ ...p, curatedDescription: v }))} placeholder="Curated description" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>CTA</Text>
            <TextInput style={s.input} value={form.curatedCta} onChangeText={v => setForm(p => ({ ...p, curatedCta: v }))} placeholder="Explore" placeholderTextColor={theme.colors.textMuted} />

            <SectionLabel>Bottom Section</SectionLabel>
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput style={s.input} value={form.finalTitle} onChangeText={v => setForm(p => ({ ...p, finalTitle: v }))} placeholder="Ready to transform?" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput style={s.input} value={form.finalDescription} onChangeText={v => setForm(p => ({ ...p, finalDescription: v }))} placeholder="Final description" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>CTA</Text>
            <TextInput style={s.input} value={form.finalCta} onChangeText={v => setForm(p => ({ ...p, finalCta: v }))} placeholder="Get Started" placeholderTextColor={theme.colors.textMuted} />
          </View>
        )}

        {/* ── Packages Page Content ──────────────────────── */}
        {activeTab === 'packages' && (
          <View style={s.card}>
            <SectionLabel>Page Header</SectionLabel>
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput style={s.input} value={form.packagesTitle} onChangeText={v => setForm(p => ({ ...p, packagesTitle: v }))} placeholder="Choose Your Package" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Subtitle</Text>
            <TextInput style={s.input} value={form.packagesSubtitle} onChangeText={v => setForm(p => ({ ...p, packagesSubtitle: v }))} placeholder="Select the perfect package" placeholderTextColor={theme.colors.textMuted} />

            <SectionLabel>Labels</SectionLabel>
            <Text style={s.fieldLabel}>All Tier Label</Text>
            <TextInput style={s.input} value={form.allTierLabel} onChangeText={v => setForm(p => ({ ...p, allTierLabel: v }))} placeholder="All Tiers" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Empty Tier Message</Text>
            <TextInput style={s.input} value={form.emptyTierMessage} onChangeText={v => setForm(p => ({ ...p, emptyTierMessage: v }))} placeholder="No packages in this tier" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>Includes Label</Text>
            <TextInput style={s.input} value={form.includesLabel} onChangeText={v => setForm(p => ({ ...p, includesLabel: v }))} placeholder="What's Included" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>From Only Label</Text>
            <TextInput style={s.input} value={form.fromOnlyLabel} onChangeText={v => setForm(p => ({ ...p, fromOnlyLabel: v }))} placeholder="From" placeholderTextColor={theme.colors.textMuted} />
            <Text style={s.fieldLabel}>More Services Text</Text>
            <TextInput style={s.input} value={form.moreServicesText} onChangeText={v => setForm(p => ({ ...p, moreServicesText: v }))} placeholder="More Services" placeholderTextColor={theme.colors.textMuted} />
          </View>
        )}

        {/* ── Booking Page Content ────────────────────── */}
        {activeTab === 'booking' && (
          <View style={s.card}>
            <SectionLabel>Time Slots</SectionLabel>
            <Text style={s.fieldLabel}>Earliest Offset (days)</Text>
            <TextInput style={s.input} value={form.bookingEarliestOffsetDays} onChangeText={v => setForm(p => ({ ...p, bookingEarliestOffsetDays: v }))} placeholder="1" placeholderTextColor={theme.colors.textMuted} keyboardType="numeric" />
            <Text style={s.fieldLabel}>Time Slots (comma separated)</Text>
            <TextInput style={[s.input, s.textArea]} value={form.bookingTimeSlots} onChangeText={v => setForm(p => ({ ...p, bookingTimeSlots: v }))} placeholder="09:00, 10:00, 11:00..." placeholderTextColor={theme.colors.textMuted} multiline />
          </View>
        )}

        {/* ── Actions ──────────────────────────────────── */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
            <Text style={s.resetBtnText}>Reset to Default</Text>
          </TouchableOpacity>
          <View style={s.saveBtnWrap}>
            <LinearGradient colors={[theme.colors.primary, G(0.82)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            <TouchableOpacity style={s.saveBtnTouch} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.ink} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={15} color={theme.colors.ink} />
                  <Text style={s.saveBtnText}>Save Content</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

/* ── Shared atoms ─────────────────────────────────────────── */
const u = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  eyebrowLine: { height: 1, width: 24 },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.primary },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 },
  sectionLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  sectionDivider: { flex: 1, height: 1, borderRadius: 1 },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  pageHeader: { marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  titleIconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G(0.30) },
  heading: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 14 },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: theme.colors.ink },

  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, backgroundColor: 'rgba(20,83,45,0.22)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)', borderRadius: 12, padding: 12 },
  successText: { color: '#86EFAC', fontSize: 13, fontWeight: '600' },

  card: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 16, marginBottom: 14 },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, paddingHorizontal: 13, paddingVertical: 12, color: theme.colors.text, fontSize: 14, marginBottom: 12 },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  actionsRow: { flexDirection: 'row', gap: 10, position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: theme.colors.bg, borderTopWidth: 1, borderTopColor: theme.colors.border },
  resetBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 14 },
  saveBtnWrap: { flex: 2, borderRadius: 13, overflow: 'hidden' },
  saveBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13 },
  saveBtnText: { color: theme.colors.ink, fontWeight: '800', fontSize: 14 },
});