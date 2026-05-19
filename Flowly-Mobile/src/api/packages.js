import apiClient from './axios';

export const packagesAPI = {
  getAll:      async (lang)        => (await apiClient.get('/Packages', { params: lang ? { lang } : undefined })).data,
  getAllAdmin: async (lang)        => (await apiClient.get('/Packages/admin/all', { params: lang ? { lang } : undefined })).data,
  getById:     async (id, lang)    => (await apiClient.get(`/Packages/${id}`, { params: lang ? { lang } : undefined })).data,
  create:      async (data)    => (await apiClient.post('/Packages', data)).data,
  update:      async (id, data)=> (await apiClient.put(`/Packages/${id}`, data)).data,
  delete:      async (id)      => (await apiClient.delete(`/Packages/${id}`)).data,
  toggleActive:async (id)      => (await apiClient.patch(`/Packages/${id}/toggle-active`)).data,
};
