import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const reportsAPI = {
  getDashboardSummary: async (startDate, endDate) => withRetry(async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(`/Reports/dashboard-summary?${params}`);
    return response.data;
  }),

  getFinancial: async (startDate, endDate) => withRetry(async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(`/Reports/financial?${params}`);
    return response.data;
  }),

  getOperational: async (startDate, endDate) => withRetry(async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await apiClient.get(`/Reports/operational?${params}`);
    return response.data;
  }),

  getCohortRetention: async (months = 6) => {
    const response = await apiClient.get(`/Reports/cohort-retention?months=${months}`);
    return response.data;
  },
};