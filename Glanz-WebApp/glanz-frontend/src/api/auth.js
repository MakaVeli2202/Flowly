import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const authAPI = {
  register: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Auth/register', data);
    return response.data;
  }),

  login: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Auth/login', data);
    return response.data;
  }),

  getCurrentUser: async () => withRetry(async () => {
    const response = await apiClient.get('/Auth/me');
    return response.data;
  }),

  updateProfile: async (data) => withRetry(async () => {
    const response = await apiClient.put('/Auth/me', data);
    return response.data;
  }),

  uploadProfileImage: async (formData) => withRetry(async () => {
    const response = await apiClient.post('/Auth/me/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }),

  changePassword: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Auth/change-password', data);
    return response.data;
  }),

  forceChangePassword: async (data) => {
    const response = await apiClient.post('/Auth/force-change-password', data);
    return response.data;
  },

  getWorkers: async () => withRetry(async () => {
    const response = await apiClient.get('/Auth/workers');
    return response.data;
  }),

  getActiveWorkerNames: async () => withRetry(async () => {
    const response = await apiClient.get('/Auth/workers/active-names');
    return response.data;
  }),

  createWorker: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Auth/register-worker', data);
    return response.data;
  }),

  deleteWorker: async (workerId) => withRetry(async () => {
    const response = await apiClient.delete(`/Auth/workers/${workerId}`);
    return response.data;
  }),

  updateWorkerSchedule: async (workerId, data) => withRetry(async () => {
    const response = await apiClient.put(`/Auth/workers/${workerId}/schedule`, data);
    return response.data;
  }),

  updateWorkerStatus: async (workerId, isActive) => withRetry(async () => {
    const response = await apiClient.put(`/Auth/workers/${workerId}/status`, { isActive });
    return response.data;
  }),

  updateWorkerSalary: async (workerId, monthlySalary) => withRetry(async () => {
    const response = await apiClient.put(`/Auth/workers/${workerId}/salary`, { monthlySalary });
    return response.data;
  }),

  getPayrollSummary: async (month, year) => withRetry(async () => {
    const params = {};
    if (month != null) params.month = month;
    if (year  != null) params.year  = year;
    const response = await apiClient.get('/Auth/workers/payroll', { params });
    return response.data;
  }),

  markWorkerPaid: async (workerId, month, year) => withRetry(async () => {
    const response = await apiClient.post('/Auth/workers/mark-paid', { workerId, month, year });
    return response.data;
  }),

  checkShortCode: async (code, excludeId = null) => withRetry(async () => {
    const params = { code };
    if (excludeId) params.excludeId = excludeId;
    const response = await apiClient.get('/Auth/workers/check-short-code', { params });
    return response.data;
  }),

  suggestShortCode: async (firstName, lastName) => withRetry(async () => {
    const response = await apiClient.post('/Auth/workers/suggest-shortcode', { firstName, lastName });
    return response.data;
  }),

  checkPayrollDue: async () => withRetry(async () => {
    const response = await apiClient.get('/Auth/workers/payroll/check-due');
    return response.data;
  }),

  getPaySlipSettings: async () => withRetry(async () => {
    const response = await apiClient.get('/Auth/workers/payroll/settings');
    return response.data;
  }),

  updatePaySlipSettings: async (settings) => withRetry(async () => {
    const response = await apiClient.put('/Auth/workers/payroll/settings', settings);
    return response.data;
  }),

  refresh: async () => {
    const response = await apiClient.post('/Auth/refresh');
    return response.data;
  },

  logout: async () => {
    try {
      await apiClient.post('/Auth/logout');
    } catch {
      // best-effort — clear local state regardless
    }
  },

  sendVerificationEmail: (email) =>
    apiClient.post('/Auth/send-verification', { email }),

  verifyEmailCode: (email, token) =>
    apiClient.post('/Auth/verify-email', { email, token }),

  forgotPassword: (email) =>
    apiClient.post('/Auth/forgot-password', { email }),

  resetPassword: (token, newPassword, confirmNewPassword) =>
    apiClient.post('/Auth/reset-password', { token, newPassword, confirmNewPassword }),

  devGenerateResetToken: (email) =>
    apiClient.post('/Auth/dev-generate-reset-token', { email }).then(r => r.data),

  setAllowPreferredWorker: (userId, allow) =>
    apiClient.put(`/Auth/users/${userId}/allow-preferred-worker`, { allow }),
};