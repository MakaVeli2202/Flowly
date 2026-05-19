import apiClient from './axios';

export const waitlistAPI = {
  // Admin
  getAll: (date) => apiClient.get('/Waitlist/admin/all', { params: date ? { date } : {} }).then(r => r.data),
  notify: (date, timeSlot) => apiClient.post('/Waitlist/admin/notify', null, { params: { date, ...(timeSlot ? { timeSlot } : {}) } }).then(r => r.data),
  // Customer
  getMyEntries: () => apiClient.get('/Waitlist').then(r => r.data),
  join: (data) => apiClient.post('/Waitlist', data).then(r => r.data),
  leave: (id) => apiClient.delete(`/Waitlist/${id}`).then(r => r.data),
};
