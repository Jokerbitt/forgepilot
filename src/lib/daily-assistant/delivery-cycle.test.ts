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

  it('requires repair when quality check is only partial', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        qualityCheck: {
          criteria: [],
          overallScore: 72,
          verdict: 'partial',
          checkedAt: '2026-05-26T12:01:00.000Z',
        },
      }),
    ])
    expect(action?.type).toBe('repair_required')
  })

  it('requires repair when critic rejects the work', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        qualityCheck: {
          criteria: [],
          overallScore: 90,
          verdict: 'passed',
          checkedAt: '2026-05-26T12:01:00.000Z',
        },
        criticScore: {
          correctness: 52,
          efficiency: 70,
          drift: 40,
          verdict: 'rejected',
          summary: 'Not ready',
          runAt: '2026-05-26T12:02:00.000Z',
        },
      }),
    ])
    expect(action?.type).toBe('repair_required')
  })

  it('stops repeated repair cascades once a nested repair has passed quality and has a PR', () => {
    const action = pickNextDeliveryAction([
      makeDelegation({
        id: 'repair-nested',
        title: 'Repair: Repair: Useful feature',
        tags: ['delivery-repair'],
        contract: {
          ...makeDelegation().contract,
          workItemId: 'repair:previous',
        },
        qualityCheck: {
          criteria: [],
          overallScore: 100,
          verdict: 'passed',
          checkedAt: '2026-05-26T12:01:00.000Z',
        },
        criticScore: {
          correctness: 0,
          efficiency: 0,
          drift: 0,
          verdict: 'rejected',
          summary: 'Evidence was not explicit enough.',
          runAt: '2026-05-26T12:02:00.000Z',
        },
        summaryReport: {
          keyPoints: ['Evidence added'],
          changes: ['Updated docs'],
          timeTakenMinutes: 3,
          prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/604',
          prState: 'open',
        },
      }),
    ])

    expect(action?.type).toBe('review_pr')
    expect(action?.reason).toContain('Keine weitere automatische Repair-Kaskade')
  })

  it('does not keep requiring repair for an original delegation after a repair PR exists', () => {
    const original = makeDelegation({
      id: 'original',
      qualityCheck: {
        criteria: [],
        overallScore: 100,
        verdict: 'passed',
        checkedAt: '2026-05-26T12:01:00.000Z',
      },
      criticScore: {
        correctness: 0,
        efficiency: 0,
        drift: 0,
        verdict: 'rejected',
        summary: 'Needs repair',
        runAt: '2026-05-26T12:02:00.000Z',
      },
      summaryReport: {
        keyPoints: ['Original PR'],
        changes: [],
        timeTakenMinutes: 3,
        prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/602',
        prState: 'open',
      },
    })
    const repair = makeDelegation({
      id: 'repair',
      title: 'Repair: Original',
      tags: ['delivery-repair'],
      contract: {
        ...makeDelegation().contract,
        workItemId: 'repair:original',
      },
      qualityCheck: {
        criteria: [],
        overallScore: 100,
        verdict: 'passed',
        checkedAt: '2026-05-26T12:03:00.000Z',
      },
      criticScore: {
        correctness: 0,
        efficiency: 0,
        drift: 0,
        verdict: 'rejected',
        summary: 'Evidence was still contested',
        runAt: '2026-05-26T12:04:00.000Z',
      },
      summaryReport: {
        keyPoints: ['Repair PR'],
        changes: ['Evidence added'],
        timeTakenMinutes: 3,
        prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/603',
        prState: 'open',
      },
    })

    const action = pickNextDeliveryAction([original, repair])

    expect(action?.type).toBe('review_pr')
    expect(action?.reason).toContain('Eine abgeschlossene Repair-Delegation')
  })

  it('skips older completed duplicate runs for the same work item', () => {
    const older = makeDelegation({
      id: 'older',
      updatedAt: '2026-05-26T12:00:00.000Z',
      completedAt: '2026-05-26T12:00:00.000Z',
      contract: {
        ...makeDelegation().contract,
        workItemId: 'demo-todo-webapp',
      },
    })
    const newer = makeDelegation({
      id: 'newer',
      updatedAt: '2026-05-26T12:10:00.000Z',
      completedAt: '2026-05-26T12:10:00.000Z',
      contract: {
        ...makeDelegation().contract,
        workItemId: 'demo-todo-webapp',
      },
      qualityCheck: {
        criteria: [],
        overallScore: 100,
        verdict: 'passed',
        checkedAt: '2026-05-26T12:11:00.000Z',
      },
    })

    const action = pickNextDeliveryAction([older, newer])

    expect(action?.delegation.id).toBe('newer')
    expect(action?.type).toBe('critic_review')
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
