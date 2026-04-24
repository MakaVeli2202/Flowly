/**
 * Web-only mock for @stripe/stripe-react-native.
 * The native SDK cannot bundle for web. This shim provides no-op
 * implementations so the web bundle compiles without errors.
 * Stripe payments are only available on iOS/Android.
 */
import React from 'react';

export const StripeProvider = ({ children }) => children;

export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
  presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
  confirmPayment: async () => ({ error: { message: 'Stripe not available on web' } }),
  createPaymentMethod: async () => ({ error: { message: 'Stripe not available on web' } }),
  createToken: async () => ({ error: { message: 'Stripe not available on web' } }),
  handleURLCallback: async () => false,
});

export const CardField = () => null;
export const CardForm = () => null;
export const ApplePayButton = () => null;
export const GooglePayButton = () => null;
