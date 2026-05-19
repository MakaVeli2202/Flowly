import apiClient from './axios';

export const webhookAPI = {
  getSubscriptions: () => apiClient.get('/Webhook/subscriptions').then(r => r.data),
  createSubscription: (data) => apiClient.post('/Webhook/subscriptions', data).then(r => r.data),
  deleteSubscription: (id) => apiClient.delete(`/Webhook/subscriptions/${id}`).then(r => r.data),
  getDeliveries: (eventType, take = 50) =>
    apiClient.get('/Webhook/deliveries', { params: { ...(eventType ? { eventType } : {}), take } }).then(r => r.data),
};
