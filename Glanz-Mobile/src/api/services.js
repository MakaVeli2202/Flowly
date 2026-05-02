import apiClient from './axios';

export const servicesAPI = {
  getAll:  async (lang)        => (await apiClient.get('/Services', { params: lang ? { lang } : undefined })).data,
  getById: async (id, lang)    => (await apiClient.get(`/Services/${id}`, { params: lang ? { lang } : undefined })).data,
  create:  async (data)    => (await apiClient.post('/Services', data)).data,
  update:  async (id, data)=> (await apiClient.put(`/Services/${id}`, data)).data,
  delete:  async (id)      => (await apiClient.delete(`/Services/${id}`)).data,
};
