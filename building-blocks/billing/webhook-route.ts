// Stripe webhook handler — verifies signatures and reacts to billing events.
// Destination: src/app/api/billing/webhook/route.ts

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
}

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Raw body is required for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      // TODO: update your User subscription state in the DB
      void session;
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      // TODO: update your User subscription state in the DB
      void subscription;
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // TODO: update your User subscription state in the DB
      void subscription;
      break;
    }
    default: {
      // Unhandled event types are acknowledged to avoid Stripe retries.
      break;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
