import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const servicesAPI = {
  getAll: async () => withRetry(async () => {
    const response = await apiClient.get('/Services');
    return response.data;
  }),

  getById: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Services/${id}`);
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