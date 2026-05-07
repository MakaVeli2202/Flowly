import apiClient from './axios';

export const payrollAPI = {
  getWorkers: async () => {
    const { data } = await apiClient.get('/Auth/workers');
    return data;
  },
  getPayroll: async (workerId, month, year) => {
    const { data } = await apiClient.get(`/Admin/payroll?workerId=${workerId}&month=${month}&year=${year}`);
    return data;
  },
  generatePayroll: async (workerId, month, year) => {
    const { data } = await apiClient.post('/Admin/payroll/generate', { workerId, month, year });
    return data;
  },
  processPayment: async (payrollId) => {
    const { data } = await apiClient.post(`/Admin/payroll/${payrollId}/process`);
    return data;
  },
};
