import { describe, expect, it } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import { describeDeliveryAction, pickNextDeliveryAction } from './delivery-cycle'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  const now = '2026-05-26T12:00:00.000Z'
  return {
    id: overrides.id ?? 'del-1',
    title: overrides.title ?? 'Test Delegation',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    contract: {
      id: 'contract-1',
      workItemId: 'work-1',
      goal: 'Build a useful feature',
      context: 'Enough context',
      definitionOfDone: ['Tests pass'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: now,
    },
    logs: [],
    ...overrides,
  }
}

describe('pickNextDeliveryAction', () => {
  it('starts with quality check for completed safe delegations', () => {
    const action = pickNextDeliveryAction([makeDelegation()])
    expect(action?.type).toBe('quality_check')
    expect(describeDeliveryAction(action)).toContain('Quality Check')
  })

  it('runs critic after quality check passed', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        qualityCheck: {
          criteria: [],
          overallScore: 90,
          verdict: 'passed',
          checkedAt: '2026-05-26T12:01:00.000Z',
        },
      }),
    ])
    expect(action?.type).toBe('critic_review')
  })

  it('creates a PR after quality and critic are present', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        qualityCheck: {
          criteria: [],
          overallScore: 90,
          verdict: 'passed',
          checkedAt: '2026-05-26T12:01:00.000Z',
        },
        criticScore: {
          correctness: 92,
          efficiency: 88,
          drift: 5,
          verdict: 'approved',
          summary: 'Looks good',
          runAt: '2026-05-26T12:02:00.000Z',
        },
      }),
    ])
    expect(action?.type).toBe('create_pr')
  })

  it('does not auto-process Risk C delegations', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        contract: {
          ...makeDelegation().contract,
          riskClass: 'C',
        },
      }),
    ])
    expect(action).toBeNull()
  })

  it('prioritizes repair-required before new post checks', () => {
    const repair = makeDelegation({
      id: 'repair',
      qualityCheck: {
        criteria: [],
        overallScore: 35,
        verdict: 'failed',
        checkedAt: '2026-05-26T12:01:00.000Z',
      },
    })
    const unchecked = makeDelegation({ id: 'unchecked' })
    const action = pickNextDeliveryAction([unchecked, repair])
    expect(action?.type).toBe('repair_required')
    expect(action?.delegation.id).toBe('repair')
  })
})
