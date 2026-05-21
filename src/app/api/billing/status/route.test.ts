import { describe, expect, it } from 'vitest'

describe('GET /api/billing/status', () => {
  it('returns current billing readiness without exposing secrets', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.provider).toBe('stripe')
    expect(body.stripe.secretKeyConfigured).toEqual(expect.any(Boolean))
    expect(JSON.stringify(body)).not.toContain('sk_')
    expect(JSON.stringify(body)).not.toContain('whsec_')
  })
})
