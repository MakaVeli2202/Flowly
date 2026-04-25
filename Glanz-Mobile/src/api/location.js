import apiClient from './axios';

export const locationAPI = {
  updateLocation: async (bookingId, latitude, longitude) => {
    const response = await apiClient.post('/location/update', {
      bookingId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  },

  getLocation: async (bookingId) => {
    const response = await apiClient.get(`/location/${bookingId}`);
    return response.data;
  },

  stopLocation: async (bookingId) => {
    const response = await apiClient.post(`/location/stop/${bookingId}`);
    return response.data;
  },

  getLiveWorkers: async () => {
    const response = await apiClient.get('/admin/location/live-workers');
    return response.data;
  },
};