import {
  Clock, CheckCircle, XCircle, Package,
  Loader2, CreditCard, RefreshCw, AlertCircle,
} from 'lucide-react';

/**
 * Full status config — used everywhere a booking status needs to be displayed.
 *
 * `badge`  — complete Tailwind class string for <span> badges (bg + text + border).
 *            Designed to look correct on dark surfaces AND light surfaces.
 * `dot`    — Tailwind background class for the small coloured indicator dot.
 * `icon`   — Lucide icon component.
 * `label`  — Human-readable display label (matches the API string).
 * `description` — One-liner shown in tooltips or detail views.
 */
export const statusConfig = {
  Pending: {
    badge:       'bg-amber-500/12 text-amber-500 border border-amber-500/30',
    dot:         'bg-amber-400',
    icon:        Clock,
    label:       'Pending',
    description: 'Awaiting confirmation',
  },
  Confirmed: {
    badge:       'bg-blue-500/12 text-blue-400 border border-blue-500/30',
    dot:         'bg-blue-400',
    icon:        CheckCircle,
    label:       'Confirmed',
    description: 'Scheduled and confirmed',
  },
  InProgress: {
    badge:       'bg-violet-500/12 text-violet-400 border border-violet-500/30',
    dot:         'bg-violet-400',
    icon:        Loader2,
    label:       'In Progress',
    description: 'Detailer is on the job',
  },
  Paused: {
    badge:       'bg-orange-500/12 text-orange-400 border border-orange-500/30',
    dot:         'bg-orange-400',
    icon:        Clock,
    label:       'Paused',
    description: 'Job temporarily paused',
  },
  Completed: {
    badge:       'bg-green-500/12 text-green-400 border border-green-500/30',
    dot:         'bg-green-400',
    icon:        CheckCircle,
    label:       'Completed',
    description: 'Service finished successfully',
  },
  Cancelled: {
    badge:       'bg-red-500/12 text-red-400 border border-red-500/30',
    dot:         'bg-red-400',
    icon:        XCircle,
    label:       'Cancelled',
    description: 'Booking was cancelled',
  },
};

/**
 * Payment status config — used in admin booking detail rows and invoice views.
 *
 * Same `badge` / `dot` / `icon` / `label` structure as statusConfig.
 */
export const paymentStatusConfig = {
  PreAuthorized: {
    badge:  'bg-blue-500/12 text-blue-400 border border-blue-500/30',
    dot:    'bg-blue-400',
    icon:   CreditCard,
    label:  'Pre-Authorised',
  },
  Paid: {
    badge:  'bg-green-500/12 text-green-400 border border-green-500/30',
    dot:    'bg-green-400',
    icon:   CheckCircle,
    label:  'Paid',
  },
  Failed: {
    badge:  'bg-red-500/12 text-red-400 border border-red-500/30',
    dot:    'bg-red-400',
    icon:   AlertCircle,
    label:  'Failed',
  },
  Refunded: {
    badge:  'bg-slate-500/12 text-slate-400 border border-slate-500/30',
    dot:    'bg-slate-400',
    icon:   RefreshCw,
    label:  'Refunded',
  },
};

/** Fallback icon when a status key isn't in the config. */
export const defaultStatusIcon = Package;

/**
 * Get the full status entry, falling back gracefully for unknown values.
 *
 * @param {string} status
 * @returns {{ badge, dot, icon, label, description }}
 */
export const getStatusConfig = (status) =>
  statusConfig[status] ?? {
    badge:       'bg-slate-500/12 text-slate-400 border border-slate-500/30',
    dot:         'bg-slate-400',
    icon:        Package,
    label:       status || 'Unknown',
    description: '',
  };

/**
 * Get the payment status entry, falling back gracefully.
 *
 * @param {string} status
 */
export const getPaymentStatusConfig = (paymentStatus) =>
  paymentStatusConfig[paymentStatus] ?? {
    badge: 'bg-slate-500/12 text-slate-400 border border-slate-500/30',
    dot:   'bg-slate-400',
    icon:  CreditCard,
    label: paymentStatus || 'Unknown',
  };

// ─── Backward-compat shims ────────────────────────────────────────────────────
// Keep old export names so existing call sites don't break before migration.

/** @deprecated Use statusConfig[status].badge instead */
export const statusColors = Object.fromEntries(
  Object.entries(statusConfig).map(([k, v]) => [k, v.badge])
);

/** @deprecated Use paymentStatusConfig[status].badge instead */
export const paymentStatusColors = Object.fromEntries(
  Object.entries(paymentStatusConfig).map(([k, v]) => [k, v.badge])
);