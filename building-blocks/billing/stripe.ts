// Stripe server client + checkout helper.
// Destination: src/lib/billing/stripe.ts

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(secretKey, {
  // Pin a stable API version to avoid breaking changes on Stripe upgrades.
  apiVersion: '2025-05-28.basil',
  typescript: true,
});

// ---------------------------------------------------------------------------
// PRICE_IDS — PLACEHOLDER. Replace with your real Stripe Price IDs.
// Find them in the Stripe Dashboard under Products. Prefer loading from env
// so the same code works across test/live modes.
// ---------------------------------------------------------------------------
export const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_REPLACE_ME_pro_monthly',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? 'price_REPLACE_ME_pro_yearly',
} as const;

export type PriceKey = keyof typeof PRICE_IDS;

export interface CreateCheckoutSessionParams {
  priceId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout Session for a subscription and returns its URL.
 * Throws if Stripe does not return a redirect URL.
 */
export async function createCheckoutSession({
  priceId,
  customerId,
  successUrl,
  cancelUrl,
}: CreateCheckoutSessionParams): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout session URL');
  }

  return session.url;
}
