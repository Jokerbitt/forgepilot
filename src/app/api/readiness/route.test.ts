import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/readiness', () => {
  it('returns 200 with a valid readiness report', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(typeof body.score).toBe('number')
    expect(Array.isArray(body.gaps)).toBe(true)
    expect(typeof body.readyForSolo).toBe('boolean')
    expect(typeof body.readyForSaaS).toBe('boolean')
    expect(typeof body.generatedAt).toBe('string')
  })

  it('returns a report with the expected gap IDs', async () => {
    const response = await GET()
    const body = await response.json() as { gaps: Array<{ id: string }> }
    const ids = body.gaps.map(g => g.id)
    expect(ids).toContain('auth')
    expect(ids).toContain('multi-tenancy')
    expect(ids).toContain('billing')
    expect(ids).toContain('rate-limiting')
  })
})
