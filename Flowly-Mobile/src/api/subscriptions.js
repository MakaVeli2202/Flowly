import apiClient from './axios';
import { withRetry } from '../utils/retry';

const withRetryLocal = async (fn) => {
  try { return await fn(); }
  catch (err) {
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      attempt++;
      try { return await fn(); }
      catch { if (attempt >= maxAttempts) throw err; await new Promise(r => setTimeout(r, 500 * attempt)); }
    }
  }
};

export const subscriptionsAPI = {
  // Plans
  getPlans: async (vehicleType) => {
    const params = vehicleType !== undefined && vehicleType !== null ? `?vehicleType=${vehicleType}` : '';
    return (await apiClient.get(`/Plans${params}`)).data;
  },

  getAllPlans: async () => (await apiClient.get('/Plans/admin')).data,

  createPlan: async (data) => (await apiClient.post('/Plans', data)).data,

  updatePlan: async (id, data) => (await apiClient.put(`/Plans/${id}`, data)).data,

  deletePlan: async (id) => (await apiClient.delete(`/Plans/${id}`)).data,

  subscribe: async ({ planId }) => (await apiClient.post(`/Plans/${planId}/subscribe`)).data,

  getMy: async () => (await apiClient.get('/Plans/my')).data,

  getMySubscription: async () => (await apiClient.get('/Plans/my')).data,

  cancelPlan: async () => (await apiClient.post('/Plans/cancel')).data,

  // Subscription Bookings
  createBookings: async (data) => (await apiClient.post('/SubscriptionBookings', data)).data,

  createBooking: async ({ packageId, scheduledDate, timeSlot, notes }) => {
    return (await apiClient.post('/SubscriptionBookings', {
      items: [{ packageId, scheduledDate, timeSlot, notes }],
    })).data;
  },

  getMyBookings: async () => (await apiClient.get('/SubscriptionBookings/my')).data,

  cancelBooking: async (id) => (await apiClient.delete(`/SubscriptionBookings/${id}`)).data,

  // Availability
  getAvailability: async ({ month, year, packageId } = {}) => {
    const params = new URLSearchParams();
    if (month !== undefined) params.set('month', month);
    if (year !== undefined) params.set('year', year);
    if (packageId !== undefined) params.set('packageId', packageId);
    return (await apiClient.get(`/SubscriptionBookings/availability?${params}`)).data;
  },

  // Slots
  getSlots: async ({ date, packageId } = {}) => {
    const params = new URLSearchParams({ date });
    if (packageId !== undefined) params.set('packageId', packageId);
    return (await apiClient.get(`/SubscriptionBookings/slots?${params}`)).data;
  },
};