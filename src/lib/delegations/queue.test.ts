import { describe, expect, it } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import { getQueueStats, selectNextBatch } from './queue'

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: overrides.id ?? 'del-test',
    title: 'Test delegation',
    status: overrides.status ?? 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.1,
    priority: overrides.priority,
    contract: {
      id: 'contract-test',
      workItemId: 'JOK-1',
      goal: 'Do useful work',
      context: '',
      definitionOfDone: ['Done'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('delegation queue', () => {
  it('selects only approved delegations', () => {
    const batch = selectNextBatch({
      delegations: [
        makeDelegation({ id: 'approved', status: 'approved' }),
        makeDelegation({ id: 'pending', status: 'pending' }),
        makeDelegation({ id: 'running', status: 'running' }),
      ],
    })

    expect(batch.map(d => d.id)).toEqual(['approved'])
  })

  it('sorts by priority descending and older createdAt as tie-breaker', () => {
    const batch = selectNextBatch({
      max: 3,
      maxConcurrent: 3,
      delegations: [
        makeDelegation({ id: 'low', priority: 1, createdAt: '2026-01-03T00:00:00.000Z' }),
        makeDelegation({ id: 'new-high', priority: 5, createdAt: '2026-01-02T00:00:00.000Z' }),
        makeDelegation({ id: 'old-high', priority: 5, createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
    })

    expect(batch.map(d => d.id)).toEqual(['old-high', 'new-high', 'low'])
  })

  it('respects the concurrency limit', () => {
    const batch = selectNextBatch({
      max: 3,
      maxConcurrent: 2,
      delegations: [
        makeDelegation({ id: 'running', status: 'running' }),
        makeDelegation({ id: 'approved-1', status: 'approved' }),
        makeDelegation({ id: 'approved-2', status: 'approved' }),
      ],
    })

    expect(batch.map(d => d.id)).toEqual(['approved-1'])
  })

  it('returns empty when concurrency is already saturated', () => {
    const batch = selectNextBatch({
      maxConcurrent: 1,
      delegations: [
        makeDelegation({ id: 'running', status: 'running' }),
        makeDelegation({ id: 'approved', status: 'approved' }),
      ],
    })

    expect(batch).toEqual([])
  })

  it('counts queue stats by status', () => {
    expect(getQueueStats([
      makeDelegation({ status: 'pending' }),
      makeDelegation({ status: 'approved' }),
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'completed' }),
      makeDelegation({ status: 'failed' }),
      makeDelegation({ status: 'cancelled' }),
    ])).toMatchObject({
      pending: 1,
      approved: 1,
      running: 1,
      completed: 1,
      failed: 1,
      cancelled: 1,
      total: 6,
    })
  })
})
