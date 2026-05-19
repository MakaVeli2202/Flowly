import apiClient from './axios';

/**
 * System settings API — admin-configurable values that drive the scheduling engine.
 *
 * Key settings:
 *   defaultBufferMinutes  — gap enforced after every booking before a worker is
 *                           considered available again (e.g. 30).
 */
export const settingsAPI = {
  /** Fetch current system settings. */
  getSystemSettings: async () => (await apiClient.get('/Settings')).data,

  /** Persist updated system settings. */
  updateSystemSettings: async (data) => (await apiClient.put('/Settings', data)).data,
};
