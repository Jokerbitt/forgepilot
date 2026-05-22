import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockConfig = {
  approvalMode: 'autopilot' as const,
  autopilotMaxRiskClass: 'B' as const,
  autopilotMinScore: 80,
  aiProvider: 'anthropic' as const,
  localCodingModel: 'qwen2.5-coder:14b',
  localFastModel: 'llama3.2:3b',
  maxConcurrentAgents: 2,
  autoStartApproved: false,
  ignoreStatuses: [],
  penalizeOldBacklogs: false,
  backlogPenaltyAgeDays: 90,
  backlogPenaltyScore: 20,
  showTriageJoker: false,
  maxRecommendations: 5,
  pinnedItems: [],
  customLlmModels: [],
  projects: [],
  milestones: [],
}

const approvedDelegation = {
  id: 'del-auto-1',
  status: 'approved' as const,
  contract: {
    goal: 'Auto-Task',
    workItemId: 'JOK-99',
    riskClass: 'A' as const,
    requiresApproval: false,
    executionRoute: 'local-agent',
    privacyMode: 'local',
    maxBudgetUsd: 5,
  },
  logs: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => mockConfig),
}))

vi.mock('fs', () => {
  const store = { data: '[]' }
  return {
    default: {
      readFileSync: vi.fn(() => store.data),
      existsSync: vi.fn(() => true),
    },
    __store: store,
  }
})

function makeRequest(url = 'http://localhost/api/autopilot/tick') {
  return new Request(url, { method: 'POST' })
}

describe('POST /api/autopilot/tick', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('skips when approvalMode is not autopilot', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValueOnce({ ...mockConfig, approvalMode: 'manual' })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.skipped).toBe(true)
  })

  it('returns empty triggered list when no approved delegations', async () => {
    const fs = await import('fs')
    // Persistent mock so both listByStatus('running') and listByStatus('approved') return []
    vi.mocked(fs.default.readFileSync).mockReturnValue('[]' as unknown as string)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ triggered: [], count: 0 })
  })

  it('excludes Class C delegations even in autopilot mode', async () => {
    const fs = await import('fs')
    const classC = { ...approvedDelegation, id: 'del-c', contract: { ...approvedDelegation.contract, riskClass: 'C' as const } }
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify([classC]) as unknown as string)
    const globalFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(data.triggered).toHaveLength(0)
    globalFetch.mockRestore()
  })

  it('excludes delegations with riskClass above autopilotMaxRiskClass', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValueOnce({ ...mockConfig, autopilotMaxRiskClass: 'A' })
    const fs = await import('fs')
    const classB = { ...approvedDelegation, id: 'del-b', contract: { ...approvedDelegation.contract, riskClass: 'B' as const } }
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify([classB]) as unknown as string)
    const globalFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(data.triggered).toHaveLength(0)
    globalFetch.mockRestore()
  })

  it('triggers execute for qualifying approved delegations', async () => {
    const fs = await import('fs')
    // Persistent mock: both listByStatus calls see the same delegation list.
    // Running filter → empty (status 'approved'), Approved filter → 1 result.
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify([approvedDelegation]) as unknown as string)
    const globalFetch = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ started: true }), { status: 200 })
    )
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(data.count).toBe(1)
    expect(data.triggered).toContain('del-auto-1')
    expect(globalFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/delegations/del-auto-1/execute'),
      expect.objectContaining({ method: 'POST' })
    )
    globalFetch.mockRestore()
  })

  it('G5: returns reason when maxConcurrentAgents limit is reached', async () => {
    const fs = await import('fs')
    const running1 = { ...approvedDelegation, id: 'del-r1', status: 'running' as const }
    const running2 = { ...approvedDelegation, id: 'del-r2', status: 'running' as const }
    // 2 running + 1 approved, maxConcurrentAgents=2 → 0 slots
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify([running1, running2, approvedDelegation]) as unknown as string,
    )
    const globalFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(data.triggered).toHaveLength(0)
    expect(data.runningCount).toBe(2)
    expect(data.reason).toContain('maxConcurrentAgents')
    expect(globalFetch).not.toHaveBeenCalled()
    globalFetch.mockRestore()
  })

  it('G5: only triggers up to available slots when some are running', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValueOnce({ ...mockConfig, maxConcurrentAgents: 3 })
    const fs = await import('fs')
    const running = { ...approvedDelegation, id: 'del-r1', status: 'running' as const }
    const approved1 = { ...approvedDelegation, id: 'del-a1' }
    const approved2 = { ...approvedDelegation, id: 'del-a2' }
    const approved3 = { ...approvedDelegation, id: 'del-a3' }
    // 1 running → 2 slots; 3 approved → only 2 trigger, 1 skipped
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify([running, approved1, approved2, approved3]) as unknown as string,
    )
    const globalFetch = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ started: true }), { status: 200 }),
    )
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(data.count).toBe(2)
    expect(data.skipped).toBe(1)
    expect(data.runningCount).toBe(1)
    globalFetch.mockRestore()
  })

  it('G5: response always includes runningCount', async () => {
    const fs = await import('fs')
    vi.mocked(fs.default.readFileSync).mockReturnValue('[]' as unknown as string)
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(typeof data.runningCount).toBe('number')
  })
})
