import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const addressesAPI = {
  autocomplete: async (query, limit = 5) => withRetry(async () => {
    const response = await apiClient.get('/Addresses/autocomplete', {
      params: { q: query, limit },
    });
    return response.data;
  }),
};