import { describe, expect, it } from 'vitest'

describe('GET /api/saas-readiness', () => {
  it('returns a SaaS readiness audit payload', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.score).toEqual(expect.any(Number))
    expect(body.readiness).toMatch(/blocked|at_risk|launch_candidate/)
    expect(body.checks.length).toBeGreaterThanOrEqual(5)
    expect(body.nextActions.length).toBeGreaterThan(0)
  })
})
