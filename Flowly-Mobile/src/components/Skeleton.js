import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export function Skeleton({ width, height, radius = 8, style }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={styles.cardContent}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <Skeleton width="100%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

export function BookingCardSkeleton() {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingTitle}>
          <Skeleton width={100} height={18} />
          <Skeleton width={80} height={14} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={70} height={24} radius={12} />
      </View>
      <View style={styles.bookingRow}>
        <Skeleton width="45%" height={14} />
        <Skeleton width="45%" height={14} />
      </View>
      <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

export function ListSkeleton({ count = 3, ItemComponent = CardSkeleton }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </View>
  );
}

export function PackageCardSkeleton() {
  return (
    <View style={styles.packageCard}>
      <View style={styles.packageTop}>
        <Skeleton width={50} height={50} radius={12} />
        <View style={styles.packageContent}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="35%" height={13} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={24} radius={12} />
      </View>
      <Skeleton width="100%" height={1} style={{ marginVertical: 12 }} />
      <View style={styles.packageRow}>
        <Skeleton width="40%" height={13} />
        <Skeleton width="40%" height={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.card.bg,
  },
  card: {
    backgroundColor: theme.card.bg,
    borderWidth: 1,
    borderColor: theme.card.border,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  bookingCard: {
    backgroundColor: theme.card.bg,
    borderWidth: 1,
    borderColor: theme.card.border,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingTitle: {
    flex: 1,
  },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  packageCard: {
    backgroundColor: theme.card.bg,
    borderWidth: 1,
    borderColor: theme.card.border,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  packageTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageContent: {
    flex: 1,
    marginLeft: 12,
  },
  packageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});