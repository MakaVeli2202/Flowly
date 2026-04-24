import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

export function GlassCard({
  children,
  style,
  intensity = 20,
  tint = 'dark',
  shimmer = false,
  padding = 16,
  borderRadius = null,
}) {
  const r = borderRadius ?? theme.radius.lg;

  return (
    <View style={[styles.wrapper, { borderRadius: r }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}
      >
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: theme.card.bg,
              borderRadius: r,
              borderWidth: 1,
              borderColor: theme.card.border,
            },
          ]}
        />
        {shimmer && (
          <View style={[styles.shimmer, { borderRadius: r }]} pointerEvents="none">
            <LinearGradient
              colors={[G(0.12), T(0.08), 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
      </BlurView>
      <View style={[styles.content, { padding, borderRadius: r }]}>{children}</View>
    </View>
  );
}

export function GlassCardPrism({ children, style, padding = 16 }) {
  const r = theme.radius.lg;
  return (
    <View style={[styles.wrapper, { borderRadius: r }, style]}>
      <BlurView
        intensity={20}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}
      >
        <View style={[styles.overlay, { borderRadius: r }]} />
      </BlurView>
      <View style={[styles.content, { padding, borderRadius: r }]}>
        <View style={styles.prismLine} />
        {children}
      </View>
    </View>
  );
}

export function PrismaticTopLine({ style }) {
  return (
    <View style={[styles.prismTopLineWrapper, style]}>
      <LinearGradient
        colors={['transparent', G(0.75), T(0.70), 'transparent']}
        locations={[0, 0.38, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.prismTopLine}
      />
    </View>
  );
}

export function GlassCardBase({
  children,
  style,
  padding = 16,
  borderRadius = null,
  shimmer = false,
}) {
  const r = borderRadius ?? theme.radius.lg;
  return (
    <View style={[styles.glassBase, { borderRadius: r }, style]}>
      {shimmer && (
        <LinearGradient
          colors={[G(0.07), T(0.05), 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
      )}
      <View style={[styles.content, { padding, borderRadius: r }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.card.bg,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    zIndex: 1,
  },
  prismLine: {
    height: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  prismTopLineWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 0,
  },
  prismTopLine: {
    height: 1.5,
  },
  glassBase: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: theme.card.bg,
    borderWidth: 1,
    borderColor: theme.card.border,
    ...theme.shadow.card,
  },
});