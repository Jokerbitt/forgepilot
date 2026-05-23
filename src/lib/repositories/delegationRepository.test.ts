import { describe, expect, it } from 'vitest'
import { __test__, getDelegationStorageMode } from './delegationRepository'

describe('getDelegationStorageMode', () => {
  it('defaults to json when no database is configured', () => {
    expect(getDelegationStorageMode({})).toBe('json')
  })

  it('uses postgres when DATABASE_URL is present', () => {
    expect(getDelegationStorageMode({ DATABASE_URL: 'postgresql://localhost/forgepilot' })).toBe(
      'postgres'
    )
  })

  it('allows an explicit dual-write migration mode', () => {
    expect(
      getDelegationStorageMode({
        DATABASE_URL: 'postgresql://localhost/forgepilot',
        FORGEPILOT_DELEGATION_STORAGE: 'dual',
      })
    ).toBe('dual')
  })

  it('ignores unknown storage modes and derives mode from DATABASE_URL', () => {
    expect(
      getDelegationStorageMode({
        DATABASE_URL: 'postgresql://localhost/forgepilot',
        FORGEPILOT_DELEGATION_STORAGE: 'sqlite',
      })
    ).toBe('postgres')
  })
})

describe('Postgres delegation mapping', () => {
  it('preserves contextSnapshot when reading rows from Postgres', () => {
    const createdAt = new Date('2026-05-23T10:00:00.000Z')
    const snapshot = {
      cards: [{ id: 'card-1', title: 'Routing lesson', type: 'learning', tags: ['execute-loop'] }],
      tokenEstimate: 128,
      builtAt: '2026-05-23T10:01:00.000Z',
    }

    const delegation = __test__.rowToDelegation({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Context snapshot persistence',
      status: 'completed',
      riskClass: 'A',
      executionRoute: 'runner',
      contract: {
        id: 'contract-1',
        workItemId: 'M3-context-snapshot',
        goal: 'Persist context snapshots',
        context: '',
        definitionOfDone: [],
        riskClass: 'A',
        maxBudgetUsd: 0.1,
        allowedTools: [],
        branchStrategy: 'fix',
        requiresApproval: false,
        privacyMode: 'local',
        createdAt: createdAt.toISOString(),
      },
      summaryReport: null,
      logs: [],
      costEstimateUsd: 0.01,
      actualCostUsd: null,
      traceId: null,
      agentRunId: null,
      prUrl: null,
      errorMessage: null,
      failureFeedback: null,
      note: null,
      autoOrchestrate: false,
      priority: null,
      briefId: null,
      criticScore: null,
      contextSnapshot: snapshot,
      startedAt: new Date('2026-05-23T10:02:00.000Z'),
      completedAt: new Date('2026-05-23T10:05:00.000Z'),
      createdAt,
      updatedAt: createdAt,
    })

    expect(delegation.contextSnapshot).toEqual(snapshot)
    expect(delegation.startedAt).toBe('2026-05-23T10:02:00.000Z')
    expect(delegation.completedAt).toBe('2026-05-23T10:05:00.000Z')
  })
})
