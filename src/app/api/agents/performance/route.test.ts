import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/skill-evolver', () => ({
  getPerformanceSummaries: vi.fn(),
  getDriftWarnings: vi.fn(),
  seedDemoOutcomes: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/performance', () => {
  it('returns performance summaries grouped by agent', async () => {
    const { getPerformanceSummaries, getDriftWarnings } = await import('@/lib/agents/skill-evolver')
    vi.mocked(getPerformanceSummaries).mockReturnValue([
      { agentType: 'claude-code', successRate: 0.9, avgScore: 85, totalDelegations: 10 },
      { agentType: 'codex', successRate: 0.8, avgScore: 78, totalDelegations: 5 },
    ] as unknown as ReturnType<typeof getPerformanceSummaries>)
    vi.mocked(getDriftWarnings).mockReturnValue([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { summaries: unknown[]; byAgent: Record<string, unknown[]>; warnings: unknown[] }

    expect(res.status).toBe(200)
    expect(body.summaries).toHaveLength(2)
    expect(body.byAgent['claude-code']).toHaveLength(1)
    expect(Array.isArray(body.warnings)).toBe(true)
  })
})
