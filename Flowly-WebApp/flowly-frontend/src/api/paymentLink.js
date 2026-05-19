import apiClient from './axios';

export const paymentLinkAPI = {
  generate: (bookingId) => apiClient.post(`/PaymentLink/${bookingId}/generate`).then(r => r.data),
  getByToken: (token) => apiClient.get(`/PaymentLink/${token}`).then(r => r.data),
};
