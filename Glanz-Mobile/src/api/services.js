import apiClient from './axios';

export const servicesAPI = {
  getAll:  async ()        => (await apiClient.get('/Services')).data,
  getById: async (id)      => (await apiClient.get(`/Services/${id}`)).data,
  create:  async (data)    => (await apiClient.post('/Services', data)).data,
  update:  async (id, data)=> (await apiClient.put(`/Services/${id}`, data)).data,
  delete:  async (id)      => (await apiClient.delete(`/Services/${id}`)).data,
};
