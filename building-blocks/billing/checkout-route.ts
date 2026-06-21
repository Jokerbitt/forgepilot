// Checkout API route — creates a Stripe Checkout Session and returns its URL.
// Destination: src/app/api/billing/checkout/route.ts

import { NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

interface CheckoutRequestBody {
  priceId?: unknown;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: CheckoutRequestBody;

  try {
    body = (await req.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { priceId } = body;

  if (typeof priceId !== 'string' || priceId.length === 0) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 });
  }

  // TODO: get authenticated user + their stripe customerId
  const customerId = 'cus_REPLACE_ME';

  const origin = req.headers.get('origin') ?? 'http://localhost:3000';

  try {
    const url = await createCheckoutSession({
      priceId,
      customerId,
      successUrl: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/billing/cancel`,
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('Failed to create checkout session', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
