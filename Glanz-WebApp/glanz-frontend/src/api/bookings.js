import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const bookingsAPI = {
  createPaymentIntent: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Bookings/create-payment-intent', data);
    return response.data;
  }),

  createPaymentIntentV2: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Payments/create-intent', data);
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Bookings', data);
    return response.data;
  }),

  getMyBookings: async () => withRetry(async () => {
    const response = await apiClient.get('/Bookings');
    return response.data;
  }),

  getAll: async () => withRetry(async () => {
    const response = await apiClient.get('/Bookings/all');
    return response.data;
  }),

  getWorkerBookings: async () => withRetry(async () => {
    const response = await apiClient.get('/Bookings/worker');
    return response.data;
  }),

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
    return response.data;
  }),

  startJob: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/start`);
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
    return response.data;
  }),

  updateChecklistItem: async (bookingId, checklistItemId, isCompleted) => withRetry(async () => {
    const response = await apiClient.put(`/Bookings/${bookingId}/checklist/${checklistItemId}`, { IsCompleted: isCompleted });
    return response.data;
  }),

  claim: async (bookingId) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${bookingId}/claim`);
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
    return response.data;
  }),

  adminCancelRefund: async (id, dto = {}) => withRetry(async () => {
    const response = await apiClient.post(`/Bookings/${id}/admin-cancel-refund`, dto);
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