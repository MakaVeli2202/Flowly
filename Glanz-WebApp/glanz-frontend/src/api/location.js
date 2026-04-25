import apiClient from './axios';

export const locationAPI = {
  getLiveWorkers: async () => {
    const response = await apiClient.get('/admin/location/live-workers');
    return response.data;
  },
  getAllActiveLocations: async () => {
    const response = await apiClient.get('/admin/location/all-active');
    return response.data;
  },
};