import apiClient from './axios';

export const notificationConfigAPI = {
  get: () => apiClient.get('/NotificationConfig').then(r => r.data),
  update: (data) => apiClient.put('/NotificationConfig', data).then(r => r.data),
};
