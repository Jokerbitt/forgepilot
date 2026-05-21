import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/billing/webhook', () => {
  it('fails closed when webhook secret is not configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    const { POST } = await import('./route')
    const res = await POST(request({ type: 'customer.subscription.updated' }, { 'stripe-signature': 'sig' }))

    expect(res.status).toBe(503)
    vi.unstubAllEnvs()
  })

  it('requires a Stripe signature when configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
    const { POST } = await import('./route')
    const res = await POST(request({ type: 'customer.subscription.updated' }))

    expect(res.status).toBe(400)
    vi.unstubAllEnvs()
  })
})
