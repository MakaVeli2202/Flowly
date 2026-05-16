import apiClient from './axios';

export const recurringAPI = {
  getMyRules: async () => {
    const r = await apiClient.get('/RecurringBookings');
    return r.data;
  },
  createRule: async (dto) => {
    const r = await apiClient.post('/RecurringBookings', dto);
    return r.data;
  },
  pauseRule: async (id) => {
    await apiClient.put(`/RecurringBookings/${id}/pause`);
  },
  resumeRule: async (id) => {
    await apiClient.put(`/RecurringBookings/${id}/resume`);
  },
  deleteRule: async (id) => {
    await apiClient.delete(`/RecurringBookings/${id}`);
  },
  getAdminAll: async () => {
    const r = await apiClient.get('/RecurringBookings/admin/all');
    return r.data;
  },
};

export const waitlistAPI = {
  getMyEntries: async () => {
    const r = await apiClient.get('/Waitlist');
    return r.data;
  },
  join: async (dto) => {
    const r = await apiClient.post('/Waitlist', dto);
    return r.data;
  },
  leave: async (id) => {
    await apiClient.delete(`/Waitlist/${id}`);
  },
  getAdminAll: async (date) => {
    const r = await apiClient.get('/Waitlist/admin/all', { params: date ? { date } : {} });
    return r.data;
  },
  adminNotify: async (date, timeSlot) => {
    const r = await apiClient.post('/Waitlist/admin/notify', null, { params: { date, ...(timeSlot ? { timeSlot } : {}) } });
    return r.data;
  },
};
