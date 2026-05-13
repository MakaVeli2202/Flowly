import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const settingsAPI = {
  getCancellationPolicy: async () => withRetry(async () => {
    const response = await apiClient.get('/AdminSettings/cancellation-policy');
    return response.data;
  }),

  updateCancellationPolicy: async (dto) => withRetry(async () => {
    const response = await apiClient.put('/AdminSettings/cancellation-policy', dto);
    return response.data;
  }),

  getSystemSettings: async () => withRetry(async () => {
    const response = await apiClient.get('/Settings');
    return response.data;
  }),

  updateSystemSettings: async (data) => withRetry(async () => {
    const response = await apiClient.put('/Settings', data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('system-settings-changed'));
    }
    return response.data;
  }),

  getSmsSettings: async () => withRetry(async () => {
    const response = await apiClient.get('/Settings');
    return response.data?.sms ?? { followUpEnabled: false };
  }),

  updateSmsSettings: async ({ followUpEnabled }) => withRetry(async () => {
    return settingsAPI.updateSystemSettings({ SmsFollowUpEnabled: followUpEnabled });
  }),

  updateBusinessConfig: async (config) => withRetry(async () => {
    return settingsAPI.updateSystemSettings({ BusinessConfig: config });
  }),

  getDatabaseStats: async () => withRetry(async () => {
    const response = await apiClient.get('/AdminSettings/database-stats');
    return response.data;
  }),

  resetDatabase: async (password, mode) => {
    const response = await apiClient.post('/AdminSettings/reset-database', { password, mode });
    return response.data;
  },
};