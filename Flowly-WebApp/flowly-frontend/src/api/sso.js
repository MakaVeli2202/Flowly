import apiClient from './axios';

export const ssoAPI = {
  getConfig: () => apiClient.get('/SSO/config').then(r => r.data),
  saveConfig: (data) => apiClient.post('/SSO/config', data).then(r => r.data),
};
