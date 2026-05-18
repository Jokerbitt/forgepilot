import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PMAgentResult } from '@/lib/agent-runner/pm-agent'

// ─── Constants ───────────────────────────────────────────────────

const FRESH_RUN_AT = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()  // 1h ago
const STALE_RUN_AT = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago

function makePlan(runAt: string, health: PMAgentResult['overallHealth'] = 'green'): PMAgentResult {
  return {
    summary: 'Test plan',
    overallHealth: health,
    reviews: [],
    nextDelegations: [],
    blockers: [],
    recommendations: [],
    runAt,
    tokenUsage: { promptTokens: 100, completionTokens: 50 },
  }
}

// ─── Shared state (const object, accessible from hoisted vi.mock factories) ──

const state = {
  pmPlan: null as PMAgentResult | null,
  autoPmAgent: true,
}

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/agent-runner/pm-plan-store', () => ({
  readLastPMPlan: vi.fn(() => state.pmPlan),
  writePMPlan: vi.fn(),
  isPlanStale: vi.fn((plan: PMAgentResult | null) => {
    if (!plan) return true
    return Date.now() - new Date(plan.runAt).getTime() > 24 * 60 * 60 * 1000
  }),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({ ANTHROPIC_API_KEY: 'sk-ant-test-key' })),
}))

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => []),
}))

vi.mock('@/lib/knowledge/milestone-store', () => ({
  readMilestones: vi.fn(() => []),
  readWorkPackages: vi.fn(() => []),
}))

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => ({ autoPmAgent: state.autoPmAgent })),
  saveNBAConfig: vi.fn(),
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  }
})

vi.mock('@/lib/agent-runner/pm-agent', () => ({
  runPMAgent: vi.fn(async () => makePlan(new Date().toISOString())),
}))

import { POST } from './route'
import { runPMAgent } from '@/lib/agent-runner/pm-agent'

const mockRunPMAgent = vi.mocked(runPMAgent)

// ─── Tests ────────────────────────────────────────────────────────

describe('POST /api/pm-agent/auto', () => {
  beforeEach(() => {
    state.pmPlan = null
    state.autoPmAgent = true
    mockRunPMAgent.mockClear()
    mockRunPMAgent.mockResolvedValue(makePlan(new Date().toISOString()))
  })

  it('skips when plan is fresh (< 24h old)', async () => {
    state.pmPlan = makePlan(FRESH_RUN_AT)

    const res = await POST()
    const data = await res.json() as { skipped: boolean; lastRunAt: string }

    expect(res.status).toBe(200)
    expect(data.skipped).toBe(true)
    expect(data.lastRunAt).toBe(FRESH_RUN_AT)
  })

  it('runs PM agent when plan is stale (> 24h old)', async () => {
    state.pmPlan = makePlan(STALE_RUN_AT)

    const res = await POST()
    const data = await res.json() as { ran: boolean; health: string }

    expect(res.status).toBe(200)
    expect(data.ran).toBe(true)
    expect(mockRunPMAgent).toHaveBeenCalledOnce()
  })

  it('returns overallHealth from PM agent result', async () => {
    state.pmPlan = makePlan(STALE_RUN_AT)
    mockRunPMAgent.mockResolvedValueOnce(makePlan(new Date().toISOString(), 'yellow'))

    const res = await POST()
    const data = await res.json() as { ran: boolean; health: string }

    expect(data.ran).toBe(true)
    expect(data.health).toBe('yellow')
  })

  it('handles empty state (no pm-plan.json) by running the agent', async () => {
    state.pmPlan = null // no plan file

    const res = await POST()
    const data = await res.json() as { ran: boolean; health: string }

    expect(res.status).toBe(200)
    expect(data.ran).toBe(true)
    expect(mockRunPMAgent).toHaveBeenCalledOnce()
  })
})
