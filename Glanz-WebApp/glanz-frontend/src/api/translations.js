import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const translationsAPI = {
  listPackages: async (lang) => withRetry(async () => {
    const response = await apiClient.get('/admin/translations/packages', { params: { lang } });
    return response.data;
  }),

  listServices: async (lang) => withRetry(async () => {
    const response = await apiClient.get('/admin/translations/services', { params: { lang } });
    return response.data;
  }),

  savePackage: async (id, lang, payload) => withRetry(async () => {
    const response = await apiClient.put(`/admin/translations/packages/${id}`, payload, { params: { lang } });
    return response.data;
  }),

  saveService: async (id, lang, payload) => withRetry(async () => {
    const response = await apiClient.put(`/admin/translations/services/${id}`, payload, { params: { lang } });
    return response.data;
  }),

  backfill: async () => withRetry(async () => {
    const response = await apiClient.post('/admin/translations/backfill');
    return response.data;
  }),
};
