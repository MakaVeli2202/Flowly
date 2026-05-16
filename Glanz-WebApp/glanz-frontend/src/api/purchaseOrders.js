import apiClient from './axios';

export const purchaseOrdersAPI = {
  // Suppliers
  getSuppliers: () => apiClient.get('/PurchaseOrders/suppliers').then(r => r.data),
  createSupplier: (data) => apiClient.post('/PurchaseOrders/suppliers', data).then(r => r.data),
  updateSupplier: (id, data) => apiClient.put(`/PurchaseOrders/suppliers/${id}`, data).then(r => r.data),
  deleteSupplier: (id) => apiClient.delete(`/PurchaseOrders/suppliers/${id}`).then(r => r.data),

  // Purchase Orders
  getOrders: (status) => apiClient.get('/PurchaseOrders', { params: status ? { status } : {} }).then(r => r.data),
  getOrder: (id) => apiClient.get(`/PurchaseOrders/${id}`).then(r => r.data),
  createOrder: (data) => apiClient.post('/PurchaseOrders', data).then(r => r.data),
  updateStatus: (id, status) => apiClient.put(`/PurchaseOrders/${id}/status`, { status }).then(r => r.data),
};
