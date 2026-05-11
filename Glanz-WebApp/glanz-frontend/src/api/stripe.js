// Tap Payments helper
// The publishable key is used only in the frontend to identify your Tap account.
// Set VITE_TAP_PUBLISHABLE_KEY in your .env file.
// During development (feature.payments = false) this is never read.

export const tapPublishableKey = import.meta.env.VITE_TAP_PUBLISHABLE_KEY ?? null;
