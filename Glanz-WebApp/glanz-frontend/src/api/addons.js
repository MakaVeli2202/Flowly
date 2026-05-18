import apiClient from './axios';

export const addOnsAPI = {
  getAll: () => apiClient.get('/ServiceAddOns').then(r => r.data),
  create: (dto) => apiClient.post('/ServiceAddOns', dto).then(r => r.data),
  update: (id, dto) => apiClient.put(`/ServiceAddOns/${id}`, dto).then(r => r.data),
  delete: (id) => apiClient.delete(`/ServiceAddOns/${id}`),
};
