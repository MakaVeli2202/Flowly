import apiClient from './axios';

export const posAPI = {
  customerLookup: (q) => apiClient.get('/Pos/customer-lookup', { params: { q } }).then(r => r.data),
  createWalkIn: (data) => apiClient.post('/Pos/walk-in', data).then(r => r.data),
  recordPayment: (bookingId, data) => apiClient.post(`/Pos/record-payment/${bookingId}`, data).then(r => r.data),
  getDailySummary: (date) => apiClient.get('/Pos/daily-summary', { params: date ? { date: date.toISOString() } : {} }).then(r => r.data),
};
