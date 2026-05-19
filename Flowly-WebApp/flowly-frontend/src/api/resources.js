import apiClient from './axios';

export const resourcesAPI = {
  getAll: () => apiClient.get('/Resources').then(r => r.data),
  create: (data) => apiClient.post('/Resources', data).then(r => r.data),
  update: (id, data) => apiClient.put(`/Resources/${id}`, data).then(r => r.data),
  delete: (id) => apiClient.delete(`/Resources/${id}`),
  getAvailability: (startAt, endAt) =>
    apiClient.get('/Resources/availability', { params: { startAt: startAt.toISOString(), endAt: endAt.toISOString() } }).then(r => r.data),
  getBookingResources: (bookingId) => apiClient.get(`/Resources/bookings/${bookingId}`).then(r => r.data),
  attachToBooking: (bookingId, resourceId, startAt, endAt) =>
    apiClient.post(`/Resources/bookings/${bookingId}/attach`, { resourceId, startAt: startAt.toISOString(), endAt: endAt.toISOString() }).then(r => r.data),
  detachFromBooking: (bookingId, resourceId) =>
    apiClient.delete(`/Resources/bookings/${bookingId}/detach/${resourceId}`),
};
