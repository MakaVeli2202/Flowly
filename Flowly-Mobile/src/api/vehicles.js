import apiClient from './axios';

export const vehiclesAPI = {
  getAll:      async ()         => (await apiClient.get('/Vehicles')).data,
  getOne:      async (id)       => (await apiClient.get(`/Vehicles/${id}`)).data,
  create:      async (data)     => (await apiClient.post('/Vehicles', data)).data,
  update:      async (id, data) => (await apiClient.put(`/Vehicles/${id}`, data)).data,
  remove:      async (id)       => (await apiClient.delete(`/Vehicles/${id}`)).data,
  setDefault:  async (id)       => (await apiClient.put(`/Vehicles/${id}/default`)).data,
  uploadImage: async (id, formData) =>
    (await apiClient.post(`/Vehicles/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data,
};
