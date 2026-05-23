import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/registry', () => ({ getAgents: vi.fn() }))
vi.mock('@/lib/agents/scope-lock', () => ({ getActiveClaims: vi.fn() }))
vi.mock('@/lib/delegations/queue', () => ({ readDelegations: vi.fn() }))
vi.mock('@/lib/agents/control-plane', () => ({ buildAgentControlPlaneSummary: vi.fn() }))
vi.mock('@/lib/agent-runner/pm-plan-store', () => ({ isPlanStale: vi.fn(), readLastPMPlan: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/control-plane', () => {
  it('returns control plane summary', async () => {
    const { getAgents } = await import('@/lib/agents/registry')
    const { getActiveClaims } = await import('@/lib/agents/scope-lock')
    const { readDelegations } = await import('@/lib/delegations/queue')
    const { buildAgentControlPlaneSummary } = await import('@/lib/agents/control-plane')
    const { isPlanStale, readLastPMPlan } = await import('@/lib/agent-runner/pm-plan-store')

    vi.mocked(getAgents).mockReturnValue([])
    vi.mocked(getActiveClaims).mockReturnValue([])
    vi.mocked(readDelegations).mockReturnValue([])
    vi.mocked(readLastPMPlan).mockReturnValue(null as unknown as ReturnType<typeof readLastPMPlan>)
    vi.mocked(isPlanStale).mockReturnValue(false)
    vi.mocked(buildAgentControlPlaneSummary).mockReturnValue({
      agents: [], claims: [], delegations: [], recommendations: [],
    } as unknown as ReturnType<typeof buildAgentControlPlaneSummary>)

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json() as { agents: unknown[] }
    expect(Array.isArray(body.agents)).toBe(true)
  })
})
