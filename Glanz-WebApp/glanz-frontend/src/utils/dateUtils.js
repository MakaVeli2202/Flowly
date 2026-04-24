/**
 * Shared date utilities — Booking, AdminJobsScreen, NotificationsScreen, etc.
 *
 * All "date key" functions use YYYY-MM-DD in the LOCAL timezone, never UTC,
 * so they behave correctly regardless of where the server or user is located.
 */

// ─── Core key helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Date to a local YYYY-MM-DD string.
 * Uses local year/month/day — never touches UTC — so timezone-safe.
 *
 * @example toDateKey(new Date('2025-04-15T23:00:00+03:00')) → "2025-04-15"
 */
export const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
 * Return today's (or today + offsetDays) date key in local time.
 *
 * Fixed: the original used .toISOString() which converts to UTC first.
 * In UTC+3 (Qatar), local midnight → UTC 21:00 the previous day → wrong date.
 * Now uses toDateKey() which reads local year/month/day directly.
 *
 * @example toLocalIsoDate()    → "2025-04-15"  (today, local)
 * @example toLocalIsoDate(1)   → "2025-04-16"  (tomorrow, local)
 * @example toLocalIsoDate(-1)  → "2025-04-14"  (yesterday, local)
 */
export const toLocalIsoDate = (offsetDays = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return toDateKey(date); // ← was: date.toISOString().split('T')[0]  ← timezone bug fixed
};

// ─── Duration formatting ──────────────────────────────────────────────────────

/**
 * Format a duration in minutes as a human-readable string.
 *
 * @param {number}  rawMinutes
 * @param {'long'|'short'|'minutes'} [style='long']
 *   - 'long'    → "2h 30m (150 min)"   original verbose form, used in admin breakdowns
 *   - 'short'   → "2h 30m"             used in booking cards and package listings
 *   - 'minutes' → "150 min"            used in compact pill badges
 *
 * @example formatDuration(90)           → "1h 30m (90 min)"
 * @example formatDuration(90, 'short')  → "1h 30m"
 * @example formatDuration(45, 'short')  → "45m"
 * @example formatDuration(90, 'minutes')→ "90 min"
 */
export const formatDuration = (rawMinutes, style = 'long') => {
  const total   = Math.max(0, Math.floor(Number(rawMinutes) || 0));
  const hours   = Math.floor(total / 60);
  const minutes = total % 60;

  const hPart = hours   > 0 ? `${hours}h`   : '';
  const mPart = minutes > 0 ? `${minutes}m` : '';
  const hm    = [hPart, mPart].filter(Boolean).join(' ') || '0m';

  if (style === 'minutes') return `${total} min`;
  if (style === 'short')   return hm;
  return `${hm} (${total} min)`;                // 'long'
};

// Keep the original export name as an alias so existing call sites don't break.
export const formatMinutesAsHoursAndMinutes = (rawMinutes) =>
  formatDuration(rawMinutes, 'long');

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a date/time value for display in notification cards, booking history, etc.
 * Returns a short "Apr 15, 02:30 PM" string in the user's local timezone.
 *
 * Called from: NotificationsScreen, MyBookings
 *
 * @example formatDateTime('2025-04-15T11:30:00Z') → "Apr 15, 11:30 AM"
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
 * Format a date-only value for display.
 * @example formatDate('2025-04-15') → "Tue, Apr 15 2025"
 */
export const formatDate = (value, options = {}) => {
  const date = value instanceof Date ? value : parseDateKey(String(value ?? '').split('T')[0]);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric',
    ...options,
  });
};

// ─── Comparison helpers ───────────────────────────────────────────────────────

/** @returns {boolean} true if the given date key is today in local time */
export const isToday = (dateKey) =>
  dateKey === toLocalIsoDate(0);

/** @returns {number} number of calendar days from today to dateKey (negative = past) */
export const daysFromToday = (dateKey) => {
  const target = parseDateKey(dateKey);
  if (!target) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};