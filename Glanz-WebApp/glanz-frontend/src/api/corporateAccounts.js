import apiClient from './axios';

export const corporateAccountsAPI = {
  getAll: () => apiClient.get('/CorporateAccounts').then(r => r.data),
  get: (id) => apiClient.get(`/CorporateAccounts/${id}`).then(r => r.data),
  create: (dto) => apiClient.post('/CorporateAccounts', dto).then(r => r.data),
  update: (id, dto) => apiClient.put(`/CorporateAccounts/${id}`, dto),
  delete: (id) => apiClient.delete(`/CorporateAccounts/${id}`),
  addMember: (id, dto) => apiClient.post(`/CorporateAccounts/${id}/members`, dto).then(r => r.data),
  removeMember: (id, memberId) => apiClient.delete(`/CorporateAccounts/${id}/members/${memberId}`),
  getBookings: (id, year, month) => apiClient.get(`/CorporateAccounts/${id}/bookings`, { params: { year, month } }).then(r => r.data),
  downloadInvoice: (id, year, month) => apiClient.get(`/CorporateAccounts/${id}/invoice`, { params: { year, month }, responseType: 'blob' }),
};
