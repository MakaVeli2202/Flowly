import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';

/**
 * AlertsPanel — compact alerts + issues section.
 *
 * Props:
 *   alerts  Array<AlertItem>  List of alerts to display
 *   onPress (alert) => void   Tap callback for each alert row
 *   title   string            Optional panel title (default 'Alerts')
 *   max     number            Max items to show before truncation (default 5)
 *   onViewAll fn              Optional "view all" handler
 *
 * AlertItem shape:
 *   id       string|number
 *   type     'warning' | 'danger' | 'info' | 'success'
 *   icon     string   Ionicons name
 *   title    string
 *   body     string
 *   meta     string   Optional right-side meta text
 *   badge    string   Optional badge label
 */
export default function AlertsPanel({ alerts = [], onPress, title, max = 5, onViewAll }) {
  const { t } = useTranslation();
  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, max);
  const overflow = alerts.length - max;

  const typeStyles = {
    warning: { icon: theme.colors.warning, bg: theme.colors.warningBg, border: theme.colors.warningBorder },
    danger:  { icon: theme.colors.danger,  bg: theme.colors.dangerBg,  border: theme.colors.dangerBorder  },
    info:    { icon: theme.colors.info,    bg: theme.colors.infoBg,    border: theme.colors.infoBorder    },
    success: { icon: theme.colors.success, bg: theme.colors.successBg, border: theme.colors.successBorder },
  };

  return (
    <View style={a.panel}>
      {/* Panel header */}
      <View style={a.header}>
        <View style={a.titleRow}>
          <View style={a.titleIconBox}>
            <Ionicons name="warning" size={14} color={theme.colors.warning} />
          </View>
          <Text style={a.title}>{title || t('alertsPanel.title')}</Text>
          <View style={a.badge}>
            <Text style={a.badgeText}>{alerts.length}</Text>
          </View>
        </View>
        {!!onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={a.viewAll}>{t('alertsPanel.viewAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alert rows */}
      {visible.map((alert, idx) => {
        const ts = typeStyles[alert.type] || typeStyles.warning;
        const isLast = idx === visible.length - 1 && overflow <= 0;
        const row = (
          <View
            key={alert.id ?? idx}
            style={[a.row, { borderLeftColor: ts.icon }, !isLast && a.rowBorder]}
          >
            <View style={[a.alertIcon, { backgroundColor: ts.bg }]}>
              <Ionicons name={alert.icon || 'alert-circle-outline'} size={15} color={ts.icon} />
            </View>
            <View style={a.rowContent}>
              <View style={a.rowTop}>
                <Text style={a.rowTitle} numberOfLines={1}>{alert.title}</Text>
                {!!alert.badge && (
                  <View style={[a.rowBadge, { backgroundColor: ts.bg, borderColor: ts.border }]}>
                    <Text style={[a.rowBadgeText, { color: ts.icon }]}>{alert.badge}</Text>
                  </View>
                )}
              </View>
              {!!alert.body && (
                <Text style={a.rowBody} numberOfLines={2}>{alert.body}</Text>
              )}
            </View>
            {!!alert.meta && <Text style={a.rowMeta}>{alert.meta}</Text>}
            {!!onPress && <Ionicons name="chevron-forward" size={13} color={theme.colors.textMuted} style={{ opacity: 0.5 }} />}
          </View>
        );

        if (onPress) {
          return (
            <TouchableOpacity
              key={alert.id ?? idx}
              onPress={() => onPress(alert)}
              activeOpacity={0.7}
            >
              {row}
            </TouchableOpacity>
          );
        }
        return row;
      })}

      {overflow > 0 && (
        <TouchableOpacity style={a.overflowRow} onPress={onViewAll} activeOpacity={0.7}>
          <Text style={a.overflowText}>{t('alertsPanel.moreIssues', { count: overflow })}</Text>
          <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const a = StyleSheet.create({
  panel: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(28,18,0,0.70)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.12)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  titleIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: theme.colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.warningBg,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  viewAll: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  alertIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  rowBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rowBody: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    flexShrink: 0,
  },
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  overflowText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
