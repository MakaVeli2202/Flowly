import apiClient from './axios';

export const organizationsAPI = {
  register: async (data) => {
    const response = await apiClient.post('/Organizations/register', data);
    return response.data;
  },

  getMe: async () => {
    const response = await apiClient.get('/Organizations/me');
    return response.data;
  },

  updateMe: async (data) => {
    const response = await apiClient.put('/Organizations/me', data);
    return response.data;
  },

  getBranding: async () => {
    const response = await apiClient.get('/Organizations/me/branding');
    return response.data;
  },

  updateBranding: async (data) => {
    const response = await apiClient.put('/Organizations/me/branding', data);
    return response.data;
  },

  getOnboarding: async () => {
    const response = await apiClient.get('/Organizations/me/onboarding');
    return response.data;
  },
};
