import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const subscriptionsAPI = {
  getPlans: async (vehicleType) => withRetry(async () => {
    const params = vehicleType !== undefined && vehicleType !== null ? `?vehicleType=${vehicleType}` : '';
    const response = await apiClient.get(`/Plans${params}`);
    return response.data;
  }),

  getAllPlans: async () => withRetry(async () => {
    const response = await apiClient.get('/Plans/admin');
    return response.data;
  }),

  createPlan: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Plans', data);
    return response.data;
  }),

  updatePlan: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Plans/${id}`, data);
    return response.data;
  }),

  deletePlan: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Plans/${id}`);
    return response.data;
  }),

  subscribe: async ({ planId }) => withRetry(async () => {
    const response = await apiClient.post(`/Plans/${planId}/subscribe`);
    return response.data;
  }),

  getMy: async () => withRetry(async () => {
    const response = await apiClient.get('/Plans/my');
    return response.data;
  }),

  getMySubscription: async () => withRetry(async () => {
    const response = await apiClient.get('/Plans/my');
    return response.data;
  }),

  cancelPlan: async () => withRetry(async () => {
    const response = await apiClient.post('/Plans/cancel');
    return response.data;
  }),

  getSubscribers: async ({ status, page = 1, pageSize = 50 } = {}) => withRetry(async () => {
    const params = new URLSearchParams({ page, pageSize });
    if (status) params.set('status', status);
    const response = await apiClient.get(`/Plans/subscribers?${params}`);
    return response.data;
  }),

  getAvailability: async ({ month, year, packageId } = {}) => withRetry(async () => {
    const params = new URLSearchParams();
    if (month !== undefined) params.set('month', month);
    if (year !== undefined) params.set('year', year);
    if (packageId !== undefined) params.set('packageId', packageId);
    const response = await apiClient.get(`/SubscriptionBookings/availability?${params}`);
    return response.data;
  }),

  getSlots: async ({ date, packageId } = {}) => withRetry(async () => {
    const params = new URLSearchParams({ date });
    if (packageId !== undefined) params.set('packageId', packageId);
    const response = await apiClient.get(`/SubscriptionBookings/slots?${params}`);
    return response.data;
  }),

  createBookings: async (data) => withRetry(async () => {
    const response = await apiClient.post('/SubscriptionBookings', data);
    return response.data;
  }),

  createBooking: async ({ packageId, scheduledDate, timeSlot, notes }) => withRetry(async () => {
    const response = await apiClient.post('/SubscriptionBookings', {
      items: [{ packageId, scheduledDate, timeSlot, notes }],
    });
    return response.data;
  }),

  getMyBookings: async () => withRetry(async () => {
    const response = await apiClient.get('/SubscriptionBookings/my');
    return response.data;
  }),

  cancelBooking: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/SubscriptionBookings/${id}`);
    return response.data;
  }),

  getAllBookings: async ({ status, page = 1, pageSize = 50 } = {}) => withRetry(async () => {
    const params = new URLSearchParams({ page, pageSize });
    if (status) params.set('status', status);
    const response = await apiClient.get(`/SubscriptionBookings/admin?${params}`);
    return response.data;
  }),

  updateBooking: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/SubscriptionBookings/admin/${id}`, data);
    return response.data;
  }),
};