import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/**
 * StatsCard — mobile-first KPI metric card.
 *
 * Props:
 *   icon        string   Ionicons icon name
 *   label       string   Short metric label
 *   value       string|number  Primary metric value
 *   sub         string   Optional sub-label below value
 *   color       string   Accent color (defaults to primary gold)
 *   onPress     fn       Optional tap handler (makes card tappable)
 *   size        'sm'|'md'|'lg'  Card size variant (default 'md')
 *   trend       'up'|'down'|null  Optional trend arrow
 *   trendLabel  string   Text beside trend arrow
 */
export default function StatsCard({
  icon,
  label,
  value,
  sub,
  color = theme.colors.primary,
  onPress,
  size = 'md',
  trend,
  trendLabel,
}) {
  const cardStyle  = [c.card, size === 'sm' && c.cardSm, size === 'lg' && c.cardLg];
  const valueStyle = [c.value, size === 'sm' && c.valueSm, size === 'lg' && c.valueLg, { color }];

  const inner = (
    <>
      {/* Prism top line */}
      <LinearGradient
        colors={['transparent', `${color}90`, 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={c.topLine}
        pointerEvents="none"
      />
      {/* Background tint */}
      <LinearGradient
        colors={[`${color}12`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={[c.iconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18} color={color} />
      </View>

      <Text style={c.label} numberOfLines={1}>{label}</Text>
      <Text style={valueStyle} numberOfLines={1}>{value ?? '—'}</Text>

      {(!!sub || !!trend) && (
        <View style={c.footer}>
          {!!trend && (
            <View style={c.trendRow}>
              <Ionicons
                name={trend === 'up' ? 'trending-up' : 'trending-down'}
                size={12}
                color={trend === 'up' ? theme.colors.success : theme.colors.danger}
              />
              {!!trendLabel && (
                <Text style={[c.trendText, { color: trend === 'up' ? theme.colors.success : theme.colors.danger }]}>
                  {trendLabel}
                </Text>
              )}
            </View>
          )}
          {!!sub && <Text style={c.sub} numberOfLines={1}>{sub}</Text>}
        </View>
      )}

      {!!onPress && (
        <View style={c.chevron}>
          <Ionicons name="chevron-forward" size={12} color={color} style={{ opacity: 0.5 }} />
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{inner}</View>;
}

const c = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSm: {
    minWidth: '30%',
    padding: 10,
    borderRadius: theme.radius.md,
  },
  cardLg: {
    minWidth: '100%',
    padding: 18,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    zIndex: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
  },
  valueSm: {
    fontSize: 18,
  },
  valueLg: {
    fontSize: 28,
  },
  sub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
});
