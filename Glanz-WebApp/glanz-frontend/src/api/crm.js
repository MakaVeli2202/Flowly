import apiClient from './axios';
import { withRetry } from '../utils/retry';

const _cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const crmAPI = {
  getDashboard: async () => withRetry(async () => {
    const response = await apiClient.get('/Crm/dashboard');
    return response.data;
  }),

  getStats: async () => withRetry(async () => {
    const response = await apiClient.get('/Crm/stats');
    return response.data;
  }),

  getCustomers: async (segment) => withRetry(async () => {
    const params = segment && segment !== 'All' ? `?segment=${segment}` : '';
    const response = await apiClient.get(`/Crm/customers${params}`);
    return response.data;
  }),

  getSegmentedCustomers: async (filters = {}) => withRetry(async () => {
    const response = await apiClient.get('/Crm/customers', { params: _cleanParams(filters) });
    return response.data;
  }),

  exportCustomersCsv: (segment) => {
    const params = segment && segment !== 'All' ? `?segment=${segment}` : '';
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `${apiClient.defaults.baseURL}/Crm/customers/export${params}`;
    // Trigger via fetch so auth header is sent, then download blob
    return fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  },

  exportSegmentedCsv: (filters = {}) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const qs = new URLSearchParams(_cleanParams(filters)).toString();
    const url = `${apiClient.defaults.baseURL}/Crm/customers/export${qs ? '?' + qs : ''}`;
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `segment-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  },

  getCustomer: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Crm/customer/${id}`);
    return response.data;
  }),

  updateCustomer: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Crm/customer/${id}`, data);
    return response.data;
  }),

  bulkUpdateTags: async (customerIds, tag, remove = false) => withRetry(async () => {
    const response = await apiClient.post('/Crm/customers/bulk-tag', {
      customerIds,
      tag,
      remove
    });
    return response.data;
  }),

  bulkMessage: async (customerIds, message, channel = 'push') => withRetry(async () => {
    const response = await apiClient.post('/Crm/customers/bulk-message', { customerIds, message, channel });
    return response.data;
  }),

  getCustomerTimeline: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Crm/customers/${id}/timeline`);
    return response.data;
  }),

  getAtRiskCustomers: async () => withRetry(async () => {
    const response = await apiClient.get('/Crm/at-risk');
    return response.data;
  }),

  submitFeedback: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Crm/feedback', data);
    return response.data;
  }),

  getMyFeedback: async () => withRetry(async () => {
    const response = await apiClient.get('/Crm/feedback/my');
    return response.data;
  }),

  getAllFeedback: async (type, resolved) => withRetry(async () => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (resolved !== undefined) params.append('resolved', resolved);
    const queryString = params.toString();
    const response = await apiClient.get(`/Crm/feedback${queryString ? '?' + queryString : ''}`);
    return response.data;
  }),

  resolveFeedback: async (id, resolutionNote) => withRetry(async () => {
    const response = await apiClient.put(`/Crm/feedback/${id}/resolve`, { resolutionNote });
    return response.data;
  }),

  fixCustomerData: async () => withRetry(async () => {
    const response = await apiClient.post('/Crm/fix-customer-data');
    return response.data;
  }),

  getLeads: async (filter = {}) => withRetry(async () => {
    const params = new URLSearchParams();
    if (filter.status) params.append('status', filter.status);
    if (filter.source) params.append('source', filter.source);
    if (filter.skip) params.append('skip', filter.skip.toString());
    if (filter.take) params.append('take', filter.take.toString());
    const queryString = params.toString();
    const response = await apiClient.get(`/Leads${queryString ? '?' + queryString : ''}`);
    return response.data;
  }),

  getLeadStats: async () => withRetry(async () => {
    const response = await apiClient.get('/Leads/stats');
    return response.data;
  }),

  getLead: async (id) => withRetry(async () => {
    const response = await apiClient.get(`/Leads/${id}`);
    return response.data;
  }),

  createLead: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Leads', data);
    return response.data;
  }),

  updateLead: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Leads/${id}`, data);
    return response.data;
  }),

  deleteLead: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Leads/${id}`);
    return response.data;
  }),
};