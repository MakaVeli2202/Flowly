import apiClient from './axios';

export const addressesAPI = {
  autocomplete: async (query, limit = 5) => {
    const response = await apiClient.get('/Addresses/autocomplete', {
      params: { q: query, limit },
    });
    return response.data;
  },
};