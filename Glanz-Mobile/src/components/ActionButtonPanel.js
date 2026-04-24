import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

const G = (a) => `rgba(200,169,107,${a})`;

/**
 * ActionButtonPanel — mobile-first quick action grid.
 *
 * Props:
 *   actions  Array<ActionItem>  List of actions to display
 *   columns  number             Grid columns (default 2)
 *   title    string             Optional panel title
 *
 * ActionItem shape:
 *   id       string
 *   icon     string   Ionicons name
 *   label    string   Short button label
 *   onPress  fn
 *   primary  bool     Use gradient style for primary action
 *   color    string   Custom icon/accent color
 *   badge    number   Optional badge count
 *   disabled bool
 */
export default function ActionButtonPanel({ actions = [], columns = 2, title }) {
  if (actions.length === 0) return null;

  return (
    <View style={p.container}>
      {!!title && (
        <View style={p.header}>
          <View style={p.headerLine} />
          <Text style={p.headerTitle}>{title}</Text>
          <View style={p.headerLine} />
        </View>
      )}
      <View style={[p.grid, { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }]}>
        {actions.map((action) => (
          <ActionButton key={action.id} action={action} columns={columns} />
        ))}
      </View>
    </View>
  );
}

function ActionButton({ action, columns }) {
  const { icon, label, onPress, primary, color, badge, disabled } = action;
  const accentColor = color || theme.colors.primary;
  const btnWidth = `${Math.floor(100 / columns) - 3}%`;

  if (primary) {
    return (
      <View style={[p.primaryWrap, { width: btnWidth, opacity: disabled ? 0.5 : 1 }]}>
        <LinearGradient
          colors={[theme.colors.primary, G(0.75)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <TouchableOpacity
          style={p.primaryTouch}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name={icon} size={20} color={theme.colors.ink} />
          <Text style={p.primaryLabel} numberOfLines={1}>{label}</Text>
          {badge > 0 && (
            <View style={p.badge}>
              <Text style={p.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[p.btn, { width: btnWidth, borderColor: `${accentColor}30`, opacity: disabled ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <LinearGradient
        colors={[`${accentColor}10`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[p.iconBox, { backgroundColor: `${accentColor}15` }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
        {badge > 0 && (
          <View style={p.iconBadge}>
            <Text style={p.iconBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[p.label, { color: theme.colors.text }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const p = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {},
  /* Normal action button */
  btn: {
    flexShrink: 1,
    flexGrow: 1,
    minHeight: 76,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  iconBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  iconBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  /* Primary gradient button */
  primaryWrap: {
    flexShrink: 1,
    flexGrow: 1,
    minHeight: 76,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryTouch: {
    flex: 1,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  primaryLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
