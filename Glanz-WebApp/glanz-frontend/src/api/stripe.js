import { loadStripe } from '@stripe/stripe-js/pure';

loadStripe.setLoadParameters({ advancedFraudSignals: false });

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = stripePublishableKey
	? loadStripe(stripePublishableKey)
	: null;
