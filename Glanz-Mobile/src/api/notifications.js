import apiClient from './axios';

export const notificationsAPI = {
  getUnreadCount: async () => (await apiClient.get('/Notifications/unread-count')).data,
  getRecent: async (limit = 10) => (await apiClient.get('/Notifications/recent', { params: { limit } })).data,
  getAll: async (limit) => (await apiClient.get('/Notifications', { params: limit ? { limit } : undefined })).data,
  markRead: async (id) => (await apiClient.put(`/Notifications/${id}/mark-read`)).data,
  markAllRead: async () => (await apiClient.put('/Notifications/mark-all-read')).data,
  sendTest: async (userId, message) => (await apiClient.post('/Notifications/send-test', { userId, message })).data,
};