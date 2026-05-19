/**
 * Shared date/time utilities — used across Booking, MyBookings,
 * NotificationsScreen, AdminJobsScreen, and others.
 */

// ─── Core key helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Date to a local YYYY-MM-DD string.
 * Reads local year/month/day — never touches UTC — so timezone-safe.
 * Returns '' for invalid input instead of throwing.
 *
 * @example toDateKey(new Date(2025, 3, 15)) → "2025-04-15"
 */
export const toDateKey = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a local YYYY-MM-DD string into a midnight-local Date.
 * Returns null for invalid / missing input instead of throwing.
 *
 * @example parseDateKey('2025-04-15') → new Date(2025, 3, 15)
 */
export const parseDateKey = (dateKey) => {
  if (!dateKey || typeof dateKey !== 'string') return null;
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

/**
 * Return tomorrow's YYYY-MM-DD key in local time.
 */
export const tomorrowKey = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return toDateKey(d);
};

// ─── Comparison helpers ───────────────────────────────────────────────────────

/** true if the given YYYY-MM-DD key is today in local time. */
export const isToday = (dateKey) =>
  !!dateKey && dateKey === toDateKey(new Date());

/**
 * Number of calendar days from today to dateKey.
 * Negative = past, 0 = today, positive = future.
 */
export const daysFromToday = (dateKey) => {
  const target = parseDateKey(dateKey);
  if (!target) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a date/time value to "Apr 15, 02:30 PM".
 * Uses 'en-US' explicitly so output is consistent across devices.
 * Returns '—' for missing or invalid values.
 */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format a date value to "Apr 15, 2025".
 * Returns '—' for missing or invalid values.
 */
export const formatDate = (value, options = {}) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : parseDateKey(String(value).split('T')[0]);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
    ...options,
  });
};

/**
 * Convert a time slot "10:00-11:00" → "10:00 AM – 11:00 AM".
 * Handles single-time strings gracefully.
 */
export const formatTimeSlot = (slot) => {
  if (!slot) return '';
  const parts = String(slot).split('-');
  const to12 = (t) => {
    const [h, m] = t.trim().split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return t.trim();
    const period = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };
  return parts.length >= 2
    ? `${to12(parts[0])} – ${to12(parts[1])}`
    : to12(parts[0]);
};

// ─── Duration helpers ─────────────────────────────────────────────────────────

/**
 * Format a duration in minutes as a human-readable string.
 *
 * @param {number}  rawMinutes
 * @param {'long'|'short'|'minutes'} [style='short']
 *   - 'long'    → "1h 30m (90 min)"   admin breakdowns
 *   - 'short'   → "1h 30m"            booking cards and package listings
 *   - 'minutes' → "90 min"            compact pill badges
 *
 * @example formatDuration(90)           → "1h 30m"
 * @example formatDuration(90, 'long')   → "1h 30m (90 min)"
 * @example formatDuration(45, 'minutes')→ "45 min"
 * @example formatDuration(60, 'short')  → "1h"
 */
export const formatDuration = (rawMinutes, style = 'short') => {
  const total   = Math.max(0, Math.floor(Number(rawMinutes) || 0));
  const hours   = Math.floor(total / 60);
  const minutes = total % 60;

  const hPart = hours   > 0 ? `${hours}h`   : '';
  const mPart = minutes > 0 ? `${minutes}m` : '';
  const hm    = [hPart, mPart].filter(Boolean).join(' ') || '0m';

  if (style === 'minutes') return `${total} min`;
  if (style === 'long')    return `${hm} (${total} min)`;
  return hm;
};

// ─── Time arithmetic ──────────────────────────────────────────────────────────

/**
 * Calculate the end time given a "HH:MM" start and duration in minutes.
 * Returns '' for invalid input.
 *
 * @example calculateEndTime('10:00', 90) → "11:30"
 */
export const calculateEndTime = (startTime, durationMinutes) => {
  if (!startTime || !durationMinutes) return '';
  const match = String(startTime).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const totalMins = Number(match[1]) * 60 + Number(match[2]) + Math.max(0, Number(durationMinutes));
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};