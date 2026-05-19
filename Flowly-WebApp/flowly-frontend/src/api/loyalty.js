import apiClient from './axios';

export const loyaltyAPI = {
  getBalance: () => apiClient.get('/Loyalty/balance').then(r => r.data),
  getTransactions: () => apiClient.get('/Loyalty/transactions').then(r => r.data),
  getConfig: () => apiClient.get('/Loyalty/config').then(r => r.data),
  updateConfig: (dto) => apiClient.put('/Loyalty/config', dto).then(r => r.data),
  getCustomerBalance: (userId) => apiClient.get(`/Loyalty/customer/${userId}`).then(r => r.data),
};
