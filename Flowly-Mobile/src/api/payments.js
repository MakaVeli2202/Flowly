/**
 * Payments API
 *
 * Server-side payment intent management.
 * No Stripe SDK dependency here — this is purely HTTP calls to our own backend,
 * which then talks to Stripe using server-side secret keys.
 *
 * ── Phase 2A implementation ───────────────────────────────────────────────────
 * Feature flag: feature.payments must be true for these calls to be made.
 * When false, BookingScreen uses the existing placeholder flow unchanged.
 *
 * ── Required backend endpoints ────────────────────────────────────────────────
 * POST /Payments/create-intent
 *   Body:    { amount, currency, scheduledDate, timeSlot, durationMinutes }
 *   Returns: { clientSecret, intentId, amount, currency }
 *
 * GET  /Payments/intent/:intentId
 *   Returns: { intentId, status, amount }  (status: 'requires_payment_method' | 'succeeded' | 'canceled')
 *
 * ── Stripe SDK setup (do this once, separate from this file) ──────────────────
 * 1. npx expo install @stripe/stripe-react-native
 * 2. In app.json plugins array, add:
 *      ["@stripe/stripe-react-native", { "merchantIdentifier": "merchant.com.flowly" }]
 * 3. In App.js, wrap root with:
 *      import { StripeProvider } from '@stripe/stripe-react-native';
 *      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY}>
 * 4. In app.config.js / .env, set:
 *      EXPO_PUBLIC_STRIPE_KEY=pk_test_...
 * 5. Rebuild dev client: npx expo run:android  or  npx expo run:ios
 */

import apiClient from './axios';

export const paymentsAPI = {
  /**
   * Creates a PaymentIntent on the server and returns the client secret
   * needed for Stripe SDK confirmation.
   *
   * @param {{ amount: number, currency: string, scheduledDate: string, timeSlot: string, durationMinutes: number }} params
   * @returns {{ clientSecret: string, intentId: string, amount: number, currency: string }}
   */
  createIntent: async ({ amount, currency = 'QAR', scheduledDate, timeSlot, durationMinutes }) =>
    (await apiClient.post('/Payments/create-intent', {
      amount,
      currency,
      scheduledDate,
      timeSlot,
      durationMinutes,
    })).data,

  /**
   * Verifies a PaymentIntent status server-side.
   * Backend calls Stripe API directly — no client secret needed here.
   *
   * @param {string} intentId
   * @returns {{ intentId: string, status: string, amount: number }}
   */
  getIntentStatus: async (intentId) =>
    (await apiClient.get(`/Payments/intent/${intentId}`)).data,
};
