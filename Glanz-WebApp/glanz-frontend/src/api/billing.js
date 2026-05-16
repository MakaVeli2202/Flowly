import apiClient from './axios';

export const billingAPI = {
  getPlans: async () => {
    const response = await apiClient.get('/PlatformPlans');
    return response.data;
  },

  getSubscription: async () => {
    const response = await apiClient.get('/PlatformPlans/subscription');
    return response.data;
  },

  getUsage: async () => {
    const response = await apiClient.get('/PlatformPlans/usage');
    return response.data;
  },

  createCheckoutSession: async (planId, billingCycle, successUrl, cancelUrl) => {
    const response = await apiClient.post('/PlatformPlans/checkout', {
      planId, billingCycle, successUrl, cancelUrl,
    });
    return response.data;
  },

  createBillingPortalSession: async (returnUrl) => {
    const response = await apiClient.post('/PlatformPlans/billing-portal', { returnUrl });
    return response.data;
  },
};
