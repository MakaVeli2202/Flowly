import apiClient from './axios';

export const clientAssetsAPI = {
  adminSearch: (q) => apiClient.get('/ClientAssets/admin/search', { params: { q } }).then(r => r.data),
  adminGetHistory: (id) => apiClient.get(`/ClientAssets/admin/${id}/history`).then(r => r.data),
};
