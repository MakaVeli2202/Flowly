import apiClient from './axios';

export const referralAPI = {
  getMyReferrals: async () => {
    const response = await apiClient.get('/Referral/my-referrals');
    return response.data;
  },

  getMyCode: async () => {
    const response = await apiClient.get('/Referral/code');
    return response.data;
  },

  applyCode: async (code) => {
    const response = await apiClient.post('/Referral/apply', { referralCode: code });
    return response.data;
  },

  validateCode: async (code) => {
    const response = await apiClient.get(`/Referral/validate/${code}`);
    return response.data;
  },
};