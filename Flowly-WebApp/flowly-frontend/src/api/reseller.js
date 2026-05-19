import apiClient from './axios';

export const resellerAPI = {
  getProfile: () => apiClient.get('/Reseller/profile').then(r => r.data),
  saveProfile: (data) => apiClient.put('/Reseller/profile', data).then(r => r.data),
  getManagedOrgs: () => apiClient.get('/Reseller/managed-orgs').then(r => r.data),
  createManagedOrg: (data) => apiClient.post('/Reseller/managed-orgs', data).then(r => r.data),
  unlinkManagedOrg: (orgId) => apiClient.delete(`/Reseller/managed-orgs/${orgId}`).then(r => r.data),
};
