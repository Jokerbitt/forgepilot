import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/agent-skills', () => ({
  AGENT_PROFILES: {
    'claude-code': { id: 'claude-code', skills: ['code', 'test'] },
    'codex': { id: 'codex', skills: ['code', 'architecture'] },
  },
  getBestAgentForCategory: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/skills', () => {
  it('returns all profiles when no category filter', async () => {
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/agents/skills'))
    const body = await res.json() as { profiles: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(body.profiles).toBeTruthy()
    expect(Object.keys(body.profiles).length).toBeGreaterThan(0)
  })

  it('returns best agent for a category', async () => {
    const { getBestAgentForCategory } = await import('@/lib/agents/agent-skills')
    vi.mocked(getBestAgentForCategory).mockReturnValue('claude-code' as ReturnType<typeof getBestAgentForCategory>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/agents/skills?category=coding'))
    const body = await res.json() as { category: string; bestAgent: string }

    expect(res.status).toBe(200)
    expect(body.category).toBe('coding')
    expect(body.bestAgent).toBe('claude-code')
  })
})
