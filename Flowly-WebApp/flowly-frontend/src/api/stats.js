import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const statsAPI = {
  getPublic: async () => withRetry(async () => {
    const response = await apiClient.get('/Stats');
    return response.data;
  }),
};