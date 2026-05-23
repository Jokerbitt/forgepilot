import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/skill-evolver', () => ({
  applyRecommendations: vi.fn(),
  getConfidenceOverrides: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/apply-recommendations', () => {
  it('returns current confidence overrides', async () => {
    const { getConfidenceOverrides } = await import('@/lib/agents/skill-evolver')
    vi.mocked(getConfidenceOverrides).mockReturnValue([
      { agentType: 'claude-code', category: 'coding', factor: 1.1 },
    ] as ReturnType<typeof getConfidenceOverrides>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { overrides: unknown[]; count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.overrides).toHaveLength(1)
  })
})

describe('POST /api/agents/apply-recommendations', () => {
  it('applies recommendations and returns result', async () => {
    const { applyRecommendations, getConfidenceOverrides } = await import('@/lib/agents/skill-evolver')
    vi.mocked(applyRecommendations).mockReturnValue({ applied: 3, skipped: 1 } as ReturnType<typeof applyRecommendations>)
    vi.mocked(getConfidenceOverrides).mockReturnValue([])

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { applied: number; skipped: number }

    expect(res.status).toBe(200)
    expect(body.applied).toBe(3)
    expect(body.skipped).toBe(1)
  })
})
