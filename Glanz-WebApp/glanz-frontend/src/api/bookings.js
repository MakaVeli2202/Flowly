import apiClient from './axios';
import { withRetry } from '../utils/retry';
import { cacheManager } from '../core/cacheManager';

const CACHE_TTL  = 30_000;
const CACHE_KEY  = 'bookings';
const invalidate = () => cacheManager.invalidate(CACHE_KEY);

export const bookingsAPI = {
  createPaymentIntent: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Bookings/create-payment-intent', data);
    return response.data;
  }),

  createTapCharge: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Payments/create-charge', data);
    return response.data;
  }),

  verifyTapCharge: async (chargeId) => withRetry(async () => {
    const response = await apiClient.get(`/Payments/verify/${encodeURIComponent(chargeId)}`);
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Bookings', data);
    invalidate();
    return response.data;
  }),

  getMyBookings: async () => cacheManager.fetch(`${CACHE_KEY}:mine`, () => apiClient.get('/Bookings').then((r) => r.data), CACHE_TTL),

  getAll: async () => cacheManager.fetch(`${CACHE_KEY}:all`, () => apiClient.get('/Bookings/all').then((r) => r.data), CACHE_TTL),

  getWorkerBookings: async () => cacheManager.fetch(`${CACHE_KEY}:worker`, () => apiClient.get('/Bookings/worker').then((r) => r.data), CACHE_TTL),

  getByBookingNumber: async (bookingNumber) => withRetry(async () => {
    const response = await apiClient.get(`/Bookings/${bookingNumber}`);
    return response.data;
  }),

  getCalendarAvailability: async (from, to) => withRetry(async () => {
    const response = await apiClient.get('/Bookings/availability-calendar', { params: { from, to } });
    return response.data;
  }),

  getConstraints: async () => withRetry(async () => {
    const response = await apiClient.get('/Bookings/constraints');
    return response.data;
  }),

  getWorkersSchedule: async (from, to) => withRetry(async () => {
    const response = await apiClient.get('/Bookings/workers/schedule', { params: { from, to } });
    return response.data;
  }),

  getWorkersDayTimeline: async (date) => withRetry(async () => {
    const response = await apiClient.get('/Bookings/workers/day-timeline', { params: { date } });
    return response.data;
  }),

  getAvailableSlots: async (date, durationMinutes, vehicleType) => withRetry(async () => {
    const params = { date };
    if (durationMinutes > 0) params.durationMinutes = durationMinutes;
    if (vehicleType) params.vehicleType = vehicleType;
    const response = await apiClient.get('/Bookings/available-slots', { params });
    return response.data;
  }),

  getQuote: async ({ packages, vehicleType, customerSubscriptionId, offerCode }) => {
    try {
      const response = await apiClient.post('/Bookings/quote', {
        packages,
        vehicleType,
        customerSubscriptionId: customerSubscriptionId ?? null,
        offerCode: offerCode ?? null,
      });
      return response.data;
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  updateStatus: async (id, status) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${id}/status`, { status });
    invalidate();
    return response.data;
  }),

  updatePaymentStatus: async (id, paymentStatus) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${id}/payment-status`, { paymentStatus });
    return response.data;
  }),

  assignWorker: async (bookingId, workerId, forceAssign = false) => withRetry(async () => {
    const response = await apiClient.post('/Bookings/assign-worker', { bookingId, workerId, forceAssign });
    return response.data;
  }),

  getAvailableWorkers: async (bookingId, { date, timeSlot } = {}) => withRetry(async () => {
    const params = {};
    if (date)     params.date     = date;
    if (timeSlot) params.timeSlot = timeSlot;
    const response = await apiClient.get(`/Bookings/${bookingId}/available-workers`, { params });
    return response.data;
  }),

  extendBooking: async (id, additionalMinutes) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/extend`, { additionalMinutes });
    return response.data;
  }),

  getAssignmentMode: async () => withRetry(async () => {
    const response = await apiClient.get('/Bookings/assignment-mode');
    return response.data;
  }),

  updateAssignmentMode: async (autoAssignEnabled) => withRetry(async () => {
    const response = await apiClient.put('/Bookings/assignment-mode', { autoAssignEnabled });
    return response.data;
  }),

  cancel: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Bookings/${id}`);
    invalidate();
    return response.data;
  }),

  startJob: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/start`);
    invalidate();
    return response.data;
  }),

  markWorkerArrived: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/arrived`);
    return response.data;
  }),

  markRunningLate: async (bookingId, delayMinutes, reason) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/running-late`, { delayMinutes, reason });
    return response.data;
  }),

  finishJob: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/finish`);
    invalidate();
    return response.data;
  }),

  updateChecklistItem: async (bookingId, checklistItemId, isCompleted) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${bookingId}/checklist/${checklistItemId}`, { IsCompleted: isCompleted });
    return response.data;
  }),

  claim: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/claim`);
    invalidate();
    return response.data;
  }),

  markWorkerAbsent: async (dto) => withRetry(async () => {
    const response = await apiClient.post('/Bookings/worker-absence', dto);
    return response.data;
  }),

  requestCancellation: async (id, reason) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/request-cancellation`, { reason });
    return response.data;
  }),

  requestReschedule: async (id, dto) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/request-reschedule`, dto);
    return response.data;
  }),

  getCancellationFee: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Bookings/${id}/cancellation-fee`);
    return response.data;
  }),

  getById: async (id) => withRetry(async () => {
    const all = await apiClient.get('/Bookings/all');
    return all.data.find((b) => b.id === Number(id)) ?? null;
  }),

  adminEdit: async (id, dto) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${id}/admin-edit`, dto);
    invalidate();
    return response.data;
  }),

  adminCancelRefund: async (id, dto = {}) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/admin-cancel-refund`, dto);
    invalidate();
    return response.data;
  }),

  customerEdit: async (id, dto) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${id}/customer-edit`, dto);
    return response.data;
  }),

  rejectCancellationRequest: async (id) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/reject-cancellation-request`);
    return response.data;
  }),

  rejectRescheduleRequest: async (id) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/reject-reschedule-request`);
    return response.data;
  }),
};