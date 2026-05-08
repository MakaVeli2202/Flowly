import apiClient from './axios';
import { withRetry } from '../utils/retry';
import { cacheManager } from '../core/cacheManager';

const CACHE_TTL  = 30_000;
const CACHE_KEY  = 'bookings';
const invalidate = () => cacheManager.invalidate(CACHE_KEY);

export const bookingsAPI = {
    pauseJob: async (id, reason) => withRetry(async () => {
      const r = (await apiClient.post(`/Bookings/${id}/pause`, { reason })).data;
      invalidate(); return r;
    }),
  resumeJob: async (id) => withRetry(async () => {
    const r = (await apiClient.post(`/Bookings/${id}/resume`)).data;
    invalidate(); return r;
  }),
  create: async (data) => withRetry(async () => {
    const r = (await apiClient.post('/Bookings', data)).data;
    invalidate(); return r;
  }),
  getMyBookings: async (force = false) => {
    if (force) cacheManager.remove(`${CACHE_KEY}:mine`);
    return cacheManager.fetch(`${CACHE_KEY}:mine`, () => apiClient.get('/Bookings').then((r) => r.data), CACHE_TTL);
  },
  getWorkerBookings: async (force = false) => {
    if (force) cacheManager.remove(`${CACHE_KEY}:worker`);
    return cacheManager.fetch(`${CACHE_KEY}:worker`, () => apiClient.get('/Bookings/Employee').then((r) => r.data), CACHE_TTL);
  },
  getAll: async (force = false) => {
    if (force) cacheManager.remove(`${CACHE_KEY}:all`);
    return cacheManager.fetch(`${CACHE_KEY}:all`, () => apiClient.get('/Bookings/all').then((r) => r.data), CACHE_TTL);
  },
  seedDemoWorkload: async () => (await apiClient.post('/Bookings/seed-demo-workload')).data,
  getByBookingNumber: async (bookingNumber) => (await apiClient.get(`/Bookings/${bookingNumber}`)).data,
  getCalendarAvailability: async (from, to) => (await apiClient.get('/Bookings/availability-calendar', { params: { from, to } })).data,
  // Slots are evaluated per-worker against real booking intervals + buffer.
  // durationMinutes is passed so the backend can confirm the full job fits within the worker's shift
  // and doesn't overlap with existing bookings for the entire duration (not just the slot start).
  getAvailableSlots: async (date, durationMinutes) => (await apiClient.get('/Bookings/available-slots', { params: { date, ...(durationMinutes > 0 ? { durationMinutes } : {}) } })).data,
  // Returns server-calculated price breakdown before booking creation.
  // Returns null (not throws) when the endpoint is not yet deployed (404) so
  // callers can fall back to client-side estimates gracefully.
  getQuote: async ({ packageIds, vehicleType, subscriptionId, offerCode }) => {
    try {
      return (await apiClient.post('/Bookings/quote', {
        packageIds,
        vehicleType,
        ...(subscriptionId ? { subscriptionId } : {}),
        ...(offerCode      ? { offerCode      } : {}),
      })).data;
    } catch (err) {
      if (err?.response?.status === 404) return null; // endpoint not yet deployed
      throw err;
    }
  },
  // Stage 2 upsell commitment: extends Booking.EndTime after customer confirms add-on.
  extendBooking: async (id, additionalMinutes) => withRetry(async () => (
    await apiClient.post(`/Bookings/${id}/extend`, { additionalMinutes })
  ).data),
  claim: async (id) => withRetry(async () => { const r = (await apiClient.post(`/Bookings/${id}/claim`)).data; invalidate(); return r; }),
  markArrived: async (id) => withRetry(async () => { const r = (await apiClient.post(`/Bookings/${id}/arrived`)).data; invalidate(); return r; }),
  markOnMyWay: async (id) => withRetry(async () => { const r = (await apiClient.post(`/Bookings/${id}/on-my-way`)).data; invalidate(); return r; }),
  markRunningLate: async (id, delayMinutes, reason) => withRetry(async () => {
    const r = (await apiClient.post(`/Bookings/${id}/running-late`, { delayMinutes, reason })).data;
    invalidate(); return r;
  }),
  startJob: async (id) => withRetry(async () => { const r = (await apiClient.post(`/Bookings/${id}/start`)).data; invalidate(); return r; }),
  finishJob: async (id) => withRetry(async () => { const r = (await apiClient.post(`/Bookings/${id}/finish`)).data; invalidate(); return r; }),
  updateChecklistItem: async (bookingId, checklistItemId, isCompleted) => (
    await apiClient.put(`/Bookings/${bookingId}/checklist/${checklistItemId}`, { isCompleted })
  ).data,
  updateStatus: async (id, status) => withRetry(async () => { const r = (await apiClient.put(`/Bookings/${id}/status`, { status })).data; invalidate(); return r; }),
  assignWorker: async (bookingId, workerId) => withRetry(async () => { const r = (await apiClient.post('/Bookings/assign-worker', { bookingId, workerId })).data; invalidate(); return r; }),
  markWorkerAbsent: async (dto) => withRetry(async () => (await apiClient.post('/Bookings/worker-absence', dto)).data),
  requestCancellation: async (id, reason) => withRetry(async () => (await apiClient.post(`/Bookings/${id}/request-cancellation`, { reason })).data),
  requestReschedule: async (id, dto) => withRetry(async () => (await apiClient.post(`/Bookings/${id}/request-reschedule`, dto)).data),
  rejectCancellationRequest: async (id) => (await apiClient.post(`/Bookings/${id}/reject-cancellation-request`)).data,
  rejectRescheduleRequest: async (id) => (await apiClient.post(`/Bookings/${id}/reject-reschedule-request`)).data,
  adminEdit: async (id, dto) => (await apiClient.put(`/Bookings/${id}/admin-edit`, dto)).data,
  getCancellationFee: async (id) => (await apiClient.get(`/Bookings/${id}/cancellation-fee`)).data,
  cancel: async (id) => withRetry(async () => { const r = (await apiClient.delete(`/Bookings/${id}`)).data; invalidate(); return r; }),
  addService: async (bookingId, serviceId, quantity = 1) => withRetry(async () => (
    await apiClient.post(`/Bookings/${bookingId}/add-service`, { serviceId, quantity })
  ).data),

  uploadBookingPhoto: async (bookingId, { uri, photoType, caption }) => withRetry(async () => {
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match    = /\.(\w+)$/.exec(filename);
    const type     = match ? `image/${match[1].toLowerCase().replace('jpg', 'jpeg')}` : 'image/jpeg';
    formData.append('Photo',     { uri, name: filename, type });
    formData.append('PhotoType', photoType);
    if (caption) formData.append('Caption', caption);
    return (await apiClient.post(`/Bookings/${bookingId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  }),

  getBookingPhotos: async (bookingId) => withRetry(async () =>
    (await apiClient.get(`/Bookings/${bookingId}/photos`)).data
  ),
};
