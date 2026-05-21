export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buildBillingStatus } from '@/lib/billing/status'

const SUPPORTED_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed',
])

export async function POST(request: NextRequest) {
  const status = buildBillingStatus()
  if (!status.stripe.webhookSecretConfigured) {
    return NextResponse.json(
      { error: 'Billing webhook not configured', code: 'billing_webhook_missing_secret' },
      { status: 503 },
    )
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  const payload = await request.json().catch(() => null) as { type?: string; id?: string } | null
  if (!payload?.type || !SUPPORTED_EVENTS.has(payload.type)) {
    return NextResponse.json({ received: true, ignored: true })
  }

  return NextResponse.json({
    received: true,
    stored: false,
    eventType: payload.type,
    eventId: payload.id ?? null,
    note: 'Stub only: wire this event to tenant subscription state after M171/M175 persistence lands.',
  })
}
