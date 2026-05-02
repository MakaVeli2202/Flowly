import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const servicesAPI = {
  getAll: async (lang) => withRetry(async () => {
    const response = await apiClient.get('/Services', {
      params: lang ? { lang } : undefined,
    });
    return response.data;
  }),

  getById: async (id, lang) => withRetry(async () => {
    const response = await apiClient.get(`/Services/${id}`, {
      params: lang ? { lang } : undefined,
    });
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Services', data);
    return response.data;
  }),

  update: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Services/${id}`, data);
    return response.data;
  }),

  delete: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Services/${id}`);
    return response.data;
  })
};