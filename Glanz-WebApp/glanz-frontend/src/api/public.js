import apiClient from './axios';

export const publicAPI = {
  getOrg: async (slug) => {
    const response = await apiClient.get(`/public/orgs/${slug}`);
    return response.data;
  },

  getPackages: async (slug) => {
    const response = await apiClient.get(`/public/orgs/${slug}/packages`);
    return response.data;
  },

  getBranding: async (slug) => {
    const response = await apiClient.get(`/public/orgs/${slug}/branding`);
    return response.data;
  },

  listOrgs: async () => {
    const response = await apiClient.get('/public/orgs');
    return response.data;
  },
};
