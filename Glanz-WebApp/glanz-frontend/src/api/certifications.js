import apiClient from './axios';

export const certificationsAPI = {
  getByWorker: (workerId) => apiClient.get(`/StaffCertifications/${workerId}`).then(r => r.data),
  getExpiring: (days = 30) => apiClient.get(`/StaffCertifications/expiring?days=${days}`).then(r => r.data),
  create: (dto) => apiClient.post('/StaffCertifications', dto).then(r => r.data),
  update: (id, dto) => apiClient.put(`/StaffCertifications/${id}`, dto).then(r => r.data),
  delete: (id) => apiClient.delete(`/StaffCertifications/${id}`),
};
