import apiClient from './axios';

export const offersAPI = {
  getAll:                    async ()           => (await apiClient.get('/Offers')).data,
  create:                    async (data)       => (await apiClient.post('/Offers', data)).data,
  update:                    async (id, data)   => (await apiClient.put(`/Offers/${id}`, data)).data,
  delete:                    async (id)         => (await apiClient.delete(`/Offers/${id}`)).data,
  getMyCoupons:              async ()           => (await apiClient.get('/Offers/my-coupons')).data,
  getMyLoyalty:              async ()           => (await apiClient.get('/Offers/my-loyalty')).data,
  activateGoogleReviewLoyalty: async ()         => (await apiClient.post('/Offers/loyalty/activate-google-review')).data,
  assignToUser:              async (offerId, userId) => (await apiClient.post(`/Offers/${offerId}/assign/${userId}`)).data,
};
