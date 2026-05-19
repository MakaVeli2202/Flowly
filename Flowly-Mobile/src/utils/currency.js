// ─── Memoised formatter (constructed once, reused on every call) ──────────────
// Intl.NumberFormat construction is expensive — module-level avoids per-render cost.
const _standard = new Intl.NumberFormat('en-QA', {
  style:                 'currency',
  currency:              'QAR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const _compact = new Intl.NumberFormat('en-QA', {
  style:                'currency',
  currency:             'QAR',
  notation:             'compact',
  maximumFractionDigits: 1,
});

// ─── Safe numeric coercion ────────────────────────────────────────────────────
// Returns 0 for null / undefined / NaN / Infinity so formatters never throw.
const toSafeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Standard QAR amount.
 * @example formatQAR(1500)   → "QAR 1,500"
 * @example formatQAR(1500.5) → "QAR 1,500.50"
 * @example formatQAR(null)   → "QAR 0"
 */
export const formatQAR = (value) =>
  _standard.format(toSafeNumber(value));

/**
 * Compact QAR for dashboard stat cards.
 * @example formatCompactQAR(1500000) → "QAR 1.5M"
 * @example formatCompactQAR(12500)   → "QAR 12.5K"
 */
export const formatCompactQAR = (value) =>
  _compact.format(toSafeNumber(value));

/**
 * Signed QAR difference — for revenue change indicators.
 * @example formatQARDiff(500)  → "+QAR 500"
 * @example formatQARDiff(-200) → "-QAR 200"
 * @example formatQARDiff(0)    → "QAR 0"
 */
export const formatQARDiff = (value) => {
  const n = toSafeNumber(value);
  const formatted = _standard.format(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};