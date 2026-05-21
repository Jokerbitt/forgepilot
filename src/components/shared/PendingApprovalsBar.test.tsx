import { describe, it, expect } from 'vitest'
import {
  filterPendingDelegations,
  getVisibleDelegations,
  getDelegationLabel,
  MAX_VISIBLE,
  POLL_MS,
} from './PendingApprovalsBar'
import type { Delegation } from '@/lib/models/delegation'

// ── Minimal delegation factory ───────────────────────────────────────────────

function makeDelegation(
  overrides: Partial<{ id: string; title: string; riskClass: 'A' | 'B' | 'C'; status: string }> = {},
): Delegation {
  return {
    id: overrides.id ?? 'del-1',
    title: overrides.title ?? 'Test Delegation',
    status: (overrides.status ?? 'pending') as Delegation['status'],
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    contract: {
      id: overrides.id ?? 'del-1',
      workItemId: 'wi-1',
      goal: 'Implement feature X',
      context: '',
      definitionOfDone: [],
      riskClass: overrides.riskClass ?? 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: true,
      privacyMode: 'local',
      createdAt: '2024-01-01T00:00:00Z',
    },
    logs: [],
  }
}

// ── filterPendingDelegations ──────────────────────────────────────────────────

describe('filterPendingDelegations', () => {
  it('returns only pending delegations', () => {
    const delegations = [
      makeDelegation({ id: 'd1', status: 'pending' }),
      makeDelegation({ id: 'd2', status: 'approved' }),
      makeDelegation({ id: 'd3', status: 'running' }),
      makeDelegation({ id: 'd4', status: 'completed' }),
      makeDelegation({ id: 'd5', status: 'pending' }),
    ]
    const result = filterPendingDelegations(delegations)
    expect(result).toHaveLength(2)
    expect(result.map(d => d.id)).toEqual(['d1', 'd5'])
  })

  it('returns empty array when no pending delegations', () => {
    const delegations = [
      makeDelegation({ status: 'completed' }),
      makeDelegation({ status: 'failed' }),
    ]
    expect(filterPendingDelegations(delegations)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterPendingDelegations([])).toHaveLength(0)
  })

  it('returns all delegations when all are pending', () => {
    const delegations = [
      makeDelegation({ id: 'd1', status: 'pending' }),
      makeDelegation({ id: 'd2', status: 'pending' }),
    ]
    expect(filterPendingDelegations(delegations)).toHaveLength(2)
  })
})

// ── getVisibleDelegations ─────────────────────────────────────────────────────

describe('getVisibleDelegations', () => {
  it('removes just-approved ids from visible list', () => {
    const pending = [
      makeDelegation({ id: 'd1' }),
      makeDelegation({ id: 'd2' }),
      makeDelegation({ id: 'd3' }),
    ]
    const justApproved = new Set(['d2'])
    const approving = new Set<string>()

    const result = getVisibleDelegations(pending, justApproved, approving)
    expect(result.map(d => d.id)).toEqual(['d1', 'd3'])
  })

  it('keeps items that are currently being approved (approving takes precedence)', () => {
    const pending = [makeDelegation({ id: 'd1' })]
    // d1 is in justApproved but still being approved — keep it visible
    const justApproved = new Set(['d1'])
    const approving = new Set(['d1'])

    const result = getVisibleDelegations(pending, justApproved, approving)
    expect(result).toHaveLength(1)
  })

  it('returns all when no just-approved ids', () => {
    const pending = [
      makeDelegation({ id: 'd1' }),
      makeDelegation({ id: 'd2' }),
    ]
    const result = getVisibleDelegations(pending, new Set(), new Set())
    expect(result).toHaveLength(2)
  })

  it('returns empty array when all items are approved', () => {
    const pending = [
      makeDelegation({ id: 'd1' }),
      makeDelegation({ id: 'd2' }),
    ]
    const justApproved = new Set(['d1', 'd2'])
    const result = getVisibleDelegations(pending, justApproved, new Set())
    expect(result).toHaveLength(0)
  })
})

// ── getDelegationLabel ────────────────────────────────────────────────────────

describe('getDelegationLabel', () => {
  it('returns the title when set', () => {
    const d = makeDelegation({ title: 'Deploy API v2' })
    expect(getDelegationLabel(d)).toBe('Deploy API v2')
  })

  it('falls back to goal (first 45 chars) when title is empty', () => {
    const d = makeDelegation({ title: '' })
    expect(getDelegationLabel(d)).toBe('Implement feature X')
  })

  it('truncates goal to 45 characters when goal is long', () => {
    const d = makeDelegation({ title: '' })
    d.contract.goal = 'A'.repeat(60)
    expect(getDelegationLabel(d)).toHaveLength(45)
  })

  it('returns empty string if title is empty and goal is also empty', () => {
    const d = makeDelegation({ title: '' })
    d.contract.goal = ''
    expect(getDelegationLabel(d)).toBe('')
  })
})

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MAX_VISIBLE is 3', () => {
    expect(MAX_VISIBLE).toBe(3)
  })

  it('POLL_MS is 15 seconds', () => {
    expect(POLL_MS).toBe(15_000)
  })
})
