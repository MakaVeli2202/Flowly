import apiClient from './axios';

export const analyticsAPI = {
  track:     (data)      => apiClient.post('/Analytics/track', data),
  heartbeat: (sessionId) => apiClient.put(`/Analytics/heartbeat/${sessionId}`),
  getLive:   ()          => apiClient.get('/Analytics/live').then(r => r.data),
  getStats:  (from, to)  => apiClient.get('/Analytics/stats', { params: { from, to } }).then(r => r.data),
};
