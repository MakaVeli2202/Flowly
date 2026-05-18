import apiClient from './axios';

export const gdprAPI = {
  exportMyData: () => apiClient.get('/Gdpr/export', { responseType: 'blob' }).then(r => r.data),
  requestDeletion: () => apiClient.post('/Gdpr/delete-request').then(r => r.data),
  // Admin
  getDeletionRequests: () => apiClient.get('/Gdpr/admin/deletion-requests').then(r => r.data),
  hardDelete: (id) => apiClient.post(`/Gdpr/admin/hard-delete/${id}`).then(r => r.data),
};
