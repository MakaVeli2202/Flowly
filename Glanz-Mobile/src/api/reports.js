import apiClient from './axios';

export const reportsAPI = {
  getDashboardSummary: async () => (await apiClient.get('/Reports/dashboard-summary')).data,
  getFinancial: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate)   params.append('endDate', endDate);
    return (await apiClient.get(`/Reports/financial?${params}`)).data;
  },
  getOperational: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate)   params.append('endDate', endDate);
    return (await apiClient.get(`/Reports/operational?${params}`)).data;
  },
};
