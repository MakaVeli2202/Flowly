import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { referralAPI } from '../api/referral';
import { theme } from '../theme/theme';

export default function ReferralScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [copied, setCopied] = useState(false);

  const isUnlocked = referralData?.referralCodeUnlocked;

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      const data = await referralAPI.getMyReferrals();
      setReferralData(data);
    } catch (err) {
      console.error('Load referrals error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!referralData?.referralCode) return;
    Clipboard.setString(referralData.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    const code = referralData?.referralCode;
    if (!code) return;
    
    const text = `Use my referral code ${code} for exclusive discounts on Flowly car detailing services!`;
    
    Share.share({
      message: text,
      title: 'Flowly Referral',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Referrals</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Referral Code Card */}
      <View style={isUnlocked ? styles.unlockedCard : styles.lockedCard}>
        <View style={styles.cardHeader}>
          <Ionicons name={isUnlocked ? "gift" : "lock-closed"} size={24} color="#fff" />
          <Text style={styles.cardTitle}>
            {isUnlocked ? 'Your Referral Code' : 'Referral Code Locked'}
          </Text>
        </View>

        <View style={styles.codeContainer}>
          <Text style={[styles.referralCode, !isUnlocked && styles.referralCodeLocked]}>
            {referralData?.referralCode || '...'}
          </Text>
          <Text style={styles.codeSubtext}>
            {isUnlocked
              ? 'Share this code with friends and earn rewards after their first booking'
              : 'Complete your first service to unlock sharing'}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.outlineButton, !isUnlocked && styles.buttonDisabled]}
            onPress={isUnlocked ? copyCode : undefined}
            disabled={!isUnlocked}
          >
            <Ionicons name={copied ? "checkmark" : "copy"} size={18} color="#fff" />
            <Text style={styles.buttonText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, !isUnlocked && styles.bookNowButton]}
            onPress={isUnlocked ? shareCode : () => navigation.navigate('Booking')}
          >
            <Ionicons
              name={isUnlocked ? "share-social" : "sparkles"}
              size={18}
              color={theme.colors.primary}
            />
            <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
              {isUnlocked ? 'Share' : 'Book Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isUnlocked && (
          <View style={styles.rewardBadge}>
            <Ionicons name="gift" size={16} color="#fff" />
            <Text style={styles.rewardText}>Earn rewards when you refer friends</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={20} color={theme.colors.primary} />
          <Text style={styles.statValue}>{referralData?.totalReferrals || 0}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.statValue}>{referralData?.successfulReferrals || 0}</Text>
          <Text style={styles.statLabel}>Successful</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="card" size={20} color={theme.colors.primary} />
          <Text style={styles.statValue}>{referralData?.totalEarned || 0} QAR</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      {/* Referral History */}
      {referralData?.referrals?.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Your Referrals</Text>
          {referralData.referrals.map((ref, idx) => (
            <View key={idx} style={styles.historyItem}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyName}>{ref.referredEmail}</Text>
                <Text style={styles.historyDate}>
                  {ref.referredAt ? new Date(ref.referredAt).toLocaleDateString() : '-'}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                ref.status === 'Rewarded' && styles.statusRewarded,
                ref.status === 'Active' && styles.statusActive,
                ref.status === 'Pending' && styles.statusPending,
              ]}>
                <Text style={styles.statusText}>{ref.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  backBtn: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  unlockedCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  lockedCard: {
    backgroundColor: '#6366f1',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  referralCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 8,
  },
  codeSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  outlineButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  primaryButton: {
    backgroundColor: '#fff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  lockedContent: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  lockedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  rewardText: {
    fontSize: 12,
    color: '#fff',
  },
  referralCodeLocked: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  bookNowButton: {
    backgroundColor: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  historySection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusRewarded: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  statusActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  statusPending: {
    backgroundColor: 'rgba(234,179,8,0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text,
  },
});