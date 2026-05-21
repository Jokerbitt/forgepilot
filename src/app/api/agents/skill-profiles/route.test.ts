import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/agents/skill-profiles', () => ({
  computeSkillProfiles: vi.fn().mockResolvedValue({
    generatedAt: new Date().toISOString(),
    routes: [],
    recommendation: { bestForQuality: null, bestForCost: null, bestForReliability: null },
  }),
}))

describe('GET /api/agents/skill-profiles', () => {
  it('returns skill profile report', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json() as { routes: unknown[] }
    expect(Array.isArray(data.routes)).toBe(true)
  })
})
