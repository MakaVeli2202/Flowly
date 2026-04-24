import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const productsAPI = {
  getAll: async () => withRetry(async () => {
    const response = await apiClient.get('/Products');
    return response.data;
  }),

  getById: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Products/${id}`);
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Products', data);
    return response.data;
  }),

  update: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Products/${id}`, data);
    return response.data;
  }),

  delete: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Products/${id}`);
    return response.data;
  })
};