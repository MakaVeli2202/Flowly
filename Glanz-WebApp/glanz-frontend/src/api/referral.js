import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const referralAPI = {
  getMyReferrals: async () => withRetry(async () => {
    const response = await apiClient.get('/Referral/my-referrals');
    return response.data;
  }),

  getMyCode: async () => withRetry(async () => {
    const response = await apiClient.get('/Referral/code');
    return response.data;
  }),

  applyCode: async (code) => withRetry(async () => {
    const response = await apiClient.post('/Referral/apply', { referralCode: code });
    return response.data;
  }),

  validateCode: async (code) => withRetry(async () => {
    const response = await apiClient.get(`/Referral/validate/${code}`);
    return response.data;
  }),
};