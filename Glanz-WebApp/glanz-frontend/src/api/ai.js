import apiClient from './axios';

export const aiAPI = {
  getInsights: () => apiClient.get('/AI/insights').then(r => r.data),
  crmAssist: (customerId) => apiClient.post('/AI/crm-assist', { customerId }).then(r => r.data),
  generateMarketing: (objective, language = 'en') =>
    apiClient.post('/AI/marketing', { objective, language }).then(r => r.data),
  upsellSuggestions: (bookingId) => apiClient.get(`/AI/upsell/${bookingId}`).then(r => r.data),
};
