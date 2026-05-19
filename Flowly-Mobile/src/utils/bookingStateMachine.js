/**
 * Booking State Machine
 *
 * Single source of truth for valid booking status transitions.
 * Used by AdminJobsScreen (admin transitions) and MyBookingsScreen (customer actions).
 *
 * The server should enforce these too — this client-side guard is a fast-fail
 * to prevent accidental bad API calls during development and normal usage.
 *
 * Statuses that exist in this system:
 *   AwaitingPayment, Pending, Confirmed, Assigned, InProgress, Completed,
 *   CancellationRequested, RescheduleRequested, Rescheduled, Cancelled, Failed
 *
 * Note: 'Paused' is a worker-side UI state only — it does not persist to the server.
 */

// ── Allowed transitions by role ──────────────────────────────────────────────

/**
 * Admin-allowed transitions.
 * Matches the statusOptions array in AdminJobsScreen plus request resolution flows.
 */
const ADMIN_TRANSITIONS = {
  AwaitingPayment:       ['Pending', 'Cancelled'],
  Pending:               ['Confirmed', 'Cancelled'],
  Confirmed:             ['Assigned', 'InProgress', 'Completed', 'Cancelled'],
  Assigned:              ['InProgress', 'Completed', 'Cancelled'],
  InProgress:            ['Completed', 'Confirmed', 'Cancelled'],  // Confirmed = admin undo currently used in UI
  Completed:             ['Confirmed'],  // Admin undo — special case actively used in AdminJobsScreen
  CancellationRequested: ['Cancelled', 'Confirmed'],
  RescheduleRequested:   ['Confirmed', 'Cancelled'],
  Rescheduled:           ['Confirmed', 'Cancelled'],
  // Terminal — no forward transitions
  Cancelled:             [],
  Failed:                [],
};

/**
 * Worker-allowed transitions.
 * Workers move jobs along the work lifecycle only.
 */
const WORKER_TRANSITIONS = {
  Confirmed:  ['InProgress'],
  Assigned:   ['InProgress'],
  InProgress: ['Completed'],
  // All others: not allowed for workers
};

/**
 * Customer-allowed actions (these create REQUEST statuses, not direct transitions).
 * Customers don't call updateStatus — they call requestCancellation / requestReschedule.
 * This is informational for UI guards (show/hide action buttons).
 */
const CUSTOMER_ACTIONABLE_STATUSES = new Set([
  'Pending',
  'Confirmed',
  'Assigned',
]);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if the transition from → to is valid for the given role.
 * Defaults to admin role if not specified.
 *
 * @param {string} fromStatus  Current booking status
 * @param {string} toStatus    Target booking status
 * @param {'admin'|'worker'} role
 * @returns {boolean}
 */
export function canTransition(fromStatus, toStatus, role = 'admin') {
  const table = role === 'worker' ? WORKER_TRANSITIONS : ADMIN_TRANSITIONS;
  const allowed = table[fromStatus];
  if (!allowed) return false;  // unknown current status — block
  return allowed.includes(toStatus);
}

/**
 * Returns the list of valid next statuses for a given current status and role.
 *
 * @param {string} fromStatus
 * @param {'admin'|'worker'} role
 * @returns {string[]}
 */
export function getAllowedTransitions(fromStatus, role = 'admin') {
  const table = role === 'worker' ? WORKER_TRANSITIONS : ADMIN_TRANSITIONS;
  return table[fromStatus] ?? [];
}

/**
 * Returns true if a customer can request cancellation or reschedule
 * for a booking in the given status.
 *
 * @param {string} status
 * @returns {boolean}
 */
export function isCustomerActionable(status) {
  return CUSTOMER_ACTIONABLE_STATUSES.has(status);
}

/**
 * Returns true if the status is terminal (no further transitions possible).
 *
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  return status === 'Cancelled' || status === 'Failed';
}
