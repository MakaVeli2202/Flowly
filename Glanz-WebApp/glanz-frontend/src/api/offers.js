import apiClient from './axios';
import { withRetry } from '../utils/retry';

export const offersAPI = {
  getAll: async () => withRetry(async () => {
    const response = await apiClient.get('/Offers');
    return response.data;
  }),

  create: async (data) => withRetry(async () => {
    const response = await apiClient.post('/Offers', data);
    return response.data;
  }),

  update: async (id, data) => withRetry(async () => {
    const response = await apiClient.put(`/Offers/${id}`, data);
    return response.data;
  }),

  delete: async (id) => withRetry(async () => {
    const response = await apiClient.delete(`/Offers/${id}`);
    return response.data;
  }),

  getMyCoupons: async () => withRetry(async () => {
    const response = await apiClient.get('/Offers/my-coupons');
    return response.data;
  }),

  getMyLoyalty: async () => withRetry(async () => {
    const response = await apiClient.get('/Offers/my-loyalty');
    return response.data;
  }),

  activateGoogleReviewLoyalty: async () => withRetry(async () => {
    const response = await apiClient.post('/Offers/loyalty/activate-google-review');
    return response.data;
  }),

  getUserCoupons: async () => withRetry(async () => {
    const response = await apiClient.get('/Offers/user-coupons');
    return response.data;
  }),

  getLoyaltyProgress: async () => withRetry(async () => {
    const response = await apiClient.get('/Offers/loyalty-progress');
    return response.data;
  }),

  assignToUser: async (offerId, userId) => withRetry(async () => {
    const response = await apiClient.post(`/Offers/${offerId}/assign/${userId}`);
    return response.data;
  })
};