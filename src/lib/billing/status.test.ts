import { describe, expect, it } from 'vitest'
import { buildBillingStatus } from './status'

describe('buildBillingStatus', () => {
  it('reports missing billing when no Stripe env vars are configured', () => {
    const status = buildBillingStatus({} as unknown as NodeJS.ProcessEnv, new Date('2026-05-21T12:00:00Z'))

    expect(status.readiness).toBe('missing')
    expect(status.mode).toBe('not_configured')
    expect(status.blockers).toContain('STRIPE_SECRET_KEY fehlt.')
    expect(status.plans.map(plan => plan.id)).toEqual(['solo-local', 'solo-pro', 'team'])
  })

  it('detects test mode and ready billing configuration', () => {
    const status = buildBillingStatus({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      STRIPE_PRICE_SOLO_PRO: 'price_solo',
      STRIPE_CUSTOMER_PORTAL_URL: 'https://billing.stripe.com/test',
    } as unknown as NodeJS.ProcessEnv)

    expect(status.readiness).toBe('ready')
    expect(status.mode).toBe('test')
    expect(status.blockers).toEqual([])
    expect(status.stripe.priceIdsConfigured).toBe(true)
  })
})
