import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const jobsAPI = {
  // Public: Apply for a job
  apply: async (data) => withRetry(async () => {
    const response = await apiClient.post('/JobApplications', data);
    return response.data;
  }),

  // Public: Get open positions
  getOpenPositions: async () => withRetry(async () => {
    const response = await apiClient.get('/JobApplications/positions');
    return response.data;
  }),

  // Admin: Get all applications
  getApplications: async (params = {}) => withRetry(async () => {
    const response = await apiClient.get('/JobApplications', { params });
    return response.data;
  }),

  // Admin: Get application by ID
  getApplication: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/JobApplications/${id}`);
    return response.data;
  }),

  // Admin: Update application
  updateApplication: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/JobApplications/${id}`, data);
    return response.data;
  }),

  // Admin: Get all positions
  getAllPositions: async () => withRetry(async () => {
    const response = await apiClient.get('/JobApplications/admin/positions');
    return response.data;
  }),

  // Admin: Create position
  createPosition: async (data) => withRetry(async () => {
    const response = await apiClient.post('/JobApplications/admin/positions', data);
    return response.data;
  }),
};