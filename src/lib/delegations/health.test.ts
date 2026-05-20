import { describe, it, expect } from 'vitest'
import { analyzeDelegationHealth, analyzeFleetHealth, DEFAULT_THRESHOLDS } from './health'
import type { Delegation, DelegationStatus, TaskContract } from '@/lib/models/delegation'

const NOW = new Date('2026-05-20T12:00:00.000Z')

function makeContract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'tc-1',
    workItemId: 'WI-1',
    goal: 'Test goal',
    context: '',
    definitionOfDone: [],
    riskClass: 'A',
    maxBudgetUsd: 5,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'd-1',
    title: 'Test delegation',
    contract: makeContract(),
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 1,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

function minutesAgo(min: number): string {
  return new Date(NOW.getTime() - min * 60_000).toISOString()
}

describe('analyzeDelegationHealth — running', () => {
  it('marks a freshly-updated running delegation as healthy', () => {
    const d = makeDelegation({
      status: 'running',
      createdAt: minutesAgo(10),
      updatedAt: minutesAgo(2),
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('healthy')
    expect(h.silentMinutes).toBe(2)
    expect(h.reasons).toHaveLength(0)
  })

  it('marks a silent running delegation as stuck after threshold', () => {
    const d = makeDelegation({
      status: 'running',
      createdAt: minutesAgo(60),
      updatedAt: minutesAgo(45), // > 30 min default
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('stuck')
    expect(h.recommendation).toBe('check-logs')
    expect(h.silentMinutes).toBe(45)
    expect(h.reasons[0].kind).toBe('running-silent')
  })

  it('does not set silentMinutes for non-running statuses', () => {
    const d = makeDelegation({ status: 'pending' })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.silentMinutes).toBeUndefined()
  })
})

describe('analyzeDelegationHealth — pending approval', () => {
  it('flags pending approval older than 60 min', () => {
    const d = makeDelegation({
      status: 'pending',
      contract: makeContract({ requiresApproval: true }),
      createdAt: minutesAgo(90),
      updatedAt: minutesAgo(90),
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('attention')
    expect(h.recommendation).toBe('approve')
    expect(h.reasons[0].kind).toBe('pending-approval-forgotten')
  })

  it('does NOT flag pending that does not need approval', () => {
    const d = makeDelegation({
      status: 'pending',
      contract: makeContract({ requiresApproval: false }),
      createdAt: minutesAgo(180),
      updatedAt: minutesAgo(180),
    })
    expect(analyzeDelegationHealth(d, NOW).status).toBe('healthy')
  })
})

describe('analyzeDelegationHealth — approved', () => {
  it('flags an approved delegation that never started after 4h', () => {
    const d = makeDelegation({
      status: 'approved',
      createdAt: minutesAgo(300),
      updatedAt: minutesAgo(300),
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('attention')
    expect(h.reasons[0].kind).toBe('approved-never-started')
  })

  it('leaves a fresh approved delegation healthy', () => {
    const d = makeDelegation({
      status: 'approved',
      createdAt: minutesAgo(30),
      updatedAt: minutesAgo(30),
    })
    expect(analyzeDelegationHealth(d, NOW).status).toBe('healthy')
  })
})

describe('analyzeDelegationHealth — failed', () => {
  it('marks transient-pattern failures as retry-eligible', () => {
    const d = makeDelegation({
      status: 'failed',
      errorMessage: 'fetch failed: ECONNRESET',
      createdAt: minutesAgo(20),
      updatedAt: minutesAgo(5),
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('failed-retry-eligible')
    expect(h.recommendation).toBe('retry')
    expect(h.reasons[0].kind).toBe('failed-with-known-pattern')
  })

  it('treats rate-limit failures as retry-eligible', () => {
    const d = makeDelegation({
      status: 'failed',
      errorMessage: 'Anthropic returned 429 — rate limit exceeded',
    })
    expect(analyzeDelegationHealth(d, NOW).recommendation).toBe('retry')
  })

  it('marks domain failures as attention (manual triage)', () => {
    const d = makeDelegation({
      status: 'failed',
      errorMessage: 'TypeScript compile error in src/foo.ts',
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('attention')
    expect(h.recommendation).toBe('check-logs')
  })

  it('marks failures without an error message as attention', () => {
    const d = makeDelegation({ status: 'failed', errorMessage: undefined })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('attention')
    expect(h.reasons[0].kind).toBe('failed-no-feedback')
  })
})

describe('analyzeDelegationHealth — budget', () => {
  it('marks hard-cap overruns as budget-exceeded with cancel recommendation', () => {
    const d = makeDelegation({
      status: 'completed',
      contract: makeContract({ maxBudgetUsd: 1 }),
      actualCostUsd: 2.5, // > 1.5x
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('budget-exceeded')
    expect(h.recommendation).toBe('cancel')
    expect(h.reasons.some(r => r.kind === 'budget-over-hard-cap')).toBe(true)
  })

  it('marks soft-cap overruns as attention if not already worse', () => {
    const d = makeDelegation({
      status: 'completed',
      contract: makeContract({ maxBudgetUsd: 1 }),
      actualCostUsd: 1.1,
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('attention')
    expect(h.reasons.some(r => r.kind === 'budget-over-soft-cap')).toBe(true)
  })

  it('does not promote retry-eligible failure to attention via soft-cap', () => {
    const d = makeDelegation({
      status: 'failed',
      errorMessage: 'ECONNRESET',
      contract: makeContract({ maxBudgetUsd: 1 }),
      actualCostUsd: 1.1, // soft cap only
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('failed-retry-eligible')
    expect(h.recommendation).toBe('retry')
  })

  it('keeps the recommendation when both budget and status apply', () => {
    const d = makeDelegation({
      status: 'running',
      contract: makeContract({ maxBudgetUsd: 1 }),
      actualCostUsd: 2,
      createdAt: minutesAgo(60),
      updatedAt: minutesAgo(45), // stuck
    })
    const h = analyzeDelegationHealth(d, NOW)
    expect(h.status).toBe('budget-exceeded')
    // stuck recommendation came first, budget kept it
    expect(h.recommendation).toBe('check-logs')
  })

  it('ignores cost when budget is 0', () => {
    const d = makeDelegation({
      status: 'completed',
      contract: makeContract({ maxBudgetUsd: 0 }),
      actualCostUsd: 10,
    })
    expect(analyzeDelegationHealth(d, NOW).status).toBe('healthy')
  })
})

describe('analyzeDelegationHealth — completed / cancelled are healthy', () => {
  it.each<DelegationStatus>(['completed', 'cancelled'])('treats %s as healthy', status => {
    const d = makeDelegation({ status, createdAt: minutesAgo(500), updatedAt: minutesAgo(500) })
    expect(analyzeDelegationHealth(d, NOW).status).toBe('healthy')
  })
})

describe('analyzeFleetHealth', () => {
  it('returns an empty snapshot for an empty fleet', () => {
    const snap = analyzeFleetHealth([], NOW)
    expect(snap.total).toBe(0)
    expect(snap.flagged).toHaveLength(0)
    expect(snap.byStatus.healthy).toBe(0)
  })

  it('counts each delegation in the right bucket', () => {
    const fleet = [
      makeDelegation({ id: 'a', status: 'running', updatedAt: minutesAgo(1) }), // healthy
      makeDelegation({ id: 'b', status: 'running', updatedAt: minutesAgo(40) }), // stuck
      makeDelegation({ id: 'c', status: 'failed', errorMessage: 'ETIMEDOUT' }), // retry-eligible
      makeDelegation({
        id: 'd',
        status: 'completed',
        contract: makeContract({ maxBudgetUsd: 1 }),
        actualCostUsd: 2,
      }), // budget-exceeded
    ]
    const snap = analyzeFleetHealth(fleet, NOW)
    expect(snap.byStatus.healthy).toBe(1)
    expect(snap.byStatus.stuck).toBe(1)
    expect(snap.byStatus['failed-retry-eligible']).toBe(1)
    expect(snap.byStatus['budget-exceeded']).toBe(1)
    expect(snap.flagged).toHaveLength(3)
  })

  it('orders flagged delegations by severity (budget-exceeded > stuck > attention > retry)', () => {
    const fleet = [
      makeDelegation({ id: 'retry', status: 'failed', errorMessage: 'ECONNRESET' }),
      makeDelegation({ id: 'stuck', status: 'running', updatedAt: minutesAgo(50) }),
      makeDelegation({
        id: 'budget',
        status: 'completed',
        contract: makeContract({ maxBudgetUsd: 1 }),
        actualCostUsd: 3,
      }),
      makeDelegation({
        id: 'attn',
        status: 'pending',
        contract: makeContract({ requiresApproval: true }),
        createdAt: minutesAgo(120),
      }),
    ]
    const snap = analyzeFleetHealth(fleet, NOW)
    expect(snap.flagged.map(f => f.delegationId)).toEqual(['budget', 'stuck', 'attn', 'retry'])
  })

  it('includes generatedAt as ISO', () => {
    const snap = analyzeFleetHealth([], NOW)
    expect(snap.generatedAt).toBe(NOW.toISOString())
  })
})

describe('thresholds', () => {
  it('respects a custom runningSilentMinutes', () => {
    const d = makeDelegation({ status: 'running', updatedAt: minutesAgo(10) })
    const h = analyzeDelegationHealth(d, NOW, { ...DEFAULT_THRESHOLDS, runningSilentMinutes: 5 })
    expect(h.status).toBe('stuck')
  })
})
