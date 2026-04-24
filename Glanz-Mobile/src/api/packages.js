import apiClient from './axios';

export const packagesAPI = {
  getAll:      async ()        => (await apiClient.get('/Packages')).data,
  getAllAdmin:  async ()        => (await apiClient.get('/Packages/admin/all')).data,
  getById:     async (id)      => (await apiClient.get(`/Packages/${id}`)).data,
  create:      async (data)    => (await apiClient.post('/Packages', data)).data,
  update:      async (id, data)=> (await apiClient.put(`/Packages/${id}`, data)).data,
  delete:      async (id)      => (await apiClient.delete(`/Packages/${id}`)).data,
  toggleActive:async (id)      => (await apiClient.patch(`/Packages/${id}/toggle-active`)).data,
};
