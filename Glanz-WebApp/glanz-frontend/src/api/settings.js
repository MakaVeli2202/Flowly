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
    return response.data;
  }),

  getSmsSettings: async () => withRetry(async () => {
    const response = await apiClient.get('/Settings');
    return response.data?.sms ?? { followUpEnabled: false };
  }),

  updateSmsSettings: async ({ followUpEnabled }) => withRetry(async () => {
    const response = await apiClient.put('/Settings', { smsFollowUpEnabled: followUpEnabled });
    return response.data;
  }),

  updateBusinessConfig: async (config) => withRetry(async () => {
    const response = await apiClient.put('/Settings', { businessConfig: config });
    return response.data;
  }),
};