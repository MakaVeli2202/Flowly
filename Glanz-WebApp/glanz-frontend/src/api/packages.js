import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const packagesAPI = {
  getAll: async () => withRetry(async () => {
    const response = await apiClient.get('/Packages');
    return response.data;
  }),

  getAllAdmin: async () => withRetry(async () => {
    const response = await apiClient.get('/Packages/admin/all');
    return response.data;
  }),

  getById: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Packages/${id}`);
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Packages', data);
    return response.data;
  }),

  update: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Packages/${id}`, data);
    return response.data;
  }),

  delete: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Packages/${id}`);
    return response.data;
  }),

  toggleActive: async (id) => withRetry(async () => {
    const response = await apiClient.patch(`/Packages/${id}/toggle-active`);
    return response.data;
  })
};