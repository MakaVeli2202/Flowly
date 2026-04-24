/**
 * Booking status color maps shared across customer and admin screens.
 */

/** Badge background + text colors for booking status pills. */
export const bookingStatusColors = {
  Pending:               { bg: '#FBBF24', text: '#111827' },
  Confirmed:             { bg: '#60A5FA', text: '#111827' },
  Assigned:              { bg: '#38BDF8', text: '#111827' },
  InProgress:            { bg: '#C084FC', text: '#111827' },
  Completed:             { bg: '#84CC16', text: '#111827' },
  Cancelled:             { bg: '#F87171', text: '#111827' },
  CancellationRequested: { bg: '#FB923C', text: '#111827' },
  RescheduleRequested:   { bg: '#FBBF24', text: '#111827' },
  Rescheduled:           { bg: '#60A5FA', text: '#111827' },
  AwaitingPayment:       { bg: '#A78BFA', text: '#111827' },
  Failed:                { bg: '#F87171', text: '#111827' },
};

/** Fallback for unknown statuses. */
export const defaultStatusColor = { bg: '#9CA3AF', text: '#111827' };

/** Returns the color pair for a given booking status string. */
export const getStatusColor = (status) =>
  bookingStatusColors[status] || defaultStatusColor;
