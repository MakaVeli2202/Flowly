import apiClient from './axios';

export const jobsAPI = {
  getOpenPositions: async () => {
    const { data } = await apiClient.get('/Auth/job-positions?open=true');
    return data;
  },
};
