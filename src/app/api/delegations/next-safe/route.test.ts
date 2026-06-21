import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pickNextSafe } from '@/lib/delegations/next-safe'
import type { Delegation } from '@/lib/models/delegation'

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => ({
    autopilotMinScore: 70,
    autopilotMaxRiskClass: 'A',
    maxConcurrentAgents: 2,
    autoStartApproved: false,
    budgetEnforcement: 'tolerant' as const,
    budgetTolerancePct: 20,
  })),
}))

import type { TaskContract } from '@/lib/models/delegation'

function makeContract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'c-1',
    workItemId: 'w-1',
    goal: 'Build something meaningful for production',
    context: 'Full context provided here',
    definitionOfDone: ['Tests pass', 'Lint clean'],
    riskClass: 'A',
    maxBudgetUsd: 2,
    allowedTools: ['bash', 'read_file'],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: `d-${Math.random().toString(36).slice(2)}`,
    workItemId: 'w-1',
    title: 'Test delegation',
    status: 'approved',
    contract: makeContract(),
    logs: [],
    createdAt: new Date().toISOString(),
    priority: 5,
    ...overrides,
  } as Delegation
}

const DEFAULT_OPTS = {
  autopilotMinScore: 70,
  autopilotMaxRiskClass: 'A',
  maxConcurrentAgents: 2,
}

describe('pickNextSafe', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when no delegations', () => {
    const { candidate } = pickNextSafe([], DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('returns null when max concurrent agents already running', () => {
    const delegations = [
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'approved' }),
    ]
    const { candidate, runningCount } = pickNextSafe(delegations, DEFAULT_OPTS)
    expect(candidate).toBeNull()
    expect(runningCount).toBe(2)
  })

  it('returns null when candidate is Risk Class C', () => {
    const d = makeDelegation({ contract: makeContract({ riskClass: 'C' }) })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('returns null when candidate is Risk Class B and limit is A', () => {
    const d = makeDelegation({ contract: makeContract({ riskClass: 'B' }) })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('accepts Risk Class B when autopilotMaxRiskClass is B', () => {
    const d = makeDelegation({ contract: makeContract({ riskClass: 'B' }) })
    const { candidate } = pickNextSafe([d], { ...DEFAULT_OPTS, autopilotMaxRiskClass: 'B' })
    expect(candidate).not.toBeNull()
  })

  it('returns null for pending delegation with requiresApproval=true', () => {
    const d = makeDelegation({
      status: 'pending',
      contract: makeContract({ requiresApproval: true }),
    })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('includes pending delegation with requiresApproval=false', () => {
    const d = makeDelegation({
      status: 'pending',
      contract: makeContract({ requiresApproval: false }),
    })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate?.id).toBe(d.id)
  })

  it('returns null when autopilot score is below minimum', () => {
    // Risk C gives a 60pt deduction — score will be < 70
    const d = makeDelegation({
      contract: makeContract({ riskClass: 'C' }),
    })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('returns the approved delegation when it qualifies', () => {
    const d = makeDelegation({ status: 'approved' })
    const { candidate } = pickNextSafe([d], DEFAULT_OPTS)
    expect(candidate?.id).toBe(d.id)
  })

  it('skips running, completed, failed delegations', () => {
    const delegations = [
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'completed' }),
      makeDelegation({ status: 'failed' }),
    ]
    const { candidate } = pickNextSafe(delegations, DEFAULT_OPTS)
    expect(candidate).toBeNull()
  })

  it('picks the highest-score candidate when multiple qualify', () => {
    // High-quality contract → higher score
    const highQuality = makeDelegation({
      id: 'high',
      contract: makeContract({
        goal: 'Build something meaningful for production use',
        context: 'Sufficient context provided',
        definitionOfDone: ['Tests pass'],
        requiresApproval: false,
        maxBudgetUsd: 5,
      }),
    })
    // Missing DoD and context → lower score
    const lowerQuality = makeDelegation({
      id: 'low',
      contract: makeContract({
        goal: 'Build something meaningful for production use',
        context: '',
        definitionOfDone: [],
        requiresApproval: false,
        maxBudgetUsd: 5,
      }),
    })
    const { candidate } = pickNextSafe([lowerQuality, highQuality], DEFAULT_OPTS)
    expect(candidate?.id).toBe('high')
  })

  it('uses priority as tiebreaker when scores are equal', () => {
    const lo = makeDelegation({ id: 'lo', priority: 3 })
    const hi = makeDelegation({ id: 'hi', priority: 9 })
    const { candidate } = pickNextSafe([lo, hi], DEFAULT_OPTS)
    expect(candidate?.id).toBe('hi')
  })

  it('reports correct runningCount', () => {
    const delegations = [
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'approved' }),
    ]
    const { runningCount } = pickNextSafe(delegations, DEFAULT_OPTS)
    expect(runningCount).toBe(1)
  })
})
