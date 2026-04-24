import apiClient from './axios';

export const productsAPI = {
  getAll:  async ()        => (await apiClient.get('/Products')).data,
  getById: async (id)      => (await apiClient.get(`/Products/${id}`)).data,
  create:  async (data)    => (await apiClient.post('/Products', data)).data,
  update:  async (id, data)=> (await apiClient.put(`/Products/${id}`, data)).data,
  delete:  async (id)      => (await apiClient.delete(`/Products/${id}`)).data,
};
