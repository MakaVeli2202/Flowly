import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const notificationsAPI = {
  getUnreadCount: async () => withRetry(async () => (await apiClient.get('/Notifications/unread-count')).data),
  getAll: async (limit) => withRetry(async () => (await apiClient.get('/Notifications', { params: limit ? { limit } : {} })).data),
  getRecent: async (limit = 10) => withRetry(async () => (await apiClient.get('/Notifications/recent', { params: { limit } })).data),
  markRead: async (id) => withRetry(async () => (await apiClient.put(`/Notifications/${id}/mark-read`)).data),
  markAllRead: async () => withRetry(async () => (await apiClient.put('/Notifications/mark-all-read')).data),
};