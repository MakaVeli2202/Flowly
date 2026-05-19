import apiClient from './axios';

export const payrollAPI = {
  getSummary: async (month, year) => {
    const { data } = await apiClient.get('/Auth/workers/payroll', { params: { month, year } });
    return data;
  },
  markPaid: async (workerId, month, year) => {
    const { data } = await apiClient.post('/Auth/workers/mark-paid', { workerId, month, year });
    return data;
  },
  getAttendance: async (staffId, from, to) => {
    const { data } = await apiClient.get('/Auth/attendance', { params: { staffId, from, to } });
    return data;
  },
};
